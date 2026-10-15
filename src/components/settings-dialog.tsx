"use client";
import { useState } from "react";
import {
  Cloud,
  Copy,
  Download,
  Check,
  CircleNotch as LoaderCircle,
  Desktop as Monitor,
  Sun,
  Moon,
  Trash as Trash2,
  ArrowsClockwise as RefreshCw,
  Shield,
  ArrowUpRight,
  ArrowCounterClockwise as RotateCcw,
  DeviceMobile as Smartphone,
} from "@phosphor-icons/react";
import { Modal } from "./ui";
import { useLibrary } from "./library-provider";
import { models, loadModel, removeModel } from "@/lib/ai";
import { exportHtml } from "@/lib/bookmarks";
import type { Settings } from "@/lib/types";
export function SettingsDialog({
  onClose,
  onInstall,
  initialTab = "general",
}: {
  onClose: () => void;
  onInstall: () => void;
  initialTab?: string;
}) {
  const { library, settings, setSettings, setLibrary, syncState, sync, toast } = useLibrary();
  const [tab, setTab] = useState(initialTab);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [modelBusy, setModelBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [cloudReady, setCloudReady] = useState<boolean | null>(null);
  function download(format: "json" | "html") {
    const data =
      format === "json"
        ? JSON.stringify(
            {
              bookmarks: library.bookmarks.filter((b) => !b.demo && !b.deletedAt),
              lists: library.lists.filter((l) => !l.deletedAt),
            },
            null,
            2,
          )
        : exportHtml(library);
    const url = URL.createObjectURL(
      new Blob([data], { type: format === "json" ? "application/json" : "text/html" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `nest-bookmarks-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function enableSync() {
    setChecking(true);
    setError("");
    try {
      const r = await fetch("/api/health");
      const data = await r.json();
      setCloudReady(data.sync);
      if (!data.sync) {
        setError(
          "Cloud sync is waiting for a database connection. Your bookmarks are saved on this device.",
        );
        return;
      }
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      setSettings({ syncKey: [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("") });
      setShowKey(true);
      toast("Cloud sync enabled. Keep a copy of your recovery key.");
    } catch {
      setError("Could not reach the server. Try again when you’re online.");
    } finally {
      setChecking(false);
    }
  }
  async function model(id: string) {
    setModelBusy(id);
    setError("");
    setProgress(0);
    try {
      await loadModel(id, (p, t) => {
        setProgress(p);
        setStatus(t);
      });
      setSettings({ model: id });
      toast("Your local companion is ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This model could not load on your device.");
    } finally {
      setModelBusy("");
    }
  }
  const trash = library.bookmarks.filter((b) => b.deletedAt && !b.demo);
  return (
    <Modal
      title="Make yourself at home."
      subtitle="A few thoughtful preferences. Everything else can take care of itself."
      onClose={onClose}
      wide
    >
      <div className="settings-tabs">
        {[
          ["general", "Preferences"],
          ["ai", "Local AI"],
          ["sync", "Sync & data"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "general" ? (
        <>
          <div className="settings-heading">
            <h3>Your kind of light</h3>
            <p>From the browser chrome to your home screen, it all belongs together.</p>
          </div>
          <div className="theme-choices">
            {[
              ["system", "System", Monitor],
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
            ].map(([id, label, Icon]) => {
              const I = Icon as typeof Monitor;
              return (
                <button
                  key={id as string}
                  className={settings.theme === id ? "active" : ""}
                  onClick={() => setSettings({ theme: id as Settings["theme"] })}
                >
                  <I size={21} />
                  {label as string}
                  {settings.theme === id && <Check size={14} />}
                </button>
              );
            })}
          </div>
          <Toggle
            title="A little automatic organization"
            description="Find topics and file new bookmarks into matching folders. Your chosen folders come first."
            value={settings.autoSort}
            onChange={(v) => setSettings({ autoSort: v })}
          />
          <Toggle
            title="Keep an eye on my links"
            description="Check synced bookmarks weekly and collect repeatedly missing pages in Broken links. Runs daily in batches."
            value={settings.healthChecks}
            onChange={(v) => setSettings({ healthChecks: v })}
          />
          <Toggle
            title="Small moments of delight"
            description="Gentle motion and a little celebration when something is saved. Respects reduced motion."
            value={settings.effects}
            onChange={(v) => setSettings({ effects: v })}
          />
          <div className="setting-row">
            <div>
              <h4>A place on your home screen</h4>
              <p>Open faster, share links to Nest, and browse your saved library offline.</p>
            </div>
            <button className="button secondary" onClick={onInstall}>
              <Smartphone size={16} /> Install Nest
            </button>
          </div>
          <p className="small muted">
            In list view, swipe right to mark a bookmark read, or left to favorite it.
          </p>
        </>
      ) : tab === "ai" ? (
        <>
          <div className="privacy-note">
            <Shield size={23} />
            <div>
              <strong>A companion that stays with you.</strong>
              <p>
                Optional, free, and private. After the first download, the model runs on your
                device. Your bookmarks aren’t sent to an AI service.
              </p>
            </div>
          </div>
          <p className="small muted">
            Requires WebGPU and enough free memory. Download sizes are approximate; browser storage
            may be cleared by your device. No download starts automatically.
          </p>
          <div className="model-list">
            {models.map((m) => (
              <div className="model-row" key={m.id}>
                <div>
                  <h4>
                    {m.name}
                    {settings.model === m.id && <span className="tiny-badge">Selected</span>}
                  </h4>
                  <p>{m.description}</p>
                  <span>
                    {m.size} download · {m.memory} recommended
                  </span>
                </div>
                <div className="model-actions">
                  <button
                    className="button secondary"
                    disabled={!!modelBusy}
                    onClick={() => void model(m.id)}
                  >
                    {modelBusy === m.id ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Download size={15} />
                    )}{" "}
                    {settings.model === m.id ? "Load" : "Download"}
                  </button>
                  {settings.model === m.id && (
                    <button
                      className="icon-button"
                      aria-label={`Remove ${m.name}`}
                      onClick={() =>
                        void removeModel(m.id)
                          .then(() => {
                            setSettings({ model: undefined });
                            toast("Model removed from browser storage.");
                          })
                          .catch(() =>
                            setError("Could not clear the model cache. Please try again."),
                          )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {modelBusy && (
            <div className="download-progress">
              <progress value={progress} max={1} />
              <p>
                {Math.round(progress * 100)}% · {status}
              </p>
            </div>
          )}
          <div className="note-box">
            <strong>Finding is fast. Changes stay in your hands.</strong>
            <p>
              Ask “Find the articles about accessible interfaces” or “Move my gardening links to
              Slow living.” Nest previews changes before applying them. For now, local AI considers
              up to 24 relevant bookmarks at a time, selected from your library.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="settings-heading">
            <h3>Your library, wherever you land.</h3>
            <p>Sync with a private recovery key. No account or password to remember.</p>
          </div>
          <div className="sync-panel">
            <Cloud size={26} />
            <div>
              <strong>
                {settings.syncKey
                  ? "Cloud sync is enabled"
                  : "Start with this device. Grow from here."}
              </strong>
              <p>
                {settings.syncKey
                  ? `Status: ${syncState === "synced" ? "Up to date" : syncState === "syncing" ? "Syncing…" : syncState === "unconfigured" ? "Database connection needed" : syncState === "error" ? "Could not sync — will retry" : syncState === "offline" ? "Offline — changes will sync later" : "Ready to sync"}`
                  : "Your library is already saved in this browser. Cloud sync keeps your own bookmarks together across devices."}
              </p>
            </div>
            {settings.syncKey ? (
              <button className="icon-button" aria-label="Sync now" onClick={() => void sync()}>
                <RefreshCw size={18} className={syncState === "syncing" ? "spin" : ""} />
              </button>
            ) : (
              <button
                className="button primary"
                disabled={checking}
                onClick={() => void enableSync()}
              >
                {checking ? <LoaderCircle size={16} className="spin" /> : null} Enable sync
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
                This key grants access to your library. Keep it safe and paste it into Nest on your
                other devices. It cannot be recovered if lost.
              </p>
              <button
                className="text-button"
                onClick={() => {
                  setSettings({ syncKey: undefined });
                  toast("Sync disconnected. Your device copy is still here.");
                }}
              >
                Disconnect this device
              </button>
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
              disabled={!/^[a-f0-9]{64}$/.test(key.trim())}
              onClick={() => {
                setSettings({ syncKey: key.trim() });
                setKey("");
                toast("Connecting your library…");
              }}
            >
              Connect <ArrowUpRight size={15} />
            </button>
          </div>
          {cloudReady === false && (
            <p className="small muted">
              For the site owner: connect a free Neon database in the Vercel project’s Storage tab,
              then retry.
            </p>
          )}
          <div className="setting-row">
            <div>
              <h4>Keep a copy for yourself</h4>
              <p>JSON keeps your collections, tags, and notes. HTML works with any browser.</p>
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
                          x.id === b.id ? { ...x, deletedAt: undefined, updatedAt: Date.now() } : x,
                        ),
                      }));
                      toast("Bookmark restored.");
                    }}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
function Toggle({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={title}
        className={`toggle ${value ? "on" : ""}`}
        onClick={() => onChange(!value)}
      >
        <span />
      </button>
    </div>
  );
}
