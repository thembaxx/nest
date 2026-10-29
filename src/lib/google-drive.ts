import { z } from "zod";
import { mergeWithHistory as mergeLibrary } from "./revision-storage";
import { personalLibrary, parseBackup } from "./backup";
import { decryptData, encryptData, importRecoveryKey, MAX_BACKUP_BYTES } from "./encryption";
import { librarySchema, type Library, type Settings } from "./types";

const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const API = "https://www.googleapis.com/drive/v3/files";
const MAX_DEVICE_SNAPSHOTS = 200;
export const googleDriveConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
export type DriveSession = { accessToken: string; expiresAt: number };
export function activeSyncProvider(settings: Settings) {
  return (
    settings.syncProvider ?? (settings.driveKey ? "google" : settings.syncKey ? "nest" : "local")
  );
}
type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        include_granted_scopes: boolean;
        callback: (response: {
          access_token?: string;
          expires_in?: number;
          scope?: string;
          error?: string;
        }) => void;
        error_callback: () => void;
      }) => { requestAccessToken: (options: { prompt: string }) => void };
    };
  };
};
declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}
let identityLoading: Promise<void> | undefined;
function loadIdentity() {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (!identityLoading)
    identityLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.referrerPolicy = "no-referrer";
      const timeout = setTimeout(() => {
        script.remove();
        identityLoading = undefined;
        reject(Error("Google sign-in could not load. Check your connection and try again."));
      }, 15000);
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        identityLoading = undefined;
        reject(Error("Google sign-in could not load. Check your connection and try again."));
      };
      document.head.append(script);
    });
  return identityLoading;
}
// Loading on a pointer/focus gesture lets the subsequent click open Google's popup synchronously.
export function prepareGoogleSignIn() {
  if (googleDriveConfigured) void loadIdentity().catch(() => {});
}
export async function authorizeGoogleDrive(): Promise<DriveSession> {
  if (!googleDriveConfigured) throw Error("Google Drive sync is unavailable on this installation.");
  await loadIdentity();
  // A script load event does not guarantee that Google's client API initialized.
  // Show a recoverable message rather than throwing from window.google below.
  if (!window.google?.accounts?.oauth2?.initTokenClient) {
    identityLoading = undefined;
    throw Error("Google sign-in did not initialize. Check your connection and try again.");
  }
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      scope: SCOPE,
      include_granted_scopes: false,
      callback: (response) => {
        if (
          response.error ||
          !response.access_token ||
          !response.scope?.split(" ").includes(SCOPE)
        ) {
          reject(Error("Google Drive permission was not granted. Your device copy is safe."));
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000 - 60000,
        });
      },
      error_callback: () =>
        reject(Error("Google sign-in was closed or blocked. Try connecting again.")),
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}
export class DriveAuthError extends Error {}
export class DriveRequestError extends Error {
  constructor(public status: number) {
    super("Google Drive could not sync. Check permissions, storage, and your connection.");
  }
}
async function driveRequest(
  session: DriveSession,
  url: string,
  signal: AbortSignal,
  init: RequestInit = {},
) {
  if (Date.now() >= session.expiresAt)
    throw new DriveAuthError("Reconnect Google to continue syncing.");
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  if (response.status === 401) throw new DriveAuthError("Reconnect Google to continue syncing.");
  if (!response.ok) throw new DriveRequestError(response.status);
  return response;
}
const fileSchema = z.object({ id: z.string().regex(/^[\w-]+$/), name: z.string() });

export async function syncGoogleDrive(
  session: DriveSession,
  recovery: string,
  deviceId: string,
  local: Library,
  signal: AbortSignal,
): Promise<Library> {
  if (!navigator.locks)
    throw Error("Google sync needs a browser with Web Locks support. Use a local backup here.");
  // One writer per browser; separate device files preserve simultaneous offline edits.
  return navigator.locks.request("nest-google-drive-sync", { signal }, async () => {
    const key = await importRecoveryKey(recovery);
    const files: z.infer<typeof fileSchema>[] = [];
    const pageTokens = new Set<string>();
    let pages = 0;
    let pageToken = "";
    do {
      // Drive may return empty pages. Bound even unique continuation tokens so a
      // malformed response cannot keep the sync lock and pending state forever.
      if (++pages > MAX_DEVICE_SNAPSHOTS + 1 || pageTokens.has(pageToken))
        throw Error("Google Drive returned an incomplete file listing. Try syncing again.");
      pageTokens.add(pageToken);
      const query = new URLSearchParams({
        spaces: "appDataFolder",
        q: "trashed = false and (appProperties has { key='nestSync' and value='v1' } or appProperties has { key='application' and value='nest' })",
        fields: "nextPageToken,files(id,name)",
        pageSize: "100",
        ...(pageToken ? { pageToken } : {}),
      });
      const response = await driveRequest(session, `${API}?${query}`, signal);
      const page = z
        .object({ nextPageToken: z.string().optional(), files: z.array(fileSchema) })
        .parse(await response.json());
      files.push(...page.files);
      if (files.length > MAX_DEVICE_SNAPSHOTS)
        throw Error(
          "This Drive library has too many device snapshots. Export a backup before continuing.",
        );
      pageToken = page.nextPageToken || "";
    } while (pageToken);
    files.sort((a, b) => a.id.localeCompare(b.id));
    let merged = personalLibrary(local);
    const name = `nest-sync-v1-${deviceId}.json`;
    // Pairing one more device must not create snapshot 201: the next listing
    // would then reject the entire library, including all existing devices.
    if (files.length === MAX_DEVICE_SNAPSHOTS && !files.some((file) => file.name === name))
      throw Error(
        "This Drive library has reached its device snapshot limit. Export a backup before connecting another device.",
      );
    let own: { id: string; library: Library } | undefined;
    for (const file of files) {
      const response = await driveRequest(session, `${API}/${file.id}?alt=media`, signal);
      if (Number(response.headers.get("content-length")) > MAX_BACKUP_BYTES)
        throw Error("A Drive snapshot exceeds the 20 MB file limit.");
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
        throw Error("A Drive snapshot exceeds the 20 MB file limit.");
      let library: Library;
      try {
        library = /^nest-library-[a-f0-9-]{36}\.json$/.test(file.name)
          ? parseBackup(text).library
          : librarySchema.parse(await decryptData(JSON.parse(text), key, "drive"));
      } catch {
        // Never overwrite an existing library with a new/wrong key or a partial restore.
        throw Error(
          "An existing Drive library could not be unlocked. Use its original recovery key; no Drive data was changed.",
        );
      }
      merged = mergeLibrary(merged, personalLibrary(library));
      if (file.name === name) own = { id: file.id, library };
    }
    merged = librarySchema.parse({
      bookmarks: merged.bookmarks.toSorted((a, b) => a.id.localeCompare(b.id)),
      lists: merged.lists.toSorted((a, b) => a.id.localeCompare(b.id)),
    });
    signal.throwIfAborted();
    if (!own || JSON.stringify(own.library) !== JSON.stringify(merged)) {
      const encrypted = JSON.stringify(await encryptData(merged, key, "drive"));
      signal.throwIfAborted();
      if (own) {
        await driveRequest(
          session,
          `https://www.googleapis.com/upload/drive/v3/files/${own.id}?uploadType=media`,
          signal,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: encrypted,
          },
        );
      } else {
        const boundary = `nest_${crypto.randomUUID()}`;
        const metadata = JSON.stringify({
          name,
          parents: ["appDataFolder"],
          appProperties: { nestSync: "v1" },
        });
        await driveRequest(
          session,
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
          signal,
          {
            method: "POST",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${encrypted}\r\n--${boundary}--`,
          },
        );
      }
    }
    return merged;
  });
}
