import { z } from "zod";
import { mergeLibrary } from "./bookmarks";
import { createBackup, MAX_BACKUP_BYTES, parseBackup, syncableLibrary } from "./backup";
import type { Library, Settings } from "./types";

const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/drive/v3/files";
type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string };
type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        include_granted_scopes: boolean;
        callback: (response: TokenResponse) => void;
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
export type GoogleAccess = { token: string; expiresAt: number };
export function activeSyncProvider(settings: Settings) {
  return settings.syncProvider ?? (settings.syncKey ? "nest" : "local");
}

let identityLoading: Promise<void> | undefined;
export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (identityLoading) return identityLoading;
  identityLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = IDENTITY_SCRIPT;
    script.async = true;
    const timeout = setTimeout(() => failed(), 15000);
    function failed() {
      clearTimeout(timeout);
      script.remove();
      identityLoading = undefined;
      reject(Error("Google sign-in could not load. Check your connection and try again."));
    }
    script.onload = () => {
      clearTimeout(timeout);
      if (window.google?.accounts.oauth2) resolve();
      else failed();
    };
    script.onerror = failed;
    document.head.append(script);
  });
  return identityLoading;
}

// Call directly from a click: Google requires a user gesture to open its popup.
export function requestGoogleAccess(clientId: string): Promise<GoogleAccess> {
  return new Promise((resolve, reject) => {
    if (!clientId || !window.google?.accounts.oauth2) {
      reject(Error("Google sign-in is not ready. Please try again."));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      include_granted_scopes: false,
      callback: (response) => {
        if (
          response.error ||
          !response.access_token ||
          !response.scope?.split(" ").includes(SCOPE)
        ) {
          reject(Error("Google Drive access was not granted. Your device copy is unchanged."));
          return;
        }
        resolve({
          token: response.access_token,
          expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000,
        });
      },
      error_callback: () =>
        reject(Error("Google sign-in was closed or blocked. Allow popups and try again.")),
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}

export class GoogleDriveError extends Error {
  constructor(public status: number) {
    super(
      status === 401
        ? "Reconnect Google Drive to continue syncing."
        : status === 403 || status === 429
          ? "Google Drive paused sync. Check your storage and permissions, or try again later."
          : "Google Drive could not sync. Your device copy is safe; Nest will retry.",
    );
  }
}

const filesSchema = z.object({
  nextPageToken: z.string().optional(),
  files: z.array(z.object({ id: z.string(), name: z.string(), size: z.string().optional() })),
});

function deviceId() {
  // Web Locks serialize tabs sharing a device file. Older browsers use a file per tab.
  const storage = navigator.locks ? localStorage : sessionStorage;
  let id = storage.getItem("nest-drive-device");
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    id = crypto.randomUUID();
    storage.setItem("nest-drive-device", id);
  }
  return id;
}

export async function syncGoogleDrive(token: string, local: Library): Promise<Library> {
  const name = `nest-library-${deviceId()}.json`;
  const run = () => syncDeviceFile(token, local, name);
  return navigator.locks ? navigator.locks.request("nest-google-drive", run) : run();
}

async function syncDeviceFile(token: string, local: Library, name: string): Promise<Library> {
  const signal = AbortSignal.timeout(45000);
  async function request(url: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(url, { ...init, headers, signal, cache: "no-store" });
    if (!response.ok) throw new GoogleDriveError(response.status);
    return response;
  }
  const files: z.infer<typeof filesSchema>["files"] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      spaces: "appDataFolder",
      q: "trashed = false and appProperties has { key='application' and value='nest' }",
      fields: "files(id,name,size),nextPageToken",
      pageSize: "1000",
      ...(pageToken ? { pageToken } : {}),
    });
    const page = filesSchema.parse(await (await request(`${API}?${query}`)).json());
    files.push(
      ...page.files.filter((file) => /^nest-library-[a-f0-9-]{36}\.json$/.test(file.name)),
    );
    pageToken = page.nextPageToken;
  } while (pageToken);
  // Every writer owns its snapshot. Concurrent devices never overwrite one another.
  const snapshots = await Promise.all(
    files.map(async (file) => {
      if (Number(file.size) > MAX_BACKUP_BYTES)
        throw Error(
          "A Google Drive snapshot exceeds the 20 MB limit. Download a local backup and contact the site owner.",
        );
      const response = await request(`${API}/${encodeURIComponent(file.id)}?alt=media`);
      return { file, library: parseBackup(await response.text()).library };
    }),
  );
  let merged = syncableLibrary(local);
  for (const snapshot of snapshots) merged = mergeLibrary(merged, snapshot.library);
  merged = syncableLibrary(merged);
  const own = snapshots.find((snapshot) => snapshot.file.name === name);
  const fingerprint = (library: Library) =>
    JSON.stringify({
      bookmarks: [...library.bookmarks].sort((a, b) => a.id.localeCompare(b.id)),
      lists: [...library.lists].sort((a, b) => a.id.localeCompare(b.id)),
    });
  if (own && fingerprint(own.library) === fingerprint(merged)) return merged;
  const content = createBackup(merged);
  if (own) {
    await request(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(own.file.id)}?uploadType=media`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: content,
      },
    );
  } else {
    const boundary = `nest-${crypto.randomUUID()}`;
    const metadata = JSON.stringify({
      name,
      parents: ["appDataFolder"],
      mimeType: "application/json",
      appProperties: { application: "nest" },
    });
    const body = new Blob(
      [
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`,
      ],
      { type: `multipart/related; boundary=${boundary}` },
    );
    await request(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      { method: "POST", body },
    );
  }
  return merged;
}
