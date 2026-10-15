"use client";
import { useState } from "react";
import {
  Archive,
  ArrowUpRight,
  BookOpenText as BookCheck,
  Heart,
  Trash as Trash2,
  ArrowCounterClockwise as RotateCcw,
  Check,
  FolderMinus,
} from "@phosphor-icons/react";
import { Modal } from "./ui";
import { useLibrary } from "./library-provider";
import { topics, type Bookmark } from "@/lib/types";
export function DetailDialog({
  bookmarkId,
  collectionId,
  onClose,
}: {
  bookmarkId: string;
  collectionId?: string;
  onClose: () => void;
}) {
  const { library, update, toast } = useLibrary();
  const b = library.bookmarks.find((b) => b.id === bookmarkId)!;
  const [title, setTitle] = useState(b.title);
  const [note, setNote] = useState(b.note || "");
  const [tags, setTags] = useState(b.tags.join(", "));
  const [topic, setTopic] = useState(b.topic);
  const [lists, setLists] = useState(b.listIds);
  function save() {
    update(b.id, {
      title: title.trim() || b.title,
      note,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 30),
      topic,
      listIds: lists,
    });
    toast("A little more you. Changes saved.");
    onClose();
  }
  return (
    <Modal
      title="Edit bookmark"
      subtitle="Rename it, organize it, or move it to trash. Removed links can be restored in Settings."
      onClose={onClose}
    >
      <div className={`detail-cover art-${b.art || "default"}`}>
        {b.art ? <img src={`/art/${b.art}.svg`} alt="" /> : <span>{new URL(b.url).hostname}</span>}
      </div>
      <a
        className="detail-url"
        href={b.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => update(b.id, { read: true })}
      >
        {new URL(b.url).hostname} <ArrowUpRight size={16} />
      </a>
      <label className="field-label" htmlFor="bookmark-title">
        Title
      </label>
      <input
        id="bookmark-title"
        value={title}
        maxLength={500}
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className="field-label" htmlFor="bookmark-topic">
        Topic
      </label>
      <select
        id="bookmark-topic"
        value={topic}
        onChange={(e) => setTopic(e.target.value as Bookmark["topic"])}
      >
        {topics.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <label className="field-label" htmlFor="bookmark-tags">
        Tags <span>separate with commas</span>
      </label>
      <input
        id="bookmark-tags"
        value={tags}
        maxLength={1000}
        onChange={(e) => setTags(e.target.value)}
      />
      <label className="field-label" htmlFor="bookmark-note">
        A note to your future self
      </label>
      <textarea
        id="bookmark-note"
        value={note}
        maxLength={5000}
        rows={3}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What caught your eye?"
      />
      <span className="field-label">Collections</span>
      <div className="collection-checks">
        {library.lists
          .filter((l) => !l.deletedAt)
          .map((l) => (
            <label key={l.id}>
              <input
                type="checkbox"
                checked={lists.includes(l.id)}
                onChange={(e) =>
                  setLists(e.target.checked ? [...lists, l.id] : lists.filter((id) => id !== l.id))
                }
              />
              <span className={`color-dot ${l.color}`} />
              {l.name}
            </label>
          ))}
      </div>
      <div className="detail-actions">
        <button
          className={`button secondary ${b.favorite ? "selected" : ""}`}
          onClick={() => update(b.id, { favorite: !b.favorite })}
        >
          <Heart size={15} /> {b.favorite ? "Favorited" : "Favorite"}
        </button>
        <button className="button secondary" onClick={() => update(b.id, { read: !b.read })}>
          <BookCheck size={15} />
          {b.read ? "Mark unread" : "Mark read"}
        </button>
        <button
          className="button secondary"
          onClick={() => {
            update(b.id, { archived: !b.archived });
            toast(b.archived ? "Back in your library." : "Tucked into your archive.");
            onClose();
          }}
        >
          {b.archived ? <RotateCcw size={15} /> : <Archive size={15} />}{" "}
          {b.archived ? "Restore" : "Archive"}
        </button>
      </div>
      {collectionId && b.listIds.includes(collectionId) && (
        <button
          className="text-button collection-unlink"
          onClick={() => {
            update(b.id, { listIds: b.listIds.filter((id) => id !== collectionId) });
            toast("Removed from this collection. The bookmark is still in your library.");
            onClose();
          }}
        >
          <FolderMinus size={16} /> Remove from this collection
        </button>
      )}
      {b.lastChecked && (
        <p className="small muted">
          Link checked {new Date(b.lastChecked).toLocaleDateString()} ·{" "}
          {b.status === "unreachable" ? "Could not verify; it may still work" : b.status}
        </p>
      )}
      <footer className="modal-footer">
        <button
          className="text-button danger"
          onClick={() => {
            update(b.id, { deletedAt: Date.now() });
            toast("Bookmark moved to trash. Restore it in Settings.");
            onClose();
          }}
        >
          <Trash2 size={15} /> Move to trash
        </button>
        <button className="button primary" onClick={save}>
          <Check size={16} /> Save changes
        </button>
      </footer>
    </Modal>
  );
}
