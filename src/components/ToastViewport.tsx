import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
};

type ToastViewportProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

const toastIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

export default function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) => window.setTimeout(() => onDismiss(toast.id), 4200));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [onDismiss, toasts]);

  return (
    <div className="pvx-toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = toastIcons[toast.tone];
        return (
          <article key={toast.id} className={`pvx-toast pvx-toast-${toast.tone}`} role="status">
            <div className="pvx-toast-icon">
              <Icon className="h-4 w-4" />
            </div>
            <div className="pvx-toast-copy">
              <strong>{toast.title}</strong>
              {toast.message && <p>{toast.message}</p>}
            </div>
            <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </button>
          </article>
        );
      })}
    </div>
  );
}
