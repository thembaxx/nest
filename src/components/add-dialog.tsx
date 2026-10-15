"use client";
/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions -- Drag events supplement the accessible native file input. */
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  LinkSimple,
  CircleNotch,
  Upload,
  FileArrowUp,
  Folder,
  Sparkle,
} from "@phosphor-icons/react";
import { Modal } from "./ui";
import { useLibrary } from "./library-provider";
import { classify, makeBookmark, parseImport, canonicalUrl } from "@/lib/bookmarks";
import { cleanFolderName, folderKey, parsePaste } from "@/lib/paste";
import { bookmarkSchema, listSchema, type Bookmark } from "@/lib/types";
import { celebrate } from "@/lib/celebrate";
export function AddDialog({
  onClose,
  initial = "",
  importMode = false,
  initialCollection = "",
}: {
  onClose: () => void;
  initial?: string;
  importMode?: boolean;
  initialCollection?: string;
}) {
  const { add, library, settings, toast, setSettings } = useLibrary();
  const [text, setText] = useState(initial);
  const [tab, setTab] = useState(importMode ? "import" : "paste");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [folderOverride, setFolderOverride] = useState<string | null>(null);
  const [error, setError] = useState("");
  const entries = useMemo(() => parsePaste(text), [text]);
  const urls = [...new Set(entries.map((entry) => entry.url))];
  const inferredFolders = [
    ...new Set(entries.map((entry) => entry.folderName).filter((name): name is string => !!name)),
  ];
  const folderValue =
    folderOverride ??
    (inferredFolders.length === 1
      ? inferredFolders[0]
      : inferredFolders.length
        ? ""
        : initialCollection);
  const activeLists = library.lists.filter((list) => !list.deletedAt);
  const existing = new Map(
    library.bookmarks
      .filter((bookmark) => !bookmark.deletedAt)
      .map((bookmark) => [canonicalUrl(bookmark.url), bookmark]),
  );
  const duplicateCount = urls.filter((url) => existing.has(canonicalUrl(url))).length;
  function destination(entry: (typeof entries)[number]) {
    return folderOverride !== null
      ? cleanFolderName(folderOverride)
      : entry.folderName || initialCollection;
  }
  function announce(
    result: { added: Bookmark[]; duplicates: number; filed: number; moved: number },
    importing = false,
  ) {
    const summary = result.added.length
      ? `${importing ? "Imported" : "Saved"} ${result.added.length} new bookmark${result.added.length === 1 ? "" : "s"}`
      : result.moved
        ? `Moved ${result.moved} existing bookmark${result.moved === 1 ? "" : "s"}`
        : `${result.duplicates} bookmark${result.duplicates === 1 ? "" : "s"} already saved`;
    toast(
      `${summary}${result.added.length && result.moved ? ` · ${result.moved} moved` : result.filed && !result.moved ? ` · ${result.filed} filed in folders` : ""}`,
    );
    setSettings({ onboarded: true });
    if (result.added.length && settings.effects) void celebrate();
    onClose();
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const prepared = new Map<string, Bookmark>();
      for (let i = 0; i < urls.length; i += 4) {
        setProgress(
          `Getting to know your links · ${Math.min(i + 4, urls.length)} of ${urls.length}`,
        );
        await Promise.all(
          urls.slice(i, i + 4).map(async (url) => {
            const old = existing.get(canonicalUrl(url));
            const bookmark = makeBookmark(url);
            if (old) {
              prepared.set(url, bookmark);
              return;
            }
            try {
              const response = await fetch("/api/metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
                signal: AbortSignal.timeout(12000),
              });
              if (response.ok) {
                const metadata = await response.json();
                if (metadata.title) bookmark.title = String(metadata.title).slice(0, 500);
                if (metadata.description)
                  bookmark.description = String(metadata.description).slice(0, 2000);
                if (["healthy", "unreachable", "dead", "unchecked"].includes(metadata.status))
                  bookmark.status = metadata.status;
              }
            } catch {}
            const context = entries
              .filter((entry) => entry.url === url)
              .map((entry) => entry.context)
              .join(" ");
            bookmark.topic = settings.autoSort
              ? classify(`${bookmark.title} ${bookmark.description} ${url} ${context}`)
              : "Unsorted";
            bookmark.tags = bookmark.topic === "Unsorted" ? [] : [bookmark.topic.toLowerCase()];
            prepared.set(url, bookmark);
          }),
        );
      }
      const folders: Record<string, string> = {};
      const bookmarks = entries.map((entry) => {
        const bookmark = { ...prepared.get(entry.url)!, id: crypto.randomUUID() };
        const folder = destination(entry);
        if (folder) folders[bookmark.id] = folder;
        return bookmarkSchema.parse(bookmark);
      });
      announce(
        add(bookmarks, [], { autoOrganize: settings.autoSort, folders, moveExisting: true }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add these links. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file: File) {
    setBusy(true);
    setError("");
    try {
      if (file.size > 20 * 1024 * 1024) throw Error("Please use a file smaller than 20 MB.");
      const parsed = parseImport(await file.text(), file.name, { autoOrganize: settings.autoSort });
      const bookmarks = parsed.bookmarks.map((bookmark) => bookmarkSchema.parse(bookmark));
      const lists = parsed.lists.map((list) => listSchema.parse(list));
      if (!bookmarks.length)
        throw Error(
          "No bookmarks found. Choose a browser HTML export or a Nest / Firefox / Chrome JSON file.",
        );
      announce(add(bookmarks, lists), true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read this file.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={tab === "paste" ? "Something worth keeping." : "Bring your bookmarks home."}
      subtitle={
        initialCollection && tab === "paste"
          ? "Paste new links or move bookmarks you’ve already saved. Choose a destination below."
          : "A link, a handful, or your whole collection. We’ll take care of the sorting."
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="segmented">
        <button
          disabled={busy}
          className={tab === "paste" ? "active" : ""}
          onClick={() => setTab("paste")}
        >
          <LinkSimple size={16} /> Paste links
        </button>
        <button
          disabled={busy}
          className={tab === "import" ? "active" : ""}
          onClick={() => setTab("import")}
        >
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
            onChange={(event) => setText(event.target.value)}
            placeholder={
              'Save figma.com and github.com under "Weekend ideas"\n\nOr paste any text with links. No https:// needed.'
            }
            rows={5}
            maxLength={100000}
            disabled={busy}
          />
          <div className="input-hint" aria-live="polite">
            {urls.length ? (
              <>
                <Check size={14} /> {urls.length} link{urls.length === 1 ? "" : "s"} found
                {duplicateCount ? ` · ${duplicateCount} already saved` : ""}
              </>
            ) : (
              "New links are saved once. Existing links move into your chosen collection."
            )}
          </div>
          <label className="field-label" htmlFor="collection">
            Folder <span>(optional)</span>
          </label>
          <input
            id="collection"
            list="existing-folders"
            value={folderValue}
            onChange={(event) => setFolderOverride(event.target.value)}
            placeholder={
              inferredFolders.length > 1 && folderOverride === null
                ? "Multiple folders found below"
                : "Automatic, or type a folder name"
            }
            maxLength={80}
            disabled={busy}
          />
          <datalist id="existing-folders">
            {activeLists.map((list) => (
              <option key={list.id} value={list.name}>
                {list.name}
              </option>
            ))}
          </datalist>
          <div className="input-hint">
            {folderValue ? (
              <>
                <Folder size={14} />{" "}
                {activeLists.some((list) => folderKey(list.name) === folderKey(folderValue))
                  ? "Uses your existing folder"
                  : "Creates this folder when you save"}
              </>
            ) : (
              "Choose an existing folder or name a new one. Your folder instructions take priority."
            )}
          </div>
          {!!duplicateCount &&
            entries.some(
              (entry) => existing.has(canonicalUrl(entry.url)) && destination(entry),
            ) && (
              <p className="small muted" aria-live="polite">
                Existing links move out of their previous collections into the destinations below.
                Notes, tags, and favorites stay with them; archived links return to your library.
              </p>
            )}
          {!!entries.length && (
            <div className="paste-preview" aria-label="Bookmark destinations">
              {entries.slice(0, 5).map((entry, index) => (
                <div className="paste-preview-row" key={`${entry.url}-${index}`}>
                  <LinkSimple size={15} />
                  <span title={entry.url}>{entry.url.replace(/^https?:\/\//, "")}</span>
                  <small>
                    <Folder size={13} />
                    {destination(entry) || (settings.autoSort ? "Automatic" : "Library")}
                  </small>
                </div>
              ))}
              {entries.length > 5 && (
                <p className="small muted">And {entries.length - 5} more destinations</p>
              )}
            </div>
          )}
          <label className="paste-auto">
            <input
              type="checkbox"
              checked={settings.autoSort}
              disabled={busy}
              onChange={(event) => setSettings({ autoSort: event.target.checked })}
            />
            <span>
              <strong>Organize automatically</strong>
              <small>Find topics and use matching folders when you haven’t chosen one.</small>
            </span>
            <Sparkle size={18} />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <span>
              {busy ? (
                progress
              ) : (
                <>
                  <Sparkle size={14} />{" "}
                  {settings.autoSort
                    ? "A little sorting, taken care of"
                    : "Automatic sorting is off"}
                </>
              )}
            </span>
            <button
              className="button primary"
              disabled={!urls.length || busy || urls.length > 100}
              onClick={() => void save()}
            >
              {busy ? <CircleNotch className="spin" size={16} /> : <ArrowUpRight size={17} />}
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
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (event.dataTransfer.files[0] && !busy)
                void importFile(event.dataTransfer.files[0]);
            }}
          >
            <FileArrowUp size={34} weight="light" />
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
              onChange={(event) => {
                if (event.target.files?.[0]) void importFile(event.target.files[0]);
              }}
              aria-label="Choose bookmark import file"
            />
          </label>
          <div className="note-box">
            <strong>A fresh start, without starting over.</strong>
            <p>
              Your browser’s Bookmark Manager has an Export option. Nest keeps folders as
              collections, reuses matching names, and files duplicate links into their imported
              folders.
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
