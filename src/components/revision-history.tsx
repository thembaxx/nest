"use client";

import { useEffect, useState } from "react";
import {
  parseRevisionHistory,
  previewRevision,
  restoreRevision,
  REVISION_HISTORY_KEY,
  type Revision,
} from "@/lib/revision-history";
import { useLibrary } from "./library-provider";

export function RevisionHistory() {
  const { library, setLibrary, toast } = useLibrary();
  const [history, setHistory] = useState<Revision[]>([]);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => {
      try {
        setHistory(parseRevisionHistory(localStorage.getItem(REVISION_HISTORY_KEY)));
        setError("");
      } catch {
        setError("Recovery history could not be read on this device.");
      }
    };
    refresh();
    window.addEventListener("nest-revisions-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("nest-revisions-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const preview = selected ? previewRevision(selected, library) : null;
  return (
    <section className="settings-section" aria-labelledby="recovery-title">
      <h3 id="recovery-title">Conflict recovery</h3>
      <p className="small muted">
        Review versions replaced during a merge. The latest 100 revisions, up to 1 MB, stay on this
        device only. Clearing browser data removes them; cloud backups do not contain this history.
      </p>
      {error && <p role="alert">{error}</p>}
      {history.length === 0 ? (
        <p>No replaced versions have been recorded on this device.</p>
      ) : (
        <ul>
          {history.map((revision) => (
            <li key={revision.id}>
              <button className="button" type="button" onClick={() => setSelected(revision)}>
                {revision.kind === "bookmark" ? revision.record.title : revision.record.name} ·{" "}
                {new Date(revision.capturedAt).toLocaleString()}
              </button>
            </li>
          ))}
        </ul>
      )}
      {preview && selected && (
        <div className="panel">
          <h4>Preview: {preview.label}</h4>
          <p>
            Changed fields: {preview.changedFields.join(", ") || "No content difference"}.{" "}
            {preview.willDelete
              ? "This version is a removed record."
              : "Restoring creates a new current version."}
          </p>
          <details>
            <summary>Current contents</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(preview.current, null, 2)}
            </pre>
          </details>
          <details open>
            <summary>Saved version to restore</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(preview.saved, null, 2)}
            </pre>
          </details>
          <button
            className="button primary"
            type="button"
            onClick={() => {
              setLibrary((current) => restoreRevision(current, selected));
              setSelected(null);
              toast(
                "Saved version restored with a new timestamp. Connected devices receive it on the next successful sync.",
              );
            }}
          >
            Confirm restoration
          </button>
          <button className="button" type="button" onClick={() => setSelected(null)}>
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
