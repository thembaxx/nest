"use client";
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions -- Drag events supplement the accessible native file input. */
import { useState } from "react";
import { ArrowUpRight, Check, Link, LoaderCircle, Upload, FileUp } from "lucide-react";
import { Modal } from "./ui";
import { useLibrary } from "./library-provider";
import { classify, extractUrls, makeBookmark, parseImport, canonicalUrl } from "@/lib/bookmarks";
import { bookmarkSchema, listSchema, type Bookmark } from "@/lib/types";
import { celebrate } from "@/lib/celebrate";
export function AddDialog({
  onClose,
  initial = "",
  importMode = false,
}: {
  onClose: () => void;
  initial?: string;
  importMode?: boolean;
}) {
  const { add, library, settings, toast, setSettings } = useLibrary();
  const [text, setText] = useState(initial);
  const [tab, setTab] = useState(importMode ? "import" : "paste");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [listId, setListId] = useState("");
  const [error, setError] = useState("");
  const urls = extractUrls(text);
  const existing = new Set(
    library.bookmarks.filter((b) => !b.deletedAt).map((b) => canonicalUrl(b.url)),
  );
  const duplicateCount = urls.filter((u) => existing.has(canonicalUrl(u))).length;
  async function save() {
    setBusy(true);
    setError("");
    try {
      const bookmarks: Bookmark[] = [];
      for (let i = 0; i < urls.length; i += 4) {
        setProgress(
          `Getting to know your links · ${Math.min(i + 4, urls.length)} of ${urls.length}`,
        );
        const batch = await Promise.all(
          urls.slice(i, i + 4).map(async (url) => {
            const b = makeBookmark(url, { listIds: listId ? [listId] : [] });
            try {
              const r = await fetch("/api/metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
                signal: AbortSignal.timeout(12000),
              });
              if (r.ok) {
                const m = await r.json();
                if (m.title) b.title = m.title;
                if (m.description) b.description = m.description;
                b.status = m.status || "unchecked";
              }
            } catch {}
            b.topic = settings.autoSort
              ? classify(b.title + " " + b.description + " " + url)
              : "Unsorted";
            b.tags = b.topic === "Unsorted" ? [] : [b.topic.toLowerCase()];
            return b;
          }),
        );
        bookmarks.push(...batch);
      }
      const result = add(bookmarks);
      toast(
        `${result.added.length} bookmark${result.added.length === 1 ? "" : "s"} tucked away${result.duplicates ? ` · ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} skipped` : ""}`,
      );
      setSettings({ onboarded: true });
      if (result.added.length && settings.effects) void celebrate();
      onClose();
    } catch {
      setError("Could not add these links. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file: File) {
    setBusy(true);
    setError("");
    try {
      if (file.size > 20 * 1024 * 1024) throw Error("Please use a file smaller than 20 MB.");
      const parsed = parseImport(await file.text(), file.name);
      const bookmarks = parsed.bookmarks.map((b) => bookmarkSchema.parse(b));
      const lists = parsed.lists.map((l) => listSchema.parse(l));
      if (!bookmarks.length)
        throw Error(
          "No bookmarks found. Choose a browser HTML export or a Nest / Firefox / Chrome JSON file.",
        );
      const result = add(bookmarks, lists);
      toast(`Imported ${result.added.length} bookmarks · ${result.duplicates} duplicates skipped`);
      setSettings({ onboarded: true });
      if (result.added.length && settings.effects) void celebrate();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read this file.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={tab === "paste" ? "Something worth keeping." : "Bring your bookmarks home."}
      subtitle="A link, a handful, or your whole collection. We’ll take care of the sorting."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="segmented">
        <button className={tab === "paste" ? "active" : ""} onClick={() => setTab("paste")}>
          <Link size={16} /> Paste links
        </button>
        <button className={tab === "import" ? "active" : ""} onClick={() => setTab("import")}>
          <Upload size={16} /> Import bookmarks
        </button>
      </div>
      {tab === "paste" ? (
        <>
          <label className="field-label" htmlFor="links">
            Links or any text with links in it
          </label>
          <textarea
            id="links"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              "https://something-wonderful.com\n\nOr paste a whole conversation. Nest will find each link."
            }
            rows={6}
            maxLength={100000}
            disabled={busy}
          />
          <div className="input-hint">
            {urls.length ? (
              <>
                <Check size={14} /> {urls.length} link{urls.length === 1 ? "" : "s"} found
                {duplicateCount ? ` · ${duplicateCount} already saved` : ""}
              </>
            ) : (
              "Every link gets its own bookmark. Duplicates are skipped."
            )}
          </div>
          <label className="field-label" htmlFor="collection">
            Add to a collection <span>(optional)</span>
          </label>
          <select id="collection" value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">Just my library</option>
            {library.lists
              .filter((l) => !l.deletedAt)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <span>
              {busy
                ? progress
                : settings.autoSort
                  ? "✧ Topics will be added automatically"
                  : "Auto-sort is off in Settings"}
            </span>
            <button
              className="button primary"
              disabled={!urls.length || busy || urls.length > 100}
              onClick={() => void save()}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={17} />}{" "}
              {busy
                ? "Tucking away…"
                : `Save ${urls.length > 1 ? urls.length + " bookmarks" : "bookmark"}`}
            </button>
          </footer>
          {urls.length > 100 && (
            <p className="error">Paste up to 100 links at a time, or import a file.</p>
          )}
        </>
      ) : (
        <>
          <label
            htmlFor="import-file"
            className="import-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0] && !busy) void importFile(e.dataTransfer.files[0]);
            }}
          >
            <FileUp size={34} strokeWidth={1.2} />
            <strong>
              {busy ? "Making room for your collection…" : "Drop your bookmark file here"}
            </strong>
            <span>HTML from any browser, or JSON from Nest, Chrome, or Firefox</span>
            <span className="button secondary">
              Choose a file <ArrowUpRight size={15} />
            </span>
            <input
              id="import-file"
              type="file"
              accept=".html,.htm,.json"
              disabled={busy}
              onChange={(e) => {
                if (e.target.files?.[0]) void importFile(e.target.files[0]);
              }}
              aria-label="Choose bookmark import file"
            />
          </label>
          <div className="note-box">
            <strong>A fresh start, without starting over.</strong>
            <p>
              Your browser’s Bookmark Manager has an Export option. Nest keeps folder names as
              collections and quietly skips duplicate links.
            </p>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
