"use client";
import { useState } from "react";
import { ArrowRight, Upload, Sparkle as Sparkles } from "@phosphor-icons/react";
import { Modal, NestMark } from "./ui";
import { useLibrary } from "./library-provider";
import { personalLibrary } from "@/lib/backup";
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
      title={step === 0 ? "Welcome to Nest" : "Make Nest yours"}
      onClose={() => {
        setSettings({ onboarded: true });
        onClose();
      }}
    >
      <div className="onboarding-art" aria-hidden="true">
        <NestMark />
      </div>
      <div className="onboarding-copy">
        <p>
          {step === 0
            ? "Save and organize your links. Import bookmarks or explore the sample library."
            : "Start with sample links or an empty library. Your own links stay in this browser; export a backup before clearing site data. AI is optional."}
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
                setLibrary(personalLibrary);
                setSettings({ onboarded: true });
                onClose();
              }}
            >
              Start with an empty Nest
            </button>
          </div>
        </>
      )}
      <div className="step-dots" aria-hidden="true">
        <span className={step === 0 ? "active" : ""} />
        <span className={step === 1 ? "active" : ""} />
      </div>
    </Modal>
  );
}
