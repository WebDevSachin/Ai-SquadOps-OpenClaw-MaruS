"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = 5000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, message, type, duration };
      
      setToasts((prev) => [...prev, newToast]);

      // Auto remove after duration
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// Custom hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Individual Toast Item
interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastClasses = {
  success: "toast-success",
  error: "toast-error",
  warning: "toast-warning",
  info: "toast-info",
};

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isEntering, setIsEntering] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const Icon = toastIcons[toast.type];

  useEffect(() => {
    // Trigger enter animation
    const timer = setTimeout(() => setIsEntering(false), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const enterClass = isEntering ? "toast-enter" : "";
  const exitClass = isExiting ? "toast-exit" : "";

  return (
    <div
      className={`${toastClasses[toast.type]} ${enterClass} ${exitClass}`}
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={handleRemove}
        className="p-1 hover:bg-white/10 rounded transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Toast Container
interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Helper functions for common toast types
export function useToastHelpers() {
  const { showToast } = useToast();

  return {
    success: (message: string, duration?: number) =>
      showToast(message, "success", duration),
    error: (message: string, duration?: number) =>
      showToast(message, "error", duration),
    warning: (message: string, duration?: number) =>
      showToast(message, "warning", duration),
    info: (message: string, duration?: number) =>
      showToast(message, "info", duration),
  };
}
