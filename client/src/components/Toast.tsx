import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export interface ToastMessage {
  id: number;
  text: string;
  accent?: boolean;
}

interface ToastContextValue {
  push: (text: string, opts?: { accent?: boolean }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (text: string, opts?: { accent?: boolean }) => {
      const id = nextId++;
      const message: ToastMessage = opts?.accent
        ? { id, text, accent: true }
        : { id, text };
      setToasts((list) => [...list, message]);
      window.setTimeout(() => remove(id), 5000);
    },
    [remove],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="sot-toast-region"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <Toast key={t.id} message={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: () => void;
}) {
  return (
    <div
      className={["sot-toast", message.accent ? "sot-toast--accent" : ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      <span>{message.text}</span>
      <button
        type="button"
        className="sot-btn sot-btn--ghost sot-btn--icon"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 2l10 10M12 2L2 12" />
        </svg>
      </button>
    </div>
  );
}
