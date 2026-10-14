"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X, ArrowUpRight } from "lucide-react";
export function NestMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="36"
      height="36"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path d="M7 22c0-9 9-16 23-15 1 13-7 23-16 23-4 0-7-3-7-8Z" fill="currentColor" />
      <path
        d="M13 27 26 13M14 21l7 0M20 21v-7"
        stroke="var(--logo-line, #f5f1d6)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9 32c7 2 16 0 23-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <NestMark />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ExternalArrow() {
  return <ArrowUpRight size={15} aria-hidden="true" />;
}
