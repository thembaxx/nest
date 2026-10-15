"use client";
import { useState } from "react";
import {
  Plus,
  MagnifyingGlass,
  DotsThree,
  ArrowUpRight,
  FolderSimple,
  Leaf,
  CaretDown,
} from "@phosphor-icons/react";
import type { Bookmark, BookmarkList } from "@/lib/types";
export function CollectionsSection({
  collections,
  bookmarks,
  onOpen,
  onManage,
  onCreate,
}: {
  collections: BookmarkList[];
  bookmarks: Bookmark[];
  onOpen: (id: string) => void;
  onManage: (id: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const counts = new Map<string, number>();
  for (const bookmark of bookmarks)
    if (!bookmark.archived && !bookmark.deletedAt)
      for (const id of bookmark.listIds) counts.set(id, (counts.get(id) || 0) + 1);
  const visible = collections
    .filter((list) => list.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) =>
      sort === "count"
        ? (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.name.localeCompare(b.name)
        : sort === "updated"
          ? b.updatedAt - a.updatedAt
          : a.name.localeCompare(b.name),
    );
  return (
    <section className="collections-section" aria-label="Your collections">
      <div className="section-title">
        <h2>
          Your collections <span>{collections.length}</span>
        </h2>
        <button className="text-button" onClick={onCreate}>
          New collection <Plus size={14} />
        </button>
      </div>
      {collections.length > 0 && (
        <div className="collections-controls">
          <label className="collection-search">
            <MagnifyingGlass size={17} />
            <input
              aria-label="Search collections"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a collection…"
            />
          </label>
          <label className="collection-sort">
            <select
              aria-label="Sort collections"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="name">Name A–Z</option>
              <option value="count">Most bookmarks</option>
              <option value="updated">Recently changed</option>
            </select>
            <CaretDown size={14} />
          </label>
        </div>
      )}
      <div className="collection-cards">
        {visible.map((list, index) => (
          <div className="collection-tile" key={list.id}>
            <button
              className={`collection-card collection-${list.color}`}
              onClick={() => onOpen(list.id)}
            >
              <div className={`collection-art collection-art-${index % 3}`} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span className="collection-top">
                <FolderSimple size={19} />
                <span className="collection-number">
                  {String(counts.get(list.id) || 0).padStart(2, "0")}
                </span>
              </span>
              <div className="collection-caption">
                <h3>{list.name}</h3>
                <p>
                  {counts.get(list.id) || 0} bookmark{counts.get(list.id) === 1 ? "" : "s"}
                  <ArrowUpRight size={14} />
                </p>
              </div>
            </button>
            <button
              className="collection-manage icon-button"
              aria-label={`Manage ${list.name}`}
              onClick={() => onManage(list.id)}
            >
              <DotsThree size={21} />
            </button>
          </div>
        ))}
        {!collections.length && (
          <button className="collection-card collection-create" onClick={onCreate}>
            <Leaf size={25} />
            <h3>A place for your next rabbit hole</h3>
            <p>Create your first collection</p>
          </button>
        )}
      </div>
      {!!collections.length && !visible.length && (
        <p className="collection-no-results">
          No collections match “{query}”.{" "}
          <button className="text-button" onClick={() => setQuery("")}>
            Show all collections
          </button>
        </p>
      )}
      {collections.length > 3 && (
        <p className="collection-total">
          {visible.length} of {collections.length} collections · A place for every curiosity.
        </p>
      )}
    </section>
  );
}
