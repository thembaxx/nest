"use client";
import { useEffect, useState } from "react";
import { ArrowsClockwise, Cloud, Copy, Download, Shield } from "@phosphor-icons/react";
import { RevisionHistory } from "./revision-history";
import { useLibrary } from "./library-provider";
import {
  createBackup,
  encryptedBackup,
  readBackup,
  restoreLibrary,
  type Backup,
} from "@/lib/backup";
import { exportHtml } from "@/lib/bookmarks";
import {
  MAX_BACKUP_BYTES,
  normalizeRecoveryKey,
  recoveryKey,
  validRecoveryKey,
} from "@/lib/encryption";
import { activeSyncProvider, googleDriveConfigured, prepareGoogleSignIn } from "@/lib/google-drive";

function download(data: string, extension: string, type: string) {
  if (new TextEncoder().encode(data).byteLength > MAX_BACKUP_BYTES)
    throw Error("This export exceeds the 20 MB file limit.");
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nest-backup-${new Date().toISOString().slice(0, 10)}.${extension}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SyncDataSettings() {
  const {
    library,
    settings,
    setSettings,
    setLibrary,
    syncState,
    syncError,
    lastSyncedAt,
    driveConnected,
    connectGoogle,
    disconnectGoogle,
    sync,
    toast,
  } = useLibrary();
  const [driveKey, setDriveKey] = useState("");
  const [legacyKey, setLegacyKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [file, setFile] = useState<File>();
  const [restorePassword, setRestorePassword] = useState("");
  const [preview, setPreview] = useState<Backup | null>(null);
  const [restorePreferences, setRestorePreferences] = useState(true);
  // Preload only when this settings panel opens, before a mobile tap needs a popup.
  useEffect(() => {
    prepareGoogleSignIn();
  }, []);
  const legacyConnected = activeSyncProvider(settings) === "nest";
  const status =
    syncState === "synced"
      ? "Up to date"
      : syncState === "syncing"
        ? "Syncing…"
        : syncState === "reconnect"
          ? "Reconnect Google to resume sync"
          : syncState === "offline"
            ? "Offline — saved changes will sync after reconnecting"
            : syncState === "unconfigured"
              ? "Cloud sync is unavailable"
              : syncState === "error"
                ? "Could not sync — your device copy is safe"
                : "Saved on this device";

  async function run(task: string, action: () => Promise<void>) {
    setBusy(task);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy("");
    }
  }
  function keyDisplay(key: string) {
    const grouped = key.match(/.{1,8}/g)?.join(" ") ?? key;
    const copyKey = async () => {
      try {
        await navigator.clipboard.writeText(key);
        toast("Recovery key copied. Keep it in a private, safe place.");
      } catch {
        setShowKey(true);
        toast("Clipboard unavailable. Show and select the recovery key instead.");
      }
    };
    return (
      <div className="sync-recovery">
        <div className="flex-gap">
          <button
            type="button"
            className="text-button"
            aria-expanded={showKey}
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? "Hide" : "Show"} my recovery key
          </button>
          <button type="button" className="button secondary" onClick={() => void copyKey()}>
            <Copy size={16} /> Copy recovery key
          </button>
        </div>
        {showKey && (
          <div className="recovery-key">
            <code>{grouped}</code>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="sync-data-settings">
      <div className="settings-heading">
        <h3>Your library, wherever you land.</h3>
        <p>
          Keep saving offline. Connect Google Drive once to sync your personal bookmarks across
          devices, or export a private backup anytime.
        </p>
      </div>
      <div className="privacy-note">
        <Shield size={23} />
        <div>
          <strong>Your Drive library is encrypted on this device.</strong>
          <p>
            Google Drive receives an encrypted library. Keep your recovery key to unlock it on
            another device. Nest cannot recover a lost key.
          </p>
        </div>
      </div>
      {!settings.driveKey && (
        <div className="note-box" aria-label="Start Google Drive sync">
          <strong>New to sync? Start here.</strong>
          <p>
            1. Connect your Google account below. 2. Save the recovery key that appears. 3. Use that
            same account and key on your other devices.
          </p>
        </div>
      )}
      <div className="sync-panel">
        <Cloud size={26} />
        <div>
          <strong>{settings.driveKey ? "Google Drive sync" : "Sync with Google Drive"}</strong>
          <output aria-live="polite">
            {settings.driveKey
              ? status
              : "Bookmarks, collections, notes, and trash stay together across your devices."}
          </output>
          {settings.driveKey && lastSyncedAt && (
            <p>Last synced {new Date(lastSyncedAt).toLocaleTimeString()}</p>
          )}
        </div>
        {settings.driveKey ? (
          <button
            className="button secondary"
            disabled={!!busy || syncState === "syncing"}
            onPointerEnter={prepareGoogleSignIn}
            onFocus={prepareGoogleSignIn}
            onClick={() =>
              void run("google", async () => {
                if (driveConnected) await sync();
                else await connectGoogle();
              })
            }
          >
            <ArrowsClockwise size={16} className={syncState === "syncing" ? "spin" : ""} />
            {driveConnected ? "Sync now" : "Reconnect Google"}
          </button>
        ) : (
          <button
            className="button primary"
            disabled={!googleDriveConfigured || !!busy}
            onPointerEnter={prepareGoogleSignIn}
            onFocus={prepareGoogleSignIn}
            onClick={() =>
              void run("google", async () => {
                await connectGoogle();
                setShowKey(true);
                toast("Connected! Copy your recovery key before setting up another device.");
              })
            }
          >
            {busy === "google" ? "Connecting…" : "Set up Google Drive"}
          </button>
        )}
      </div>
      {!googleDriveConfigured && (
        <p className="small muted">
          Google Drive sync is unavailable on this installation. You can use a backup below.
        </p>
      )}
      {!settings.driveKey && settings.drivePendingKey && (
        <>
          <p className="small muted">
            A recovery key is saved for your pending connection. Keep a copy before retrying setup.
            To open an existing library, enter its original key below.
          </p>
          {keyDisplay(settings.drivePendingKey)}
        </>
      )}
      {settings.driveKey ? (
        <>
          <div className="note-box" aria-label="Set up another device">
            <strong>Next: connect another device</strong>
            <p>
              Copy your recovery key, then open Nest on your other device. Choose “Already syncing
              on another device?”, paste the key and select the same Google account. Keep the key in
              your password manager — Nest cannot recover it for you.
            </p>
            {keyDisplay(settings.driveKey)}
          </div>
          <p className="small muted">
            Your encrypted library stays in Google Drive. After reopening Nest, tap “Reconnect
            Google” to resume sync; changes made offline remain on this device until then.
          </p>
          <button
            className="text-button"
            disabled={!!busy}
            onClick={() => {
              disconnectGoogle();
              setShowKey(false);
              toast("Google Drive disconnected. Your local and Drive copies remain.");
            }}
          >
            Disconnect Google on this device
          </button>
        </>
      ) : (
        <>
          {settings.syncKey && (
            <p className="small muted">
              Connecting Google Drive stops legacy cloud sync on this device. The existing server
              copy remains.
            </p>
          )}
          <div className="note-box" aria-label="Connect an existing library">
            <strong>Already have Nest on another device?</strong>
            <p>
              Get the recovery key from that device under Settings → Sync &amp; data. Use the same
              Google account here; this merges both devices without replacing bookmarks.
            </p>
            <label className="field-label" htmlFor="drive-recovery">
              Already syncing on another device?
            </label>
            <div className="inline-input">
              <input
                id="drive-recovery"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={driveKey}
                onChange={(event) => setDriveKey(event.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="Paste your 64-character recovery key"
              />
              <button
                className="button secondary"
                disabled={
                  !googleDriveConfigured ||
                  !validRecoveryKey(normalizeRecoveryKey(driveKey)) ||
                  !!busy
                }
                onPointerEnter={prepareGoogleSignIn}
                onFocus={prepareGoogleSignIn}
                onClick={() =>
                  void run("google", async () => {
                    await connectGoogle(normalizeRecoveryKey(driveKey));
                    setDriveKey("");
                    toast("Your encrypted Google Drive library is connected.");
                  })
                }
              >
                Connect Google Drive
              </button>
            </div>
            {driveKey && !validRecoveryKey(normalizeRecoveryKey(driveKey)) && (
              <output className="small muted">
                Enter all 64 characters of the recovery key. Spaces and hyphens are okay.
              </output>
            )}
          </div>
        </>
      )}
      <p className="small muted">
        Only Nest’s hidden app storage is requested. Your other Drive files are inaccessible to
        Nest. Google can see account and request metadata. Scheduled server link checks do not run
        on encrypted Drive data.
      </p>
      {syncError && (
        <p className="error" role="alert">
          {syncError}
        </p>
      )}

      <section className="backup-section" aria-label="Local backup and restore">
        <div className="settings-heading">
          <h3>Backup &amp; export</h3>
          <p>
            Download a portable copy whenever you want. Encrypted backups include your bookmarks,
            collections, notes, trash, and safe preferences — never your Google session or recovery
            key.
          </p>
        </div>
        <label className="field-label" htmlFor="backup-password">
          Backup password (at least 12 characters)
        </label>
        <input
          id="backup-password"
          disabled={!!busy}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <label className="field-label" htmlFor="backup-confirmation">
          Confirm backup password
        </label>
        <input
          id="backup-confirmation"
          disabled={!!busy}
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <button
          className="button secondary"
          disabled={!!busy || password.length < 12 || password !== confirmation}
          onClick={() =>
            void run("backup", async () => {
              const data = await encryptedBackup(library, settings, password);
              download(JSON.stringify(data), "nest", "application/json");
              setPassword("");
              setConfirmation("");
              toast("Encrypted backup downloaded. Keep its password in a safe place.");
            })
          }
        >
          <Download size={16} />
          {busy === "backup" ? "Encrypting…" : "Download encrypted backup"}
        </button>
        <p className="small muted">
          Keep the file and password somewhere safe. Move the file to your new device, choose it
          below, and enter its password. Lost passwords cannot be recovered.
        </p>
        <div className="setting-row">
          <div>
            <h4>Other export formats</h4>
            <p>
              JSON is a full unencrypted backup. HTML exports active links for other browsers.
              Anyone with these files can read them.
            </p>
          </div>
          <div className="flex-gap">
            <button
              className="button secondary"
              onClick={() =>
                void run("json", async () =>
                  download(
                    JSON.stringify(createBackup(library, settings), null, 2),
                    "json",
                    "application/json",
                  ),
                )
              }
            >
              JSON <Download size={14} />
            </button>
            <button
              className="button secondary"
              onClick={() =>
                void run("html", async () => download(exportHtml(library), "html", "text/html"))
              }
            >
              HTML <Download size={14} />
            </button>
          </div>
        </div>
        <h4>Restore on this device</h4>
        <label className="field-label" htmlFor="backup-file">
          Choose a Nest backup (.nest or .json, up to 20 MB)
        </label>
        <input
          id="backup-file"
          disabled={!!busy}
          type="file"
          accept=".nest,.json,application/json"
          onChange={(event) => {
            setFile(event.target.files?.[0]);
            setPreview(null);
            setRestorePassword("");
            setError("");
            event.target.value = "";
          }}
        />
        {file && <p className="small muted">Selected: {file.name}</p>}
        <label className="field-label" htmlFor="restore-password">
          Backup password (for encrypted files)
        </label>
        <input
          id="restore-password"
          disabled={!!busy}
          type="password"
          autoComplete="off"
          value={restorePassword}
          onChange={(event) => {
            setRestorePassword(event.target.value);
            setPreview(null);
          }}
        />
        <button
          className="button secondary"
          disabled={!file || !!busy}
          onClick={() =>
            void run("restore", async () => {
              setPreview(null);
              if (file!.size > MAX_BACKUP_BYTES) throw Error("Choose a backup smaller than 20 MB.");
              setPreview(await readBackup(await file!.text(), restorePassword));
            })
          }
        >
          {busy === "restore" ? "Opening…" : "Preview backup"}
        </button>
        {preview && (
          <section className="note-box" aria-label="Backup preview" aria-live="polite">
            <strong>
              {preview.library.bookmarks.filter((bookmark) => !bookmark.deletedAt).length} bookmarks
              · {preview.library.lists.filter((list) => !list.deletedAt).length} collections ·{" "}
              {preview.library.bookmarks.filter((bookmark) => bookmark.deletedAt).length} in trash
            </strong>
            <p>
              Merge into this device. Newer changes win and existing bookmarks stay. Connected sync
              will include restored changes.
            </p>
            {preview.preferences && (
              <label className="restore-preferences">
                <input
                  type="checkbox"
                  checked={restorePreferences}
                  onChange={(event) => setRestorePreferences(event.target.checked)}
                />
                Restore appearance and preferences
              </label>
            )}
            <button
              className="button primary"
              disabled={!!busy}
              onClick={() =>
                void run("apply-restore", async () => {
                  setLibrary(restoreLibrary(library, preview.library));
                  if (restorePreferences && preview.preferences) setSettings(preview.preferences);
                  setPreview(null);
                  setFile(undefined);
                  setRestorePassword("");
                  toast("Backup restored and merged with this device’s library.");
                })
              }
            >
              Restore backup
            </button>
          </section>
        )}
      </section>

      <RevisionHistory />
      <details className="legacy-sync">
        <summary>Legacy Nest cloud sync{legacyConnected ? " · connected" : ""}</summary>
        <p className="small muted">
          This older option sends readable bookmark records to Nest’s server. It is not end-to-end
          encrypted. Google Drive and local encrypted backups provide encryption before upload.
        </p>
        {legacyConnected && settings.syncKey ? (
          <>
            <output>{status}</output>
            {keyDisplay(settings.syncKey)}
            <p className="small muted">
              Anyone with this key can access the cloud copy. Disconnecting keeps both local and
              cloud records.
            </p>
            <div className="flex-gap">
              <button className="button secondary" onClick={() => void sync()}>
                Sync legacy cloud
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setSettings({ syncKey: undefined, syncProvider: "local" });
                  setShowKey(false);
                }}
              >
                Disconnect legacy sync
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              className="button secondary"
              disabled={!!settings.driveKey || !!busy}
              onClick={() =>
                void run("legacy", async () => {
                  const response = await fetch("/api/health", {
                    cache: "no-store",
                    signal: AbortSignal.timeout(15000),
                  });
                  if (!response.ok || !(await response.json()).sync)
                    throw Error(
                      "Legacy cloud sync is unavailable. Your bookmarks are saved on this device.",
                    );
                  setSettings({ syncKey: settings.syncKey || recoveryKey() });
                  setShowKey(true);
                })
              }
            >
              Enable legacy sync
            </button>
            <label className="field-label" htmlFor="legacy-recovery">
              Existing Nest cloud recovery key
            </label>
            <div className="inline-input">
              <input
                id="legacy-recovery"
                type="password"
                autoComplete="off"
                value={legacyKey}
                onChange={(event) => setLegacyKey(event.target.value)}
                placeholder="Paste your recovery key"
              />
              <button
                className="button secondary"
                disabled={!!settings.driveKey || !validRecoveryKey(legacyKey.trim()) || !!busy}
                onClick={() => {
                  setSettings({ syncKey: legacyKey.trim().toLowerCase() });
                  setLegacyKey("");
                }}
              >
                Connect legacy sync
              </button>
            </div>
          </>
        )}
      </details>
      {error && error !== syncError && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
