"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"

// ─── Types ────────────────────────────────────────────

type ToastVariant = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

// ─── Context ──────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback for components outside provider — log to console instead of crashing
    return {
      addToast: (msg, variant) => console.warn(`[toast:${variant ?? "info"}]`, msg),
      success: (msg) => console.log("[toast:success]", msg),
      error: (msg) => console.error("[toast:error]", msg),
      warning: (msg) => console.warn("[toast:warning]", msg),
      info: (msg) => console.log("[toast:info]", msg),
    }
  }
  return ctx
}

// ─── Variant Styles ───────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
  success: {
    bg: "bg-green-950/90",
    border: "border-green-700",
    icon: "\u2713", // checkmark
  },
  error: {
    bg: "bg-red-950/90",
    border: "border-red-700",
    icon: "\u2717", // x mark
  },
  warning: {
    bg: "bg-yellow-950/90",
    border: "border-yellow-700",
    icon: "\u26A0", // warning sign
  },
  info: {
    bg: "bg-blue-950/90",
    border: "border-blue-700",
    icon: "\u2139", // info
  },
}

const VARIANT_TEXT: Record<ToastVariant, string> = {
  success: "text-green-300",
  error: "text-red-300",
  warning: "text-yellow-300",
  info: "text-blue-300",
}

// ─── Toast Item ───────────────────────────────────────

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), toast.duration - 300)
    const removeTimer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [toast.id, toast.duration, onDismiss])

  const style = VARIANT_STYLES[toast.variant]
  const textColor = VARIANT_TEXT[toast.variant]

  return (
    <div
      className={`
        flex items-start gap-2 px-4 py-3 rounded-lg border backdrop-blur-sm
        shadow-lg max-w-sm w-full
        ${style.bg} ${style.border}
        transition-all duration-300 ease-in-out
        ${exiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
      `}
      role="alert"
    >
      <span className={`text-sm mt-0.5 ${textColor}`}>{style.icon}</span>
      <p className={`text-sm flex-1 ${textColor}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-500 hover:text-gray-300 text-xs ml-2 mt-0.5 shrink-0"
        aria-label="Dismiss"
      >
        \u2715
      </button>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────

let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 4000) => {
      const id = `toast-${++toastCounter}-${Date.now()}`
      setToasts((prev) => [...prev.slice(-4), { id, message, variant, duration }])
    },
    []
  )

  const success = useCallback((msg: string) => addToast(msg, "success", 3000), [addToast])
  const error = useCallback((msg: string) => addToast(msg, "error", 5000), [addToast])
  const warning = useCallback((msg: string) => addToast(msg, "warning", 4000), [addToast])
  const info = useCallback((msg: string) => addToast(msg, "info", 3500), [addToast])

  return (
    <ToastContext.Provider value={{ addToast, success, error, warning, info }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
