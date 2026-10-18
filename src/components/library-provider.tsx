"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  librarySchema,
  defaultSettings,
  type Bookmark,
  type Library,
  type Settings,
} from "@/lib/types";
import { seed } from "@/lib/seed";
import { mergeLibrary } from "@/lib/bookmarks";
import { ingestBookmarks, type IngestOptions } from "@/lib/organize";
import { prepareSyncLibrary } from "@/lib/sync";
import { readLibrary, writeLibrary } from "@/lib/storage";
import { restoreLibrary } from "@/lib/backup";
import { recoveryKey } from "@/lib/encryption";
import {
  authorizeGoogleDrive,
  activeSyncProvider,
  DriveAuthError,
  DriveRequestError,
  syncGoogleDrive,
  type DriveSession,
} from "@/lib/google-drive";
type SyncState =
  | "local"
  | "syncing"
  | "synced"
  | "offline"
  | "error"
  | "unconfigured"
  | "reconnect";
type Context = {
  library: Library;
  settings: Settings;
  ready: boolean;
  syncState: SyncState;
  syncError: string;
  lastSyncedAt: number | null;
  driveConnected: boolean;
  online: boolean;
  toast: (message: string) => void;
  setSettings: (change: Partial<Settings>) => void;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  update: (id: string, changes: Partial<Bookmark>) => void;
  add: (
    bookmarks: Bookmark[],
    lists?: Library["lists"],
    options?: IngestOptions,
  ) => { added: Bookmark[]; duplicates: number; filed: number; moved: number };
  sync: () => Promise<void>;
  connectGoogle: (key?: string) => Promise<void>;
  disconnectGoogle: () => void;
};
const LibraryContext = createContext<Context | null>(null);
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<Library>(seed);
  const [settings, applySettings] = useState<Settings>(defaultSettings);
  const syncProvider = activeSyncProvider(settings);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [syncError, setSyncError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [message, setMessage] = useState("");
  const current = useRef(library);
  const settingsRef = useRef(settings);
  const operation = useRef<AbortController | null>(null);
  const driveSession = useRef<DriveSession | null>(null);
  const retryAt = useRef(0);
  const quotaFailures = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    current.current = library;
    settingsRef.current = settings;
  }, [library, settings]);
  const toast = useCallback((m: string) => {
    setMessage(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 4500);
  }, []);
  useEffect(() => {
    let live = true;
    void readLibrary().then((data) => {
      if (!live) return;
      if (data) setLibrary(data);
      try {
        const s = localStorage.getItem("nest-settings");
        if (s) applySettings({ ...defaultSettings, ...JSON.parse(s) });
      } catch {}
      setOnline(navigator.onLine);
      setReady(true);
    });
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      live = false;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  const setSettings = useCallback((change: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...change };
    // Only one transport can send this library. Switching to legacy sync is explicit.
    if (change.syncKey) {
      next.driveKey = undefined;
      next.syncProvider = "nest";
      operation.current?.abort();
      driveSession.current = null;
      setDriveConnected(false);
    }
    settingsRef.current = next;
    applySettings(next);
  }, []);
  useEffect(() => {
    if (!ready) return;
    void writeLibrary(library).catch(() =>
      toast("Your device storage is full. Export a backup in Settings."),
    );
  }, [library, ready, toast]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("nest-settings", JSON.stringify(settings));
    } catch {
      queueMicrotask(() =>
        toast("Preferences could not be saved. Please check your browser storage."),
      );
    }
    const dark =
      settings.theme === "dark" ||
      (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";

    const media = matchMedia("(prefers-color-scheme: dark)");
    const change = () => {
      if (settings.theme === "system") {
        document.documentElement.dataset.theme = media.matches ? "dark" : "light";
      }
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [settings, ready, toast]);
  const sync = useCallback(async (force = false) => {
    const configuration = settingsRef.current;
    const provider = activeSyncProvider(configuration);
    const key = provider === "google" ? configuration.driveKey : configuration.syncKey;
    if (provider === "local" || (provider === "nest" && !key)) {
      setSyncState("local");
      setSyncError("");
      return;
    }
    if (!navigator.onLine) {
      setSyncState("offline");
      return;
    }
    if (operation.current) return;
    if (provider === "google" && (!key || !driveSession.current)) {
      setSyncState("reconnect");
      return;
    }
    if (!force && Date.now() < retryAt.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setSyncState("syncing");
    setSyncError("");
    try {
      const outgoing = prepareSyncLibrary(current.current);
      let incoming: Library;
      if (provider === "google") {
        incoming = await syncGoogleDrive(
          driveSession.current!,
          key!,
          configuration.driveDeviceId!,
          outgoing,
          controller.signal,
        );
      } else {
        const r = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            bookmarks: outgoing.bookmarks.filter((b) => !b.demo),
            lists: outgoing.lists,
            healthChecks: settingsRef.current.healthChecks,
          }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        if (settingsRef.current.syncKey !== key) return;
        if (r.status === 503) {
          setSyncState("unconfigured");
          return;
        }
        if (!r.ok) throw Error("Sync failed");
        incoming = librarySchema.parse(await r.json());
      }
      if (
        controller.signal.aborted ||
        activeSyncProvider(settingsRef.current) !== provider ||
        (provider === "google" ? settingsRef.current.driveKey : settingsRef.current.syncKey) !== key
      )
        return;
      restoreLibrary(current.current, incoming);
      setLibrary((local) => {
        const merged = mergeLibrary(prepareSyncLibrary(local), incoming);
        return JSON.stringify(merged) === JSON.stringify(local) ? local : merged;
      });
      setSyncState("synced");
      setLastSyncedAt(Date.now());
      retryAt.current = 0;
      quotaFailures.current = 0;
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof DriveAuthError) {
        driveSession.current = null;
        setDriveConnected(false);
        setSyncState("reconnect");
      } else setSyncState(navigator.onLine ? "error" : "offline");
      if (error instanceof DriveRequestError && (error.status === 403 || error.status === 429)) {
        quotaFailures.current++;
        retryAt.current = Date.now() + Math.min(30000 * 2 ** (quotaFailures.current - 1), 300000);
      }
      setSyncError(
        error instanceof Error ? error.message : "Sync could not finish. Your device copy is safe.",
      );
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  }, []);
  const syncNow = useCallback(() => sync(true), [sync]);
  const connectGoogle = useCallback(
    async (existingKey?: string) => {
      operation.current?.abort();
      const controller = new AbortController();
      operation.current = controller;
      setSyncError("");
      setSyncState("syncing");
      try {
        const session = await authorizeGoogleDrive();
        controller.signal.throwIfAborted();
        const key = (
          existingKey ||
          settingsRef.current.driveKey ||
          settingsRef.current.drivePendingKey ||
          recoveryKey()
        )
          .trim()
          .toLowerCase();
        const deviceId = settingsRef.current.driveDeviceId || crypto.randomUUID();
        // Persist the candidate before uploading: a lost response must not strand encrypted data.
        const pending = { ...settingsRef.current, drivePendingKey: key, driveDeviceId: deviceId };
        localStorage.setItem("nest-settings", JSON.stringify(pending));
        setSettings({ drivePendingKey: key, driveDeviceId: deviceId });
        const incoming = await syncGoogleDrive(
          session,
          key,
          deviceId,
          current.current,
          controller.signal,
        );
        controller.signal.throwIfAborted();
        // Verify the existing encrypted data before remembering credentials or changing providers.
        localStorage.setItem(
          "nest-settings",
          JSON.stringify({
            ...settingsRef.current,
            driveKey: key,
            drivePendingKey: undefined,
            syncProvider: "google",
          }),
        );
        driveSession.current = session;
        setDriveConnected(true);
        setSettings({
          driveKey: key,
          drivePendingKey: undefined,
          driveDeviceId: deviceId,
          syncProvider: "google",
        });
        restoreLibrary(current.current, incoming);
        setLibrary((local) => mergeLibrary(prepareSyncLibrary(local), incoming));
        setSyncState("synced");
        setLastSyncedAt(Date.now());
        retryAt.current = 0;
        quotaFailures.current = 0;
      } catch (error) {
        if (!controller.signal.aborted) {
          const message =
            error instanceof Error ? error.message : "Could not connect Google Drive.";
          setSyncError(message);
          setSyncState(settingsRef.current.driveKey ? "reconnect" : "error");
          throw Error(message);
        }
      } finally {
        if (operation.current === controller) operation.current = null;
      }
    },
    [setSettings],
  );
  const disconnectGoogle = useCallback(() => {
    operation.current?.abort();
    driveSession.current = null;
    setDriveConnected(false);
    setSettings({ driveKey: undefined, drivePendingKey: undefined, syncProvider: "local" });
    retryAt.current = 0;
    quotaFailures.current = 0;
    setSyncState("local");
    setSyncError("");
    setLastSyncedAt(null);
  }, [setSettings]);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void sync(), 1500);
    return () => clearTimeout(t);
  }, [
    library,
    settings.syncKey,
    settings.driveKey,
    settings.syncProvider,
    settings.healthChecks,
    ready,
    online,
    sync,
  ]);
  useEffect(() => {
    if (!ready || syncProvider === "local") return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, 30000);
    const visibility = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [sync, syncProvider, ready]);
  const update = useCallback(
    (id: string, changes: Partial<Bookmark>) =>
      setLibrary((s) => ({
        ...s,
        bookmarks: s.bookmarks.map((b) =>
          b.id === id
            ? { ...b, ...changes, demo: false, updatedAt: Math.max(Date.now(), b.updatedAt + 1) }
            : b,
        ),
      })),
    [],
  );
  const add = useCallback(
    (bookmarks: Bookmark[], lists: Library["lists"] = [], options: IngestOptions = {}) => {
      const result = ingestBookmarks(current.current, bookmarks, lists, {
        autoOrganize: settingsRef.current.autoSort,
        ...options,
      });
      current.current = result.library;
      setLibrary(result.library);
      return result;
    },
    [],
  );
  return (
    <LibraryContext.Provider
      value={{
        library,
        settings,
        ready,
        syncState,
        syncError,
        lastSyncedAt,
        driveConnected,
        online,
        toast,
        setSettings,
        setLibrary,
        update,
        add,
        sync: syncNow,
        connectGoogle,
        disconnectGoogle,
      }}
    >
      {children}
      <output className={`toast ${message ? "visible" : ""}`}>{message}</output>
    </LibraryContext.Provider>
  );
}
export function useLibrary() {
  const c = useContext(LibraryContext);
  if (!c) throw Error("LibraryProvider missing");
  return c;
}
