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
      <g transform="translate(-2 -2) scale(.68)" fill="currentColor">
        <path d="M12 24c0-7 4-12 11-12 4 0 7 2 10 6l-9 7v20c0 6-4 9-11 9-1 0-1-2-1-4V24Z" />
        <path d="M38 31c5-5 10-8 12-7 2 0 2 2 2 5v20c0 5-4 7-8 6l-6-24Z" />
        <path d="M13 19c2-6 6-8 11-8 8 0 12 8 16 18l7 16c2 4 3 5 5 3v2c0 4-5 6-9 5-8-1-11-10-15-20l-5-13c-3-7-7-8-10-3Z" />
        <circle cx="47" cy="17.5" r="4.3" />
      </g>
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
