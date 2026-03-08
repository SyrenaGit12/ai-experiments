"use client"

import { useEffect } from "react"

export default function ControlTowerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[control-tower] Unhandled error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-5xl">⚠️</div>
      <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
      <p className="text-sm text-gray-400 max-w-md text-center">
        An unexpected error occurred in the Control Tower.
        {error.message && (
          <span className="block mt-2 text-red-400 font-mono text-xs">
            {error.message}
          </span>
        )}
      </p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
      >
        Try again
      </button>
    </div>
  )
}
