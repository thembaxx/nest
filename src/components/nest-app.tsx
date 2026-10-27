"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Archive,
  ArrowsDownUp as ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  Cloud,
  CloudSlash as CloudOff,
  Command,
  Heart,
  SquaresFour as LayoutGrid,
  LinkSimple as Link2,
  List,
  List as Menu,
  Plus,
  MagnifyingGlass as Search,
  GearSix as Settings,
  Sparkle as Sparkles,
  Upload,
  X,
  BookOpen,
  Graph as Network,
  Leaf,
  Download,
  SlidersHorizontal,
  DotsThree,
  Bookmarks,
  XLogo,
} from "@phosphor-icons/react";
import { useLibrary } from "./library-provider";
import { Modal, Empty } from "./ui";
import { BookmarkCard } from "./bookmark-card";
import { AddDialog } from "./add-dialog";
import { SettingsDialog } from "./settings-dialog";
import { DetailDialog } from "./detail-dialog";
import { OnboardingDialog } from "./onboarding-dialog";
import { XImportWizard } from "./x-import-wizard";
import { AssistantDialog } from "./assistant-dialog";
import { topics, type View } from "@/lib/types";
import { CollectionsSection } from "./collections-section";
import { CollectionDialog } from "./collection-dialog";
import { SavedBookmarksDialog } from "./saved-bookmarks-dialog";
import { folderKey } from "@/lib/paste";
import { searchScore } from "@/lib/bookmarks";
const ConnectionsDialog = dynamic(
  () => import("./connections-dialog").then((m) => m.ConnectionsDialog),
  { ssr: false },
);
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function NestApp() {
  const { library, settings, ready, syncState, online, setLibrary, toast } = useLibrary();
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("All");
  const [sort, setSort] = useState("newest");
  const [layout, setLayout] = useState("grid");
  const [dialog, setDialog] = useState<
    | "add"
    | "import"
    | "x-import"
    | "x-upload"
    | "settings"
    | "sync-settings"
    | "ai-settings"
    | "welcome"
    | "assistant"
    | "collection"
    | "saved"
    | "connections"
    | "install"
    | null
  >(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [managedCollection, setManagedCollection] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [initialLink, setInitialLink] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("lilac");
  const [aiIds, setAiIds] = useState<string[] | undefined>();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const onboardChecked = useRef(false);
  useEffect(() => {
    if (!ready || onboardChecked.current) return;
    onboardChecked.current = true;
    queueMicrotask(() => {
      const params = new URLSearchParams(location.search);
      const shared = [params.get("url"), params.get("text"), params.get("title")]
        .filter(Boolean)
        .join("\n");
      if (params.get("raindrop") === "connected") {
        setDialog("import");
        history.replaceState(null, "", location.pathname);
      } else if (shared) {
        setInitialLink(shared);
        setDialog("add");
        history.replaceState(null, "", location.pathname);
      } else if (params.get("action") === "add") {
        setDialog("add");
        history.replaceState(null, "", location.pathname);
      } else if (!settings.onboarded) setDialog("welcome");
    });
  }, [ready, settings.onboarded]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setMobile(false);
    };
    const install = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("beforeinstallprompt", install);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);
  const active = useMemo(() => library.bookmarks.filter((b) => !b.deletedAt), [library.bookmarks]);
  const ordinary = useMemo(() => active.filter((b) => b.source !== "x"), [active]);
  const xBookmarks = useMemo(() => active.filter((b) => b.source === "x"), [active]);
  const collections = library.lists.filter((l) => !l.deletedAt);
  const filtered = useMemo(() => {
    let result = active
      .filter((b) => {
        if (view === "archive") return b.archived;
        if (view === "dead") return b.status === "dead";
        if (b.archived) return false;
        if (view === "x") return b.source === "x";
        if ((view === "all" || view === "favorites" || view === "unread") && b.source === "x") return false;
        if (view === "favorites") return b.favorite;
        if (view === "unread") return !b.read;
        if (view.startsWith("list:")) return b.listIds.includes(view.slice(5));
        return true;
      })
      .filter((b) => topic === "All" || b.topic === topic)
      .filter((b) => (aiIds ? aiIds.includes(b.id) : searchScore(b, query) > 0));
    return result.sort((a, b) => {
      if (query && !aiIds && sort === "relevance")
        return searchScore(b, query) - searchScore(a, query);
      if (sort === "oldest") return a.createdAt - b.createdAt;
      if (sort === "az") return a.title.localeCompare(b.title);
      return b.createdAt - a.createdAt;
    });
  }, [active, view, topic, query, sort, aiIds]);
  const currentCollection = view.startsWith("list:")
    ? collections.find((list) => list.id === view.slice(5))
    : undefined;
  const viewTitle =
    view === "x"
      ? "Your saved posts from X"
      : view === "favorites"
        ? "Your favorites"
        : view === "unread"
          ? "A little reading, for later"
          : view === "archive"
            ? "Tucked away, for now"
            : view === "dead"
              ? "Links that need a little care"
              : view.startsWith("list:")
                ? collections.find((l) => l.id === view.slice(5))?.name || "Your collection"
                : "Good things, kept close.";
  const navigate = (v: View) => {
    setView(v);
    setTopic("All");
    setQuery("");
    setAiIds(undefined);
    setMobile(false);
  };
  const openDetail = useCallback((id: string) => {
    setDialog(null);
    setDetail(id);
  }, []);
  const close = () => {
    setDialog(null);
    setInitialLink("");
  };
  function createCollection() {
    if (!newName.trim()) return;
    if (collections.some((l) => folderKey(l.name) === folderKey(newName))) {
      toast("That collection is already at home here.");
      return;
    }
    const id = crypto.randomUUID();
    setLibrary((s) => ({
      ...s,
      lists: [...s.lists, { id, name: newName.trim(), color: newColor, updatedAt: Date.now() }],
    }));
    setNewName("");
    setDialog(null);
    navigate(`list:${id}`);
    toast("A new little home for your ideas.");
  }
  async function install() {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") toast("Nest is finding a home on your device.");
      setInstallEvent(null);
    } else setDialog("install");
  }
  if (!ready)
    return (
      <main id="main-content" className="app-loading" aria-busy="true">
        <img
          src="/brand/nest-app-icon-128.webp"
          width="56"
          height="56"
          className="brand-app-icon"
          alt="Nest"
        />
        <h1>A smarter home for your bookmarks.</h1>
        <p>Save links, collect ideas, and find the good things again.</p>
        <span>Making a little room for your curiosity…</span>
      </main>
    );
  return (
    <div className={`app-shell ${mobile ? "menu-open" : ""}`} data-edge-background="page">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="sidebar" data-edge-background="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("all");
          }}
          aria-label="Nest home"
        >
          <img
            src="/brand/nest-app-icon-128.webp"
            width="38"
            height="38"
            className="brand-app-icon"
            alt=""
          />
          <span>
            nest<span className="brand-period">.</span>
          </span>
        </a>
        <button className="space-selector" onClick={() => setDialog("settings")}>
          <span className="space-avatar">Y</span>
          <span>
            Your personal space<small>A home for your ideas</small>
          </span>
          <ChevronDown size={13} />
        </button>
        <span className="nav-label">YOUR LIBRARY</span>
        <nav className="main-nav" aria-label="Library">
          <Nav
            icon={Bookmark}
            label="All bookmarks"
            active={view === "all"}
            count={ordinary.filter((b) => !b.archived).length}
            onClick={() => navigate("all")}
          />
          {settings.xImportEnabled && (
            <Nav
              icon={XLogo}
              label="X bookmarks"
              active={view === "x"}
              count={xBookmarks.filter((b) => !b.archived).length}
              onClick={() => navigate("x")}
            />
          )}
          <Nav
            icon={Heart}
            label="Favorites"
            active={view === "favorites"}
            count={ordinary.filter((b) => b.favorite && !b.archived).length}
            onClick={() => navigate("favorites")}
          />
          <Nav
            icon={BookOpen}
            label="Read later"
            active={view === "unread"}
            count={ordinary.filter((b) => !b.read && !b.archived).length}
            onClick={() => navigate("unread")}
          />
        </nav>
        <div className="nav-heading">
          <span className="nav-label">COLLECTIONS</span>
          <button
            className="icon-button"
            aria-label="Create collection"
            onClick={() => setDialog("collection")}
          >
            <Plus size={15} />
          </button>
        </div>
        <nav className="collection-nav" aria-label="Collections">
          {collections.map((l) => (
            <div key={l.id} className="collection-nav-row">
              <button
                className={view === `list:${l.id}` ? "active" : ""}
                onClick={() => navigate(`list:${l.id}`)}
              >
                <span className={`color-dot ${l.color}`} />
                <span>{l.name}</span>
                <span className="nav-count">
                  {active.filter((b) => b.listIds.includes(l.id) && !b.archived).length}
                </span>
              </button>
              <button
                className="icon-button collection-nav-options"
                aria-label={`Collection options for ${l.name}`}
                title="Rename, recolor, export, or remove collection"
                onClick={() => {
                  setMobile(false);
                  setManagedCollection(l.id);
                }}
              >
                <DotsThree size={17} />
              </button>
            </div>
          ))}
          <button className="new-collection" onClick={() => setDialog("collection")}>
            <Plus size={14} /> New collection
          </button>
        </nav>
        <span className="nav-label smart-label">A LITTLE HOUSEKEEPING</span>
        <nav className="main-nav" aria-label="Housekeeping">
          <Nav
            icon={Link2}
            label="Broken links"
            active={view === "dead"}
            count={active.filter((b) => b.status === "dead").length || undefined}
            onClick={() => navigate("dead")}
          />
          <Nav
            icon={Archive}
            label="Archive"
            active={view === "archive"}
            onClick={() => navigate("archive")}
          />
        </nav>
        <div className="sidebar-bottom">
          <button className="companion-card" onClick={() => setDialog("assistant")}>
            <span className="companion-spark">
              <Sparkles size={18} />
            </span>
            <strong>A little help from Nest</strong>
            <span>“Find that thing I saved…”</span>
            <ArrowUpRight size={16} />
          </button>
          <button className="sidebar-setting" onClick={() => setDialog("settings")}>
            <Settings size={17} /> Settings & preferences
          </button>
          <div className="sidebar-footer">
            <span className="status-dot" /> A calmer kind of collecting.
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumbs">
            <span>Personal space</span>
            <ChevronRight size={13} />
            <strong>{view.startsWith("list:") ? "Collection" : "My library"}</strong>
          </div>
          <div className="topbar-right">
            <button className="sync-status" aria-label="View bookmark sync status and backups" onClick={() => setDialog("sync-settings")}>
              {!online ? <CloudOff size={15} /> : <Cloud size={15} />}
              <span>
                {!online
                  ? "Offline · saved locally"
                  : syncState === "synced"
                    ? settings.syncProvider === "google"
                      ? "Google Drive · Up to date"
                      : "Cloud sync · Up to date"
                    : syncState === "syncing"
                      ? "Syncing…"
                      : syncState === "reconnect"
                        ? "Reconnect Google Drive"
                        : syncState === "unconfigured"
                          ? "Sync needs setup"
                          : syncState === "error"
                            ? "Sync error · Open settings"
                            : "Saved on this device"}
              </span>
              <i className={!online ? "offline" : ""} />
            </button>
            <button
              className="profile"
              onClick={() => setDialog("settings")}
              aria-label="Open your preferences"
            >
              Y
            </button>
          </div>
        </header>
        <main id="main-content">
          <div className="greeting">
            <div>
              <div className="eyebrow greeting-label">
                <Sparkles size={14} className="little-flower" aria-hidden="true" /> YOUR LITTLE
                CORNER OF THE INTERNET
              </div>
              <h1>{viewTitle}</h1>
              <p>
                {view === "all"
                  ? "Save what sparks something. Find it when you need it."
                  : view === "x"
                    ? "A quiet home for the posts you saved on X, separate from your other links."
                  : view === "dead"
                    ? "Repeatedly missing pages land here. Temporary errors get another chance."
                    : view === "archive"
                      ? "Out of the way. Always here when you need them."
                      : "A few good things, all in one place."}
              </p>
            </div>
            <div className="greeting-actions">
              <button className="button import-button" onClick={() => setDialog(view === "x" ? "x-import" : "import")}>
                <Upload size={16} /> {view === "x" ? "Import from X" : "Import"}
              </button>
              {view !== "x" && (
                <button className="button primary" onClick={() => setDialog("add")}>
                  <Plus size={18} /> {currentCollection ? "Add links" : "Add bookmark"}
                </button>
              )}
            </div>
          </div>
          {settings.xImportEnabled && (view === "all" || view === "x") && (
            <div className="bookmark-source-tabs" role="tablist" aria-label="Bookmark source">
              <button
                role="tab"
                aria-selected={view === "all"}
                className={view === "all" ? "active" : ""}
                onClick={() => navigate("all")}
              >
                <Bookmark size={16} /> Bookmarks <span>{ordinary.filter((b) => !b.archived).length}</span>
              </button>
              <button
                role="tab"
                aria-selected={view === "x"}
                className={view === "x" ? "active" : ""}
                onClick={() => navigate("x")}
              >
                <XLogo size={16} /> X bookmarks <span>{xBookmarks.filter((b) => !b.archived).length}</span>
              </button>
            </div>
          )}
          {view === "all" && !query && (
            <CollectionsSection
              collections={collections}
              bookmarks={ordinary}
              onOpen={(id) => navigate(`list:${id}`)}
              onManage={setManagedCollection}
              onCreate={() => setDialog("collection")}
            />
          )}
          {currentCollection && (
            <div className="collection-page-tools">
              <button
                className="button secondary"
                onClick={() => {
                  navigate(view);
                  setDialog("saved");
                }}
              >
                <Bookmarks size={17} /> Add saved bookmarks
              </button>
              <button
                className="text-button"
                onClick={() => setManagedCollection(currentCollection.id)}
              >
                <SlidersHorizontal size={17} /> Manage collection
              </button>
            </div>
          )}

          <section className="library-section" aria-labelledby="library-heading">
            <div className="section-title library-title">
              <h2 id="library-heading">
                {query
                  ? "A few things you might like"
                  : view === "all"
                    ? "All bookmarks"
                    : view === "x"
                      ? "X bookmarks"
                    : view === "dead"
                      ? "Broken links"
                      : "Bookmarks"}{" "}
                <span>{filtered.length}</span>
              </h2>
              <div className="library-heading-right">
                {settings.autoSort && (
                  <span className="organized">
                    <Sparkles size={12} /> A little more organized
                  </span>
                )}
                <div className="view-toggle" aria-label="View options">
                  <button
                    className={layout === "grid" ? "active" : ""}
                    onClick={() => setLayout("grid")}
                    aria-label="Grid view"
                    aria-pressed={layout === "grid"}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    className={layout === "list" ? "active" : ""}
                    onClick={() => setLayout("list")}
                    aria-label="List view"
                    aria-pressed={layout === "list"}
                  >
                    <List size={17} />
                  </button>
                  <button
                    className={layout === "shelf" ? "active" : ""}
                    onClick={() => setLayout("shelf")}
                    aria-label="Shelf view"
                    aria-pressed={layout === "shelf"}
                    title="Display bookmarks on a decorative shelf"
                  >
                    <BookOpen size={17} />
                  </button>
                  <button
                    onClick={() => setDialog("connections")}
                    aria-label="Explore topic connections"
                  >
                    <Network size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="search-toolbar">
              <div className="search-field">
                <Search size={19} />
                <input
                  ref={searchRef}
                  aria-label="Search bookmarks"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setAiIds(undefined);
                    if (e.target.value) setSort("relevance");
                  }}
                  placeholder="Search your bookmarks…"
                />
                {query ? (
                  <button
                    className="icon-button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      setAiIds(undefined);
                    }}
                  >
                    <X size={15} />
                  </button>
                ) : (
                  <kbd>
                    <Command size={11} /> K
                  </kbd>
                )}
                <button className="ask-search" onClick={() => setDialog("assistant")}>
                  <Sparkles size={14} />
                  <span>Ask Nest</span>
                </button>
              </div>
              <label className="sort-select">
                <ArrowDownUp size={15} />
                <select
                  aria-label="Sort bookmarks"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="az">Title A–Z</option>
                  <option value="relevance">Most relevant</option>
                </select>
                <ChevronDown size={13} />
              </label>
            </div>
            <div className="filter-row">
              <div className="topic-filters" aria-label="Filter by topic">
                {[
                  "All",
                  ...topics.filter((t) => t !== "Unsorted"),
                  ...((view === "x" ? xBookmarks : view === "all" || view === "favorites" || view === "unread" ? ordinary : active).some((b) => b.topic === "Unsorted") ? ["Unsorted"] : []),
                ].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className={topic === t ? "active" : ""}
                    aria-pressed={topic === t}
                  >
                    {t === "All" ? "Everything" : t}
                    {topic === t && <span>{filtered.length}</span>}
                  </button>
                ))}
              </div>
              <span className="results-label">{filtered.length} little finds</span>
            </div>
            {filtered.length ? (
              <div className={`bookmark-grid ${layout === "list" ? "list-view" : layout === "shelf" ? "shelf-view" : ""}`}>
                {filtered.map((b, i) => (
                  <BookmarkCard
                    key={b.id}
                    bookmark={b}
                    collection={currentCollection}
                    onOpen={() => setDetail(b.id)}
                    list={layout === "list"}
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <Empty
                title={
                  query
                    ? "A new thread to follow."
                    : view === "x"
                      ? "Your saved posts have a place here."
                    : view === "dead"
                      ? "Nothing broken. A lovely thing."
                      : "A little space for something good."
                }
                description={
                  query
                    ? "Try a different word, topic, or a simpler description."
                    : view === "x"
                      ? "Import your X bookmarks using the guided CSV import. They’ll stay separate from your regular links."
                    : view === "dead"
                      ? "Synced links are checked on a schedule. Confirmed missing pages will appear here."
                      : "Add a bookmark, import your favorites, or explore another collection."
                }
              >
                {query ? (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setQuery("");
                      setAiIds(undefined);
                      setTopic("All");
                    }}
                  >
                    Clear search
                  </button>
                ) : (
                  view !== "dead" && (
                    <button className="button primary" onClick={() => setDialog(view === "x" ? "x-import" : "add")}>
                      {view === "x" ? <Upload size={15} /> : <Plus size={15} />}
                      {view === "x" ? "Import from X" : "Save your first find"}
                    </button>
                  )
                )}
              </Empty>
            )}
          </section>
          <footer className="main-footer">
            <span>
              <Leaf size={13} /> A place for your curiosity to grow.
            </span>
            <a className="brand-resource-link" href="/about">
              About Nest <ArrowUpRight size={11} />
            </a>
            <a className="brand-resource-link" href="/guide">
              A little guide <ArrowUpRight size={11} />
            </a>
            {active.some((b) => b.demo) && (
              <button onClick={() => setDialog("welcome")}>
                Exploring a sample library{" "}
                <span>
                  Make it yours <ArrowRight size={13} />
                </span>
              </button>
            )}
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation" data-edge-background="page">
        <button onClick={() => navigate("all")} className={view === "all" ? "active" : ""}>
          <Bookmark size={20} />
          <span>Library</span>
        </button>
        <button
          onClick={() => navigate("favorites")}
          className={view === "favorites" ? "active" : ""}
        >
          <Heart size={20} />
          <span>Favorites</span>
        </button>
        <button className="mobile-add" aria-label="Add bookmark" onClick={() => setDialog("add")}>
          <Plus size={25} />
        </button>
        <button onClick={() => setDialog("assistant")}>
          <Sparkles size={20} />
          <span>Ask Nest</span>
        </button>
        <button onClick={() => setDialog("settings")}>
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </nav>
      {(dialog === "add" || dialog === "import" || dialog === "x-upload") && (
        <AddDialog
          onClose={close}
          initial={initialLink}
          importMode={dialog === "import" || dialog === "x-upload"}
          xImportMode={dialog === "x-upload"}
          onOpenXGuide={() => setDialog("x-import")}
          onImportedX={() => navigate("x")}
          initialCollection={dialog === "add" ? currentCollection?.name : undefined}
        />
      )}{" "}
      {dialog === "x-import" && settings.xImportEnabled && (
        <XImportWizard onClose={close} onImport={() => setDialog("x-upload")} />
      )}
      {dialog === "saved" && currentCollection && (
        <SavedBookmarksDialog collectionId={currentCollection.id} onClose={close} />
      )}
      {managedCollection && collections.some((list) => list.id === managedCollection) && (
        <CollectionDialog
          key={managedCollection}
          id={managedCollection}
          onClose={() => setManagedCollection(null)}
          onRemoved={() => {
            setManagedCollection(null);
            navigate("all");
          }}
          onAddSaved={() => {
            navigate(`list:${managedCollection}`);
            setManagedCollection(null);
            setDialog("saved");
          }}
        />
      )}
      {(dialog === "settings" || dialog === "ai-settings" || dialog === "sync-settings") && (
        <SettingsDialog
          initialTab={
            dialog === "ai-settings" ? "ai" : dialog === "sync-settings" ? "sync" : "general"
          }
          onClose={close}
          onInstall={() => void install()}
          onOpenXImport={() => setDialog("x-import")}
          onDisableXImport={() => {
            if (view === "x") navigate("all");
          }}
        />
      )}{" "}
      {dialog === "welcome" && (
        <OnboardingDialog
          onClose={close}
          onImport={() => setDialog("import")}
          onAI={() => setDialog("ai-settings")}
        />
      )}{" "}
      {dialog === "assistant" && (
        <AssistantDialog
          onClose={close}
          onAdd={(text) => {
            setInitialLink(text);
            setDialog("add");
          }}
          onSettings={() => setDialog("ai-settings")}
          onSearch={(q, ids) => {
            setView("all");
            setTopic("All");
            setQuery(q);
            setAiIds(ids);
            setSort("relevance");
          }}
        />
      )}{" "}
      {detail && (
        <DetailDialog
          bookmarkId={detail}
          collectionId={currentCollection?.id}
          onClose={() => setDetail(null)}
        />
      )}{" "}
      {dialog === "connections" && (
        <ConnectionsDialog bookmarks={filtered} onClose={close} onOpen={openDetail} />
      )}
      {dialog === "collection" && (
        <Modal
          title="A home for a little obsession."
          subtitle="Group anything that belongs together. You can add bookmarks whenever you like."
          onClose={close}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createCollection();
            }}
          >
            <label className="field-label" htmlFor="collection-name">
              Collection name
            </label>
            <input
              id="collection-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
              placeholder="Weekend rabbit holes"
            />
            <span className="field-label">A little color</span>
            <div className="color-choices">
              {["lilac", "blue", "green", "yellow", "peach"].map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`color-choice ${c} ${newColor === c ? "active" : ""}`}
                  onClick={() => setNewColor(c)}
                  aria-label={`${c} collection color`}
                  aria-pressed={newColor === c}
                >
                  {newColor === c && <Check size={17} />}
                </button>
              ))}
            </div>
            <footer className="modal-footer">
              <span>Make room for what moves you.</span>
              <button type="submit" className="button primary" disabled={!newName.trim()}>
                Create collection <Plus size={16} />
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {dialog === "install" && (
        <Modal
          title="A little closer to home."
          subtitle="Keep Nest on your home screen for faster access and offline browsing."
          onClose={close}
        >
          <div className="install-illustration">
            <img
              src="/brand/nest-app-icon-128.webp"
              width="72"
              height="72"
              className="brand-app-icon"
              alt="Nest app icon"
            />
          </div>
          <div className="note-box">
            <Download size={22} />
            <div>
              <strong>Install from your browser</strong>
              <p>
                On iPhone or iPad, open Nest in Safari, tap Share, then Add to Home Screen. On
                Android or desktop, use your browser’s menu and choose Install app or Add to Home
                Screen.
              </p>
              <p>
                Your library remains available offline after the first visit. Model downloads need
                an internet connection.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Nav({
  icon: Icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: typeof Bookmark;
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={active ? "active" : ""}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={18} weight="regular" />
      <span>{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </button>
  );
}
