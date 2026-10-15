"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowUp,
  CircleNotch as LoaderCircle,
  Sparkle as Sparkles,
  Shield,
  Check,
} from "@phosphor-icons/react";
import { Modal, NestMark } from "./ui";
import { useLibrary } from "./library-provider";
import { askModel, modelIsLoaded, loadModel, models, type AIPlan } from "@/lib/ai";
import { planLocalCommand, applyPlan } from "@/lib/commands";
import { searchScore, extractUrls } from "@/lib/bookmarks";
export function AssistantDialog({
  onClose,
  onSearch,
  onSettings,
  onAdd,
}: {
  onClose: () => void;
  onSearch: (query: string, ids?: string[]) => void;
  onSettings: () => void;
  onAdd: (text: string) => void;
}) {
  const { library, settings, setLibrary, toast } = useLibrary();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState<AIPlan | null>(null);
  const [error, setError] = useState("");
  async function ask(text = prompt) {
    if (!text.trim()) return;
    const existingAction =
      /^\s*(?:find|search|show|look|where|which|archive|delete|remove|favorite|unfavorite|mark|read)\b/i.test(
        text,
      );
    if (extractUrls(text).length && !existingAction) {
      onAdd(text);
      return;
    }
    setPrompt(text);
    setError("");
    setPlan(null);
    const localPlan = planLocalCommand(text, library);
    if (localPlan) {
      setPlan(localPlan);
      return;
    }
    if (!settings.model) {
      onSearch(text);
      onClose();
      return;
    }
    setBusy(true);
    try {
      if (!modelIsLoaded(settings.model)) {
        setStatus("Waking up your local companion…");
        await loadModel(settings.model, (p) =>
          setStatus(`Loading local model · ${Math.round(p * 100)}%`),
        );
      }
      setStatus("Connecting the dots…");
      const p = await askModel(text, library);
      setPlan(p);
      if (p.action === "search") {
        onSearch(text, p.ids);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not understand that request.");
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    if (!plan) return;
    try {
      const updated = applyPlan(library, plan);
      setLibrary(updated);
      toast(`${plan.ids.length} bookmark${plan.ids.length === 1 ? "" : "s"} updated.`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not apply this instruction.");
    }
  }

  return (
    <Modal
      title="A little help finding things."
      subtitle={
        settings.model
          ? "Your private, on-device companion."
          : "Describe what you remember. Let’s follow the thread."
      }
      onClose={onClose}
    >
      <div className="assistant-illustration">
        <NestMark />
        <span>
          Less searching.
          <br />
          <em>More finding.</em>
        </span>
        <i />
        <i />
      </div>
      {!settings.model && (
        <div className="note-box">
          <Sparkles size={19} />
          <div>
            <strong>Make room for a clever little companion.</strong>
            <p>
              Keyword search and simple instructions work now: move, favorite, archive, or mark
              links read. Download an optional local model for more nuanced requests.
            </p>
            <button className="text-button" onClick={onSettings}>
              Explore local AI <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      )}
      <div className="prompt-suggestions">
        {[
          "Find something about accessible web design",
          "Show my gardening bookmarks",
          'Move my design bookmarks to "Project ideas"',
        ].map((s) => (
          <button key={s} onClick={() => void ask(s)} disabled={busy}>
            {s}
            <ArrowUpRight size={14} />
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <div className="assistant-input">
          <textarea
            aria-label="Instructions for Nest"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={1000}
            placeholder="I’m looking for that thing about…"
            disabled={busy}
          />
          <button
            type="submit"
            className="button primary circle"
            disabled={busy || !prompt.trim()}
            aria-label="Ask Nest"
          >
            {busy ? <LoaderCircle className="spin" size={19} /> : <ArrowUp size={20} />}
          </button>
        </div>
      </form>
      {busy && <output className="small muted">{status}</output>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {plan && (
        <div className="ai-plan">
          <span className="eyebrow">
            {plan.action === "search" ? "FOUND IN YOUR LIBRARY" : "A LITTLE PLAN FOR YOU"}
          </span>
          <p>{plan.explanation}</p>
          <ul>
            {plan.ids
              .map((id) => library.bookmarks.find((b) => b.id === id))
              .filter(Boolean)
              .map((b) => (
                <li key={b!.id}>
                  <Check size={14} />
                  {b!.title}
                </li>
              ))}
          </ul>
          {plan.action !== "search" && (
            <button className="button primary" onClick={apply} disabled={!plan.ids.length}>
              Apply to {plan.ids.length} bookmarks <ArrowUpRight size={16} />
            </button>
          )}
          {plan.action === "search" && (
            <button className="button primary" onClick={onClose}>
              See {plan.ids.length} results <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      )}
      <p className="assistant-privacy">
        <Shield size={12} />
        {settings.model
          ? `${models.find((m) => m.id === settings.model)?.name} · Runs on this device`
          : "Your curiosity stays yours."}
      </p>
      {!settings.model && prompt && !plan && (
        <span className="sr-only">
          {library.bookmarks.filter((b) => searchScore(b, prompt) > 0).length} basic search matches
        </span>
      )}
    </Modal>
  );
}
