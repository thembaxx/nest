"use client";
import { useState } from "react";
import {
  ArrowRight,
  Upload,
  Check,
  Sparkle as Sparkles,
  Leaf,
  LinkSimple as Link,
} from "@phosphor-icons/react";
import { Modal, NestMark } from "./ui";
import { useLibrary } from "./library-provider";
export function OnboardingDialog({
  onClose,
  onImport,
  onAI,
}: {
  onClose: () => void;
  onImport: () => void;
  onAI: () => void;
}) {
  const [step, setStep] = useState(0);
  const { setSettings, setLibrary } = useLibrary();
  return (
    <Modal
      title={step === 0 ? "Good things deserve a little home." : "A calmer corner of the internet."}
      onClose={() => {
        setSettings({ onboarded: true });
        onClose();
      }}
    >
      <div className="onboarding-art">
        <div className="floating-link">
          <Link size={16} /> A lovely little find <Check size={14} />
        </div>
        <NestMark />
        <div className="floating-link second">
          <Leaf size={16} /> Tucked away, naturally.
        </div>
      </div>
      <div className="onboarding-copy">
        <span className="eyebrow">WELCOME TO NEST</span>
        <h3>
          {step === 0 ? (
            <>
              For everything that
              <br />
              sparks your curiosity.
            </>
          ) : (
            <>
              Less tending.
              <br />
              More discovering.
            </>
          )}
        </h3>
        <p>
          {step === 0
            ? "Save a thought, a rabbit hole, a someday. Nest keeps your links organized, so you can get back to the good part."
            : "Your library lives on your device first. Enable cloud sync when you’re ready, and add a private AI companion only if you want one."}
        </p>
      </div>
      {step === 0 ? (
        <div className="onboarding-buttons">
          <button
            className="button primary"
            onClick={() => {
              setSettings({ onboarded: true });
              onImport();
            }}
          >
            <Upload size={16} /> Import my bookmarks
          </button>
          <button className="button secondary" onClick={() => setStep(1)}>
            A little look around <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="onboarding-options">
            <label htmlFor="onboard-sort" aria-label="Let Nest organize your links">
              <input
                id="onboard-sort"
                type="checkbox"
                defaultChecked
                onChange={(e) => setSettings({ autoSort: e.target.checked })}
              />
              <span>
                <strong>Let Nest organize your links</strong>
                <small>A little less organizing, automatically.</small>
              </span>
            </label>
            <button
              onClick={() => {
                setSettings({ onboarded: true });
                onAI();
              }}
            >
              <Sparkles size={20} />
              <span>
                <strong>Meet your optional local AI</strong>
                <small>Private, on-device. Download it when you’re ready.</small>
              </span>
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="onboarding-buttons">
            <button
              className="button primary"
              onClick={() => {
                setSettings({ onboarded: true });
                onClose();
              }}
            >
              Explore the sample library <ArrowRight size={16} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                setLibrary((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => !b.demo) }));
                setSettings({ onboarded: true });
                onClose();
              }}
            >
              Start with an empty Nest
            </button>
          </div>
        </>
      )}
      <div className="step-dots">
        <span className={step === 0 ? "active" : ""} />
        <span className={step === 1 ? "active" : ""} />
      </div>
    </Modal>
  );
}
