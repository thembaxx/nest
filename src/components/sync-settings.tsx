"use client";
import { useEffect, useState } from "react";
import {
  ArrowsClockwise,
  ArrowUpRight,
  Cloud,
  Copy,
  CircleNotch,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { useLibrary } from "./library-provider";
import { BackupSettings } from "./backup-settings";
import { activeSyncProvider, loadGoogleIdentity } from "@/lib/google-drive";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
export function SyncSettings() {
  const {
    library,
    settings,
    setSettings,
    setLibrary,
    syncState,
    syncError,
    sync,
    connectGoogle,
    disconnectSync,
    toast,
  } = useLibrary();
  const provider = activeSyncProvider(settings);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!googleClientId) return;
    let live = true;
    void loadGoogleIdentity()
      .then(() => {
        if (live) setGoogleReady(true);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Google sign-in could not load.");
      });
    return () => {
      live = false;
    };
  }, []);
  async function google() {
    setError("");
    setBusy(true);
    try {
      await connectGoogle(googleClientId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect Google Drive.");
    } finally {
      setBusy(false);
    }
  }
  async function enableNest() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/health", {
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.sync)
        throw Error(
          "Recovery-key sync is not configured on this site. Google Drive and local backups work without a Nest database.",
        );
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      setSettings({
        syncProvider: "nest",
        syncKey:
          settings.syncKey || [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""),
      });
      setShowKey(true);
      toast("Recovery-key sync enabled. Keep a copy of your key.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not reach the server. Try again when you’re online.",
      );
    } finally {
      setBusy(false);
    }
  }
  const status =
    syncState === "synced"
      ? "Up to date"
      : syncState === "syncing"
        ? "Syncing…"
        : syncState === "reconnect"
          ? "Reconnect Google Drive to sync this session"
          : syncState === "unconfigured"
            ? "Database connection needed"
            : syncState === "error"
              ? "Could not sync — will retry"
              : syncState === "offline"
                ? "Offline — changes are saved on this device"
                : "Ready to sync";
  const trash = library.bookmarks.filter((b) => b.deletedAt && !b.demo);
  return (
    <>
      <div className="settings-heading">
        <h3>Your library, wherever you land.</h3>
        <p>Choose Google Drive, recovery-key sync, or a file you can restore anywhere.</p>
      </div>
      {provider !== "local" && (
        <output className="sync-panel">
          <Cloud size={26} />
          <div>
            <strong>{provider === "google" ? "Google Drive sync" : "Recovery-key sync"}</strong>
            <p>{status}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Sync now"
            disabled={syncState === "syncing" || busy || syncState === "reconnect"}
            onClick={() => void sync()}
          >
            <ArrowsClockwise size={18} className={syncState === "syncing" ? "spin" : ""} />
          </button>
        </output>
      )}
      <div className="setting-row">
        <div>
          <h4>Google Drive</h4>
          <p>
            Recommended. Uses a small part of your own Google storage. Only Nest’s private app data
            is accessible.
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy || !googleReady || (provider === "google" && syncState !== "reconnect")}
          onClick={() => void google()}
        >
          {busy ? <CircleNotch size={16} className="spin" /> : <Cloud size={16} />}
          {provider === "google"
            ? syncState === "reconnect"
              ? "Reconnect Google Drive"
              : "Connected to Google Drive"
            : "Connect Google Drive"}
        </button>
      </div>
      <p className="small muted">
        {googleClientId
          ? "Connect the same Google account on each device. Sync runs while Nest is open and authorized. Google sign-in must be reconnected after a reload or when its short-lived access expires. Your library stays available offline."
          : "Google Drive is not enabled on this site yet. Local backup and restore are ready to use."}
      </p>
      {error && googleClientId && !googleReady && (
        <button
          className="text-button"
          onClick={() => {
            setError("");
            void loadGoogleIdentity()
              .then(() => setGoogleReady(true))
              .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : "Google sign-in could not load."),
              );
          }}
        >
          Try loading Google sign-in again
        </button>
      )}
      <div className="setting-row">
        <div>
          <h4>Recovery-key sync</h4>
          <p>
            Use this site’s optional cloud database. No Google account needed. Keep your recovery
            key safe.
          </p>
        </div>
        {provider !== "nest" && (
          <button className="button secondary" disabled={busy} onClick={() => void enableNest()}>
            Enable sync
          </button>
        )}
      </div>
      {settings.syncKey && (
        <>
          <button className="text-button" onClick={() => setShowKey(!showKey)}>
            {showKey ? "Hide" : "Show"} my recovery key
          </button>
          {showKey && (
            <div className="recovery-key">
              <code>{settings.syncKey}</code>
              <button
                className="icon-button"
                aria-label="Copy recovery key"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(settings.syncKey!)
                    .then(() => toast("Recovery key copied. Store it somewhere safe."))
                    .catch(() => toast("Select and copy the key above."))
                }
              >
                <Copy size={17} />
              </button>
            </div>
          )}
          <p className="small muted">
            Anyone with this key can access your recovery-key library. A lost key cannot be
            recovered.
          </p>
        </>
      )}
      <label className="field-label" htmlFor="recovery">
        Already have a Nest recovery key?
      </label>
      <div className="inline-input">
        <input
          id="recovery"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your recovery key"
        />
        <button
          className="button secondary"
          disabled={busy || !/^[a-f0-9]{64}$/.test(key.trim())}
          onClick={() => {
            setSettings({ syncProvider: "nest", syncKey: key.trim() });
            setKey("");
            setError("");
            toast("Connecting your library…");
          }}
        >
          Connect <ArrowUpRight size={15} />
        </button>
      </div>
      {provider !== "local" && (
        <button
          className="text-button"
          onClick={() => {
            disconnectSync();
            toast("Sync disconnected. Your device and cloud copies are kept.");
          }}
        >
          Disconnect this device
        </button>
      )}
      {(error || syncError) && (
        <p className="error" role="alert">
          {error || syncError}
        </p>
      )}
      <BackupSettings />
      {library.bookmarks.some((b) => b.demo) && (
        <div className="setting-row">
          <div>
            <h4>A fresh little canvas</h4>
            <p>Remove the sample bookmarks whenever you’re ready.</p>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              setLibrary((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => !b.demo) }));
              toast("Sample bookmarks cleared. Make yourself at home.");
            }}
          >
            Clear samples
          </button>
        </div>
      )}
      {trash.length > 0 && (
        <div className="trash-list">
          <h4>Recently removed · {trash.length}</h4>
          {trash.map((b) => (
            <div key={b.id}>
              <span>{b.title}</span>
              <button
                className="text-button"
                onClick={() => {
                  setLibrary((s) => ({
                    ...s,
                    bookmarks: s.bookmarks.map((x) =>
                      x.id === b.id
                        ? {
                            ...x,
                            deletedAt: undefined,
                            updatedAt: Math.max(Date.now(), x.updatedAt + 1),
                          }
                        : x,
                    ),
                  }));
                  toast("Bookmark restored.");
                }}
              >
                <ArrowCounterClockwise size={14} /> Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
