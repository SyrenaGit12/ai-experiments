"use client"

import { useState } from "react"

interface Pair {
  id: string
  investorId: string
  founderId: string
  investorName: string | null
  founderName: string | null
  investorSelected: boolean
  founderSelected: boolean
  crossMatchOutcome: string | null
  score: number
  investorFeedback?: string | null
  investorFeedbackPositive?: boolean | null
  founderFeedback?: string | null
  founderFeedbackPositive?: boolean | null
  feedbackDeliveredAt?: string | null
}

interface FeedbackFormProps {
  pair: Pair
  poolId: string
  onClose: () => void
  onSaved: () => void
}

const outcomeLabels: Record<string, { label: string; color: string }> = {
  MUTUAL_YES: { label: "Mutual Match", color: "text-green-300" },
  INVESTOR_ONLY: { label: "Investor Only", color: "text-blue-300" },
  FOUNDER_ONLY: { label: "Founder Only", color: "text-blue-300" },
  NO_MATCH: { label: "No Match", color: "text-red-400" },
  PENDING: { label: "Pending", color: "text-yellow-400" },
}

export function FeedbackForm({
  pair,
  poolId,
  onClose,
  onSaved,
}: FeedbackFormProps) {
  const [side, setSide] = useState<"INVESTOR" | "FOUNDER">("INVESTOR")
  const [feedback, setFeedback] = useState("")
  const [positive, setPositive] = useState(true)
  const [sendEmail, setSendEmail] = useState(false)
  const [saving, setSaving] = useState(false)

  const outcome = pair.crossMatchOutcome ?? "PENDING"
  const outcomeInfo = outcomeLabels[outcome] ?? outcomeLabels.PENDING

  async function handleSubmit() {
    setSaving(true)
    const res = await fetch(
      `/api/pools/${poolId}/pairs/${pair.id}/feedback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, feedback, positive, sendEmail }),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? "Failed to record feedback")
      setSaving(false)
      return
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-white font-semibold">Record Feedback</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 text-sm">
                  {pair.investorName ?? "Unknown"} × {pair.founderName ?? "Unknown"}
                </span>
                <span className={`text-xs font-medium ${outcomeInfo.color}`}>
                  {outcomeInfo.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Selection status */}
        <div className="px-4 pt-3 flex gap-4 text-xs">
          <span className={pair.investorSelected ? "text-green-400" : "text-gray-500"}>
            {pair.investorSelected ? "✓" : "✗"} Investor selected
          </span>
          <span className={pair.founderSelected ? "text-green-400" : "text-gray-500"}>
            {pair.founderSelected ? "✓" : "✗"} Founder selected
          </span>
        </div>

        {/* Existing feedback display */}
        {(pair.investorFeedback || pair.founderFeedback) && (
          <div className="mx-4 mt-3 p-3 bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Previous feedback:</p>
            {pair.investorFeedback && (
              <p className="text-xs text-gray-300">
                Investor ({pair.investorFeedbackPositive ? "👍" : "👎"}): {pair.investorFeedback}
              </p>
            )}
            {pair.founderFeedback && (
              <p className="text-xs text-gray-300 mt-1">
                Founder ({pair.founderFeedbackPositive ? "👍" : "👎"}): {pair.founderFeedback}
              </p>
            )}
          </div>
        )}

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Side selector */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Feedback from
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSide("INVESTOR")}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  side === "INVESTOR"
                    ? "bg-blue-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                Investor
              </button>
              <button
                onClick={() => setSide("FOUNDER")}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  side === "FOUNDER"
                    ? "bg-purple-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                Founder
              </button>
            </div>
          </div>

          {/* Positive/Negative toggle */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Outcome
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setPositive(true)}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  positive
                    ? "bg-green-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                👍 Positive
              </button>
              <button
                onClick={() => setPositive(false)}
                className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                  !positive
                    ? "bg-red-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                👎 Negative
              </button>
            </div>
          </div>

          {/* Feedback text */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Feedback notes (optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Any notes about the feedback..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 resize-none"
              rows={3}
            />
          </div>

          {/* Send email checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600"
            />
            <span className="text-sm text-gray-300">
              Send feedback email to the other side
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Record Feedback"}
          </button>
        </div>
      </div>
    </div>
  )
}
