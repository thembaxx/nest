"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, FileArrowUp, ShieldCheck } from "@phosphor-icons/react";
import { Modal } from "./ui";

const steps = ["Export", "Prepare", "Import"];

export function XImportWizard({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: () => void;
}) {
  const [step, setStep] = useState(0);

  return (
    <Modal
      title="Bring your X bookmarks home."
      subtitle="Three small steps. No X login in Nest, subscriptions, or automatic syncing."
      onClose={onClose}
    >
      <ol className="x-import-steps" aria-label="Import progress">
        {steps.map((label, index) => (
          <li
            key={label}
            className={step === index ? "active" : step > index ? "complete" : ""}
            aria-current={step === index ? "step" : undefined}
          >
            <span aria-hidden="true">{step > index ? <Check size={14} /> : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="x-import-content" aria-labelledby="x-import-heading">
          <h3 id="x-import-heading">Get your bookmarks from X</h3>
          <p>
            Open your saved posts in desktop Chrome. If X sends you to Saved, select the
            Bookmarks tab. X does not provide a simple built-in bookmark CSV download.
          </p>
          <div className="x-import-actions">
            <a
              className="button secondary"
              href="https://x.com/i/bookmarks"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open X bookmarks <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="note-box">
            <strong>Use a bookmark exporter</strong>
            <p>
              For example, a third-party Chrome extension can collect loaded X bookmarks and
              export a CSV. Review its permissions and privacy practices before installing it.
              Nest is not affiliated with the extension or X.
            </p>
            <a
              className="button secondary"
              href="https://chromewebstore.google.com/detail/x-bookmarks-exporter-loca/ohhjbbjbiajeflompcahgdiiindfeiao"
              target="_blank"
              rel="noopener noreferrer"
            >
              View example exporter <ArrowUpRight size={15} />
            </a>
          </div>
          <p className="small muted">
            On iPhone or iPad? Export on a desktop first, then send the CSV to your device.
            Never paste your X password, cookies, or access tokens into Nest.
          </p>
        </section>
      )}

      {step === 1 && (
        <section className="x-import-content" aria-labelledby="x-import-heading">
          <h3 id="x-import-heading">Save a CSV you can review</h3>
          <ol className="x-import-instructions">
            <li>In the exporter, collect your bookmarks and choose CSV.</li>
            <li>Save the file somewhere you can find it (Downloads is fine).</li>
            <li>Check that it has a URL or Link column containing post links.</li>
          </ol>
          <div className="note-box">
            <FileArrowUp size={22} />
            <div>
              <strong>CSV format · up to 20 MB</strong>
              <p>
                Nest can preserve exported post text and author information when those columns
                are available. Some exporters limit each batch; import additional files separately.
                Existing links are detected before saving.
              </p>
            </div>
          </div>
          <p className="small muted">
            An official X account archive is not a guaranteed bookmark export. Avoid uploading
            your full account archive: it may contain unrelated private information.
          </p>
        </section>
      )}

      {step === 2 && (
        <section className="x-import-content" aria-labelledby="x-import-heading">
          <h3 id="x-import-heading">Import into Nest</h3>
          <p>
            Select your exported CSV in Nest. You can preview the total and any matching links
            before confirming. Your original X bookmarks will not be changed.
          </p>
          <div className="note-box">
            <ShieldCheck size={23} />
            <div>
              <strong>Your import is under your control</strong>
              <p>
                The file is parsed in your browser. Bookmarks follow your existing local storage
                and optional sync settings. Turning this feature off later does not delete them.
              </p>
            </div>
          </div>
        </section>
      )}

      <footer className="modal-footer x-import-footer">
        <button
          type="button"
          className="button secondary"
          disabled={step === 0}
          onClick={() => setStep((current) => Math.max(current - 1, 0))}
        >
          <ArrowLeft size={16} /> Back
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            className="button primary"
            onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}
          >
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" className="button primary" onClick={onImport}>
            Choose CSV in Nest <ArrowRight size={16} />
          </button>
        )}
      </footer>
    </Modal>
  );
}
