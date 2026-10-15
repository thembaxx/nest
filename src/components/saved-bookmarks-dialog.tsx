"use client";
import { useState } from "react";
import { MagnifyingGlass, ArrowRight, Heart, Check, Bookmarks } from "@phosphor-icons/react";
import { Modal } from "./ui";
import { useLibrary } from "./library-provider";
import { searchScore } from "@/lib/bookmarks";
export function SavedBookmarksDialog({
  collectionId,
  onClose,
}: {
  collectionId: string;
  onClose: () => void;
}) {
  const { library, add, toast } = useLibrary();
  const collection = library.lists.find((list) => list.id === collectionId && !list.deletedAt)!;
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);
  const [error, setError] = useState("");
  const bookmarks = library.bookmarks
    .filter(
      (bookmark) =>
        !bookmark.deletedAt &&
        (!favorites || bookmark.favorite) &&
        searchScore(bookmark, query) > 0,
    )
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt);
  const alreadyHere = (bookmark: (typeof bookmarks)[number]) =>
    bookmark.listIds.length === 1 &&
    bookmark.listIds[0] === collectionId &&
    !bookmark.archived &&
    !bookmark.demo;
  const visible = bookmarks.slice(0, limit);
  const eligible = visible.filter((bookmark) => !alreadyHere(bookmark));
  function move() {
    try {
      const incoming = library.bookmarks
        .filter((bookmark) => selected.includes(bookmark.id) && !bookmark.deletedAt)
        .map((bookmark) => ({ ...bookmark, id: crypto.randomUUID() }));
      const folders = Object.fromEntries(
        incoming.map((bookmark) => [bookmark.id, collection.name]),
      );
      const result = add(incoming, [], { folders, moveExisting: true, autoOrganize: false });
      toast(
        `Moved ${result.moved} bookmark${result.moved === 1 ? "" : "s"} to ${collection.name}.`,
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not move these bookmarks.");
    }
  }
  return (
    <Modal
      title="Bring a few good things together."
      subtitle={`Choose saved bookmarks to move into ${collection.name}. Their notes, tags, and favorites come along.`}
      onClose={onClose}
    >
      <div className="saved-picker-toolbar">
        <label className="collection-search">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search saved bookmarks"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(50);
            }}
            placeholder="Search your saved links…"
          />
        </label>
        <button
          className={`button secondary ${favorites ? "selected" : ""}`}
          aria-pressed={favorites}
          onClick={() => {
            setFavorites(!favorites);
            setLimit(50);
          }}
        >
          <Heart size={17} weight={favorites ? "fill" : "regular"} /> Favorites
        </button>
      </div>
      <div className="saved-picker-heading">
        <button
          className="text-button"
          disabled={!eligible.length}
          onClick={() =>
            setSelected((current) =>
              eligible.every((bookmark) => current.includes(bookmark.id))
                ? current.filter((id) => !eligible.some((bookmark) => bookmark.id === id))
                : [...new Set([...current, ...eligible.map((bookmark) => bookmark.id)])],
            )
          }
        >
          Select visible
        </button>
        <span>{selected.length} selected</span>
        {!!selected.length && (
          <button className="text-button" onClick={() => setSelected([])}>
            Clear
          </button>
        )}
      </div>
      <div className="saved-picker-list">
        {visible.map((bookmark) => (
          <label
            className={`saved-picker-row ${alreadyHere(bookmark) ? "already-here" : ""}`}
            key={bookmark.id}
          >
            <input
              type="checkbox"
              aria-label={`Select ${bookmark.title}`}
              disabled={alreadyHere(bookmark)}
              checked={selected.includes(bookmark.id)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, bookmark.id]
                    : current.filter((id) => id !== bookmark.id),
                )
              }
            />
            <span
              className={`saved-picker-icon topic-${bookmark.topic.toLowerCase().split(" ")[0]}`}
            >
              <Bookmarks size={19} />
            </span>
            <span className="saved-picker-copy">
              <strong>{bookmark.title}</strong>
              <small>
                {new URL(bookmark.url).hostname.replace(/^www\./, "")} · {bookmark.topic}
              </small>
            </span>
            {alreadyHere(bookmark) ? (
              <span className="saved-picker-here">
                <Check size={13} /> Here
              </span>
            ) : (
              bookmark.favorite && <Heart size={15} weight="fill" />
            )}
          </label>
        ))}
        {!visible.length && <p className="small muted">No saved bookmarks match this search.</p>}
      </div>
      {bookmarks.length > limit && (
        <button
          className="text-button picker-more"
          onClick={() => setLimit((current) => current + 50)}
        >
          Show more · {limit} of {bookmarks.length}
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <span>Moves replace previous collection memberships.</span>
        <button className="button primary" disabled={!selected.length} onClick={move}>
          Move {selected.length || "selected"} bookmark{selected.length === 1 ? "" : "s"}
          <ArrowRight size={16} />
        </button>
      </footer>
    </Modal>
  );
}
