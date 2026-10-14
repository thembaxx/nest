"use client";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Heart, MoreHorizontal, Check } from "lucide-react";
import type { Bookmark } from "@/lib/types";
import { useLibrary } from "./library-provider";
export function BookmarkCard({
  bookmark: b,
  onOpen,
  list = false,
  index = 0,
}: {
  bookmark: Bookmark;
  onOpen: () => void;
  list?: boolean;
  index?: number;
}) {
  const { update } = useLibrary();
  const reduced = useReducedMotion();
  const host = new URL(b.url).hostname.replace(/^www\./, "");
  return (
    <motion.article
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.035, 0.2) }}
      className={`bookmark-card ${list ? "row" : ""}`}
      drag={list && !reduced ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_e, info) => {
        if (info.offset.x > 110) update(b.id, { read: true });
        else if (info.offset.x < -110) update(b.id, { favorite: !b.favorite });
      }}
    >
      <button
        className={`card-cover art-${b.art || b.topic.toLowerCase().split(" ")[0]}`}
        onClick={onOpen}
        aria-label={`View ${b.title}`}
      >
        {b.art ? (
          <img src={`/art/${b.art}.svg`} alt="" loading="lazy" />
        ) : (
          <div className="generated-cover">
            <span>{host.slice(0, 1).toUpperCase()}</span>
            <span>{b.topic}</span>
          </div>
        )}
        <span className="cover-corner">
          <ArrowUpRight size={16} />
        </span>
        {b.read && (
          <span className="read-label">
            <Check size={12} /> Read
          </span>
        )}
      </button>
      <div className="card-content">
        <div className="card-source">
          <span className={`site-icon site-${b.art || "default"}`}>
            {host === "are.na" ? "▧" : host.charAt(0).toUpperCase()}
          </span>
          <span>{host}</span>
          <button
            className={`favorite ${b.favorite ? "is-favorite" : ""}`}
            onClick={() => update(b.id, { favorite: !b.favorite })}
            aria-label={`${b.favorite ? "Unfavorite" : "Favorite"} ${b.title}`}
            aria-pressed={b.favorite}
          >
            <Heart size={16} fill={b.favorite ? "currentColor" : "none"} />
          </button>
        </div>
        <button className="card-title" onClick={onOpen}>
          {b.title}
        </button>
        <p>{b.description || "A little find, saved for another day."}</p>
        <footer>
          <button
            className={`topic-tag tag-${b.topic.toLowerCase().split(" ")[0]}`}
            onClick={onOpen}
          >
            {b.topic}
          </button>
          <button className="card-more" onClick={onOpen} aria-label={`Edit ${b.title}`}>
            <MoreHorizontal size={19} />
          </button>
        </footer>
      </div>
    </motion.article>
  );
}
