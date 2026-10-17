"use client";
import { useRef, useState } from "react";
import { Download, Upload } from "@phosphor-icons/react";
import { useLibrary } from "./library-provider";
import { createBackup, MAX_BACKUP_BYTES, parseBackup, type Backup } from "@/lib/backup";
import { exportHtml } from "@/lib/bookmarks";

export function BackupSettings() {
  const { library, settings, restore, toast } = useLibrary();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: Backup; name: string } | null>(null);
  const [preferences, setPreferences] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function download(format: "json" | "html") {
    setError("");
    try {
      const data = format === "json" ? createBackup(library, settings) : exportHtml(library);
      const url = URL.createObjectURL(
        new Blob([data], {
          type: format === "json" ? "application/json" : "text/html",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `nest-${format === "json" ? "backup" : "bookmarks"}-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your backup.");
    }
  }
  async function choose(file: File) {
    setError("");
    setPending(null);
    setBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw Error("Please choose a Nest backup smaller than 20 MB.");
      setPending({ backup: parseBackup(await file.text()), name: file.name });
      setPreferences(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this backup.");
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    if (!pending) return;
    try {
      restore(pending.backup, preferences);
      setPending(null);
      setError("");
      toast("Backup restored. Your existing bookmarks are kept.");
    } catch {
      setError("This backup would exceed Nest’s library limits. Your library has not changed.");
    }
  }
  const records = pending?.backup.library;
  const activeCount = records?.bookmarks.filter((b) => !b.deletedAt).length ?? 0;
  const collectionCount = records?.lists.filter((l) => !l.deletedAt).length ?? 0;
  const removedCount = records?.bookmarks.filter((b) => b.deletedAt).length ?? 0;
  return (
    <>
      <div className="setting-row">
        <div>
          <h4>A backup you can take with you</h4>
          <p>
            JSON keeps collections, notes, tags, favorites, trash, and preferences. HTML opens in
            other browsers.
          </p>
        </div>
        <div className="flex-gap">
          <button className="button secondary" onClick={() => download("json")}>
            JSON <Download size={14} />
          </button>
          <button className="button secondary" onClick={() => download("html")}>
            HTML <Download size={14} />
          </button>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <h4>Restore on this device</h4>
          <p>Choose a Nest JSON backup, including older exports. Review it before restoring.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          aria-label="Choose Nest backup to restore"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void choose(file);
          }}
        />
        <button className="button secondary" disabled={busy} onClick={() => input.current?.click()}>
          <Upload size={14} /> {busy ? "Reading backup…" : "Choose backup"}
        </button>
      </div>
      {pending && records && (
        <section className="note-box backup-preview" aria-label="Backup preview">
          <strong>{pending.name}</strong>
          <p>
            {activeCount} bookmark{activeCount === 1 ? "" : "s"} · {collectionCount} collection
            {collectionCount === 1 ? "" : "s"} · {removedCount} removed bookmark
            {removedCount === 1 ? "" : "s"}
            {pending.backup.exportedAt
              ? ` · Saved ${new Date(pending.backup.exportedAt).toLocaleDateString()}`
              : ""}
          </p>
          <p>
            Combines with this device’s library. Newer versions of the same record win, including
            removals. Restored changes also reach your connected sync service.
          </p>
          {pending.backup.preferences && (
            <label className="backup-preferences">
              <input
                type="checkbox"
                checked={preferences}
                onChange={(event) => setPreferences(event.target.checked)}
              />
              Restore appearance and preferences
            </label>
          )}
          <div className="flex-gap">
            <button className="button primary" onClick={apply}>
              Restore backup
            </button>
            <button className="button secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}
      <p className="small muted">
        Save the JSON file to your device, Google Drive, iCloud Drive, OneDrive, or Dropbox. On your
        next device, open Nest and choose Restore. Backups contain private notes and are not
        encrypted; sync keys and sign-in tokens are excluded.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
