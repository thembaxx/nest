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
type SyncState = "local" | "syncing" | "synced" | "offline" | "error" | "unconfigured";
type Context = {
  library: Library;
  settings: Settings;
  ready: boolean;
  syncState: SyncState;
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
};
const LibraryContext = createContext<Context | null>(null);
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<Library>(seed);
  const [settings, applySettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>("local");
  const [message, setMessage] = useState("");
  const current = useRef(library);
  const settingsRef = useRef(settings);
  const syncing = useRef(false);
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
  const setSettings = useCallback(
    (change: Partial<Settings>) => applySettings((s) => ({ ...s, ...change })),
    [],
  );
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
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", dark ? "#1b211d" : "#f7f6f2"));
    const media = matchMedia("(prefers-color-scheme: dark)");
    const change = () => {
      if (settings.theme === "system") {
        document.documentElement.dataset.theme = media.matches ? "dark" : "light";
        document
          .querySelectorAll('meta[name="theme-color"]')
          .forEach((meta) => meta.setAttribute("content", media.matches ? "#1b211d" : "#f7f6f2"));
      }
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [settings, ready, toast]);
  const sync = useCallback(async () => {
    const key = settingsRef.current.syncKey;
    if (!key) {
      setSyncState("local");
      return;
    }
    if (!navigator.onLine) {
      setSyncState("offline");
      return;
    }
    if (syncing.current) return;
    syncing.current = true;
    setSyncState("syncing");
    try {
      const outgoing = prepareSyncLibrary(current.current);
      const r = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          bookmarks: outgoing.bookmarks.filter((b) => !b.demo),
          lists: outgoing.lists,
          healthChecks: settingsRef.current.healthChecks,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (settingsRef.current.syncKey !== key) return;
      if (r.status === 503) {
        setSyncState("unconfigured");
        return;
      }
      if (!r.ok) throw Error("Sync failed");
      const incoming = librarySchema.parse(await r.json());
      setLibrary((local) => {
        const merged = mergeLibrary(prepareSyncLibrary(local), incoming);
        return JSON.stringify(merged) === JSON.stringify(local) ? local : merged;
      });
      setSyncState("synced");
    } catch {
      if (settingsRef.current.syncKey === key) setSyncState(navigator.onLine ? "error" : "offline");
    } finally {
      syncing.current = false;
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void sync(), 1500);
    return () => clearTimeout(t);
  }, [library, settings.syncKey, ready, online, sync]);
  useEffect(() => {
    if (!ready || !settings.syncKey) return;
    const interval = setInterval(() => void sync(), 30000);
    const visibility = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [sync, settings.syncKey, ready]);
  const update = useCallback(
    (id: string, changes: Partial<Bookmark>) =>
      setLibrary((s) => ({
        ...s,
        bookmarks: s.bookmarks.map((b) =>
          b.id === id ? { ...b, ...changes, updatedAt: Date.now() } : b,
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
        online,
        toast,
        setSettings,
        setLibrary,
        update,
        add,
        sync,
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
