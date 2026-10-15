"use client";
import { useState } from "react";
import { Check, DownloadSimple, Trash, Bookmarks } from "@phosphor-icons/react";
import { useLibrary } from "./library-provider";
import { Modal } from "./ui";
import { updateCollection, removeCollection, downloadLibrary } from "@/lib/collections";
export function CollectionDialog({
  id,
  onClose,
  onRemoved,
  onAddSaved,
}: {
  id: string;
  onClose: () => void;
  onRemoved: () => void;
  onAddSaved: () => void;
}) {
  const { library, setLibrary, toast } = useLibrary();
  const collection = library.lists.find((list) => list.id === id && !list.deletedAt)!;
  const [name, setName] = useState(collection.name);
  const [color, setColor] = useState(collection.color);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const bookmarks = library.bookmarks.filter(
    (bookmark) => !bookmark.deletedAt && bookmark.listIds.includes(id),
  );
  function save() {
    try {
      const updated = updateCollection(library, id, { name, color });
      setLibrary(updated);
      toast("Collection updated.");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this collection.");
    }
  }
  return (
    <Modal
      title="A little room of your own."
      subtitle={`${bookmarks.length} saved links. Make this collection yours.`}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label className="field-label" htmlFor="edit-collection-name">
          Collection name
        </label>
        <input
          id="edit-collection-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
        />
        <span className="field-label">A little color</span>
        <div className="color-choices">
          {["lilac", "blue", "green", "yellow", "peach"].map((value) => (
            <button
              type="button"
              key={value}
              className={`color-choice ${value} ${color === value ? "active" : ""}`}
              aria-label={`${value} collection color`}
              aria-pressed={color === value}
              onClick={() => setColor(value)}
            >
              {color === value && <Check size={17} />}
            </button>
          ))}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="collection-tools">
          <button type="button" className="button secondary" onClick={onAddSaved}>
            <Bookmarks size={17} /> Add saved bookmarks
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              downloadLibrary(
                {
                  bookmarks: bookmarks.map((bookmark) => ({ ...bookmark, demo: false })),
                  lists: [collection],
                },
                `${collection.name.replace(/[^\p{L}\p{N}-]+/gu, "-") || "collection"}.json`,
              );
              toast("Collection exported.");
            }}
          >
            <DownloadSimple size={17} /> Export collection
          </button>
        </div>
        <footer className="modal-footer">
          <button
            type="button"
            className="text-button danger"
            onClick={() => setRemoving(!removing)}
          >
            <Trash size={16} /> Remove collection
          </button>
          <button type="submit" className="button primary" disabled={!name.trim()}>
            <Check size={16} /> Save collection
          </button>
        </footer>
      </form>
      {removing && (
        <div className="collection-remove">
          <strong>Remove “{collection.name}”?</strong>
          <p>
            Your bookmarks, notes, and favorites stay in your library. This removes the collection
            and its memberships across synced devices.
          </p>
          <button
            className="button secondary danger"
            onClick={() => {
              setLibrary((current) => removeCollection(current, id));
              toast("Collection removed. Your bookmarks are still in your library.");
              onRemoved();
            }}
          >
            Remove collection, keep bookmarks
          </button>
        </div>
      )}
    </Modal>
  );
}
