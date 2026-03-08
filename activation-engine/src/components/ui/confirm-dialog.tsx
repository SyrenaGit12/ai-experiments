"use client"

import { useCallback, useEffect, useRef, type ReactNode } from "react"

// ─── Types ────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description?: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning" | "info"
  loading?: boolean
}

// ─── Variant Styles ───────────────────────────────────

const VARIANT_STYLES = {
  danger: {
    icon: "⚠️",
    confirmBg: "bg-red-600 hover:bg-red-500",
    border: "border-red-800/50",
  },
  warning: {
    icon: "⚡",
    confirmBg: "bg-amber-600 hover:bg-amber-500",
    border: "border-amber-800/50",
  },
  info: {
    icon: "ℹ️",
    confirmBg: "bg-blue-600 hover:bg-blue-500",
    border: "border-blue-800/50",
  },
} as const

// ─── Component ────────────────────────────────────────

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const style = VARIANT_STYLES[variant]

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel()
    },
    [onCancel, loading]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, handleKeyDown])

  // Focus trap — focus the dialog when it opens
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        tabIndex={-1}
        className={`
          relative z-10 w-full max-w-md mx-4
          bg-gray-900 border ${style.border} rounded-xl shadow-2xl
          animate-in fade-in zoom-in-95 duration-200
        `}
      >
        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">{style.icon}</span>
            <div>
              <h3
                id="confirm-title"
                className="text-lg font-semibold text-white"
              >
                {title}
              </h3>
              {description && (
                <div
                  id="confirm-desc"
                  className="mt-1 text-sm text-gray-400 leading-relaxed"
                >
                  {description}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 text-sm text-white rounded-lg ${style.confirmBg} disabled:opacity-50 transition-colors flex items-center gap-2`}
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
