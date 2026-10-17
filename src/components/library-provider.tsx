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
import { restoreLibrary, type Backup } from "@/lib/backup";
import {
  activeSyncProvider,
  GoogleDriveError,
  requestGoogleAccess,
  syncGoogleDrive,
  type GoogleAccess,
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
  connectGoogle: (clientId: string) => Promise<void>;
  disconnectSync: () => void;
  restore: (backup: Backup, preferences: boolean) => void;
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
  const [message, setMessage] = useState("");
  const current = useRef(library);
  const settingsRef = useRef(settings);
  const syncing = useRef(false);
  const googleAccess = useRef<GoogleAccess | null>(null);
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
    settingsRef.current = next;
    applySettings(next);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      void writeLibrary(library).catch(() =>
        toast("Your device storage is full. Export a backup in Settings."),
      );
    }, 180);
    return () => clearTimeout(t);
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
    const config = settingsRef.current;
    const provider = activeSyncProvider(config);
    const key = config.syncKey;
    const access = googleAccess.current;
    const isCurrent = () =>
      activeSyncProvider(settingsRef.current) === provider &&
      (provider === "google"
        ? googleAccess.current === access
        : settingsRef.current.syncKey === key);
    if (provider === "local") {
      setSyncState("local");
      setSyncError("");
      return;
    }
    if (!navigator.onLine) {
      setSyncState("offline");
      return;
    }
    if (provider === "google" && (!access || access.expiresAt <= Date.now() + 30000)) {
      setSyncState("reconnect");
      return;
    }
    if (!force && Date.now() < retryAt.current) return;
    if (syncing.current) return;
    syncing.current = true;
    setSyncState("syncing");
    setSyncError("");
    try {
      const outgoing = prepareSyncLibrary(current.current);
      let incoming: Library;
      if (provider === "google") {
        incoming = await syncGoogleDrive(access!.token, outgoing);
      } else {
        const r = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            bookmarks: outgoing.bookmarks.filter((b) => !b.demo),
            lists: outgoing.lists,
            healthChecks: config.healthChecks,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (!isCurrent()) return;
        if (r.status === 503) {
          setSyncState("unconfigured");
          return;
        }
        if (!r.ok) throw Error("Could not sync. Your device copy is safe; Nest will retry.");
        incoming = librarySchema.parse(await r.json());
      }
      if (!isCurrent()) return;
      // Validate the union before applying it, including changes made during the request.
      restoreLibrary(current.current, incoming);
      setLibrary((local) => {
        const merged = mergeLibrary(prepareSyncLibrary(local), incoming);
        return JSON.stringify(merged) === JSON.stringify(local) ? local : merged;
      });
      setSyncState("synced");
      retryAt.current = 0;
      quotaFailures.current = 0;
    } catch (error) {
      if (!isCurrent()) return;
      if (provider === "google" && error instanceof GoogleDriveError && error.status === 401) {
        googleAccess.current = null;
        setSyncState("reconnect");
      } else {
        setSyncState(navigator.onLine ? "error" : "offline");
      }
      if (error instanceof GoogleDriveError && (error.status === 403 || error.status === 429)) {
        quotaFailures.current++;
        retryAt.current =
          Date.now() +
          Math.min(30000 * 2 ** (quotaFailures.current - 1), 300000) +
          Math.random() * 1000;
      }
      setSyncError(
        error instanceof GoogleDriveError
          ? error.message
          : "Could not sync. Your device copy is safe; Nest will retry.",
      );
    } finally {
      syncing.current = false;
    }
  }, []);
  const syncNow = useCallback(() => sync(true), [sync]);
  const connectGoogle = useCallback(
    async (clientId: string) => {
      const access = await requestGoogleAccess(clientId);
      googleAccess.current = access;
      setSettings({ syncProvider: "google" });
      await sync(true);
    },
    [setSettings, sync],
  );
  const disconnectSync = useCallback(() => {
    googleAccess.current = null;
    retryAt.current = 0;
    quotaFailures.current = 0;
    setSettings({ syncProvider: "local" });
    setSyncState("local");
    setSyncError("");
  }, [setSettings]);
  const restore = useCallback(
    (backup: Backup, preferences: boolean) => {
      const merged = restoreLibrary(current.current, backup.library);
      current.current = merged;
      setLibrary(merged);
      setSettings({ ...(preferences ? backup.preferences : {}), onboarded: true });
    },
    [setSettings],
  );
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void sync(), 1500);
    return () => clearTimeout(t);
  }, [library, settings.syncKey, settings.syncProvider, ready, online, sync]);
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
  }, [sync, settings.syncKey, syncProvider, settings.healthChecks, ready]);
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
        online,
        toast,
        setSettings,
        setLibrary,
        update,
        add,
        sync: syncNow,
        connectGoogle,
        disconnectSync,
        restore,
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
