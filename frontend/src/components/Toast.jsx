// src/components/Toast.jsx
import { useEffect, useState } from "react";

const ICONS = {
  success: (
    <svg className="w-5 h-5 text-scai-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-scai-error flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-scai-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
    </svg>
  ),
  pending: (
    <span className="spinner flex-shrink-0" />
  ),
};

const BORDERS = {
  success: "border-scai-success/30",
  error:   "border-scai-error/30",
  info:    "border-scai-accent/30",
  pending: "border-scai-primary/30",
};

/**
 * Single toast notification.
 * Props: { id, type, message, link, linkLabel, onDismiss, duration }
 */
export function Toast({ id, type = "info", message, link, linkLabel = "View", onDismiss, duration = 6000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const t1 = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss (skip for pending toasts)
    const t2 = type !== "pending"
      ? setTimeout(() => { setVisible(false); setTimeout(() => onDismiss(id), 300); }, duration)
      : null;
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2); };
  }, [id, type, duration, onDismiss]);

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl
        glass-card border ${BORDERS[type]}
        shadow-card w-full max-w-sm
        transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
    >
      {ICONS[type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-scai-text leading-snug">{message}</p>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-scai-primary hover:text-scai-plit transition-colors"
          >
            {linkLabel}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
      {type !== "pending" && (
        <button
          onClick={() => { setVisible(false); setTimeout(() => onDismiss(id), 300); }}
          className="text-scai-muted hover:text-scai-text transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Toast container + state manager.
 * Usage:
 *   const { toasts, addToast, dismissToast } = useToast();
 *   <ToastContainer toasts={toasts} onDismiss={dismissToast} />
 */
export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast {...t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

let _nextId = 1;
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (opts) => {
    const id = _nextId++;
    setToasts(prev => [...prev, { id, ...opts }]);
    return id;
  };

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const updateToast = (id, opts) =>
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...opts } : t));

  return { toasts, addToast, dismissToast, updateToast };
}
