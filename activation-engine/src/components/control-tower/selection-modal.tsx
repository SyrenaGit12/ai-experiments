"use client"

import { useState } from "react"

interface Member {
  id: string
  userId: string
  side: string
  displayName: string | null
  email: string | null
  investorTier: string | null
  engagementScore: number
  stage: number
  matchesPresentedIds: string[] | null
  selectedMatchIds: string[] | null
  respondedAt: string | null
  stageCompletedAt: string | null
}

interface Pair {
  id: string
  investorId: string
  founderId: string
  investorName: string | null
  founderName: string | null
  investorEmail: string | null
  founderEmail: string | null
  score: number
  presentedToInvestor: boolean
  presentedToFounder: boolean
}

interface SelectionModalProps {
  member: Member
  pairs: Pair[]
  poolId: string
  onClose: () => void
  onSaved: () => void
}

export function SelectionModal({
  member,
  pairs,
  poolId,
  onClose,
  onSaved,
}: SelectionModalProps) {
  const presentedIds = (member.matchesPresentedIds ?? []) as string[]

  // Find the presented matches for this member
  const presentedPairs = pairs.filter((p) => {
    if (member.side === "INVESTOR") {
      return p.investorId === member.userId && p.presentedToInvestor
    } else {
      return p.founderId === member.userId && p.presentedToFounder
    }
  })

  // For each presented pair, the "match" is the user on the other side
  const matchOptions = presentedPairs.map((p) => {
    if (member.side === "INVESTOR") {
      return {
        userId: p.founderId,
        name: p.founderName ?? "Unknown",
        email: p.founderEmail ?? "",
        score: p.score,
      }
    } else {
      return {
        userId: p.investorId,
        name: p.investorName ?? "Unknown",
        email: p.investorEmail ?? "",
        score: p.score,
      }
    }
  })

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  function toggleMatch(userId: string) {
    const next = new Set(selected)
    if (next.has(userId)) {
      next.delete(userId)
    } else {
      next.add(userId)
    }
    setSelected(next)
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      if (!confirm("No matches selected. Record an empty selection?")) return
    }

    setSaving(true)
    const res = await fetch(
      `/api/pools/${poolId}/members/${member.id}/select`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedMatchIds: Array.from(selected) }),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? "Failed to record selection")
      setSaving(false)
      return
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-white font-semibold">Record Selection</h3>
              <p className="text-gray-400 text-sm mt-0.5">
                {member.displayName ?? "Unknown"} ({member.side})
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            {member.side === "INVESTOR"
              ? "Select the founders this investor wants to meet (can select multiple)"
              : "Select the investors this founder wants to meet (can select multiple)"}
          </p>
        </div>

        {/* Match options */}
        <div className="p-4 space-y-2">
          {matchOptions.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">
              No matches were presented to this member.
            </p>
          )}

          {matchOptions.map((match) => (
            <button
              key={match.userId}
              onClick={() => toggleMatch(match.userId)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                selected.has(match.userId)
                  ? "bg-blue-900/30 border-blue-600"
                  : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
              }`}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                  selected.has(match.userId)
                    ? "border-blue-500 bg-blue-600"
                    : "border-gray-600"
                }`}
              >
                {selected.has(match.userId) && (
                  <span className="text-white text-xs">✓</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {match.name}
                </p>
                <p className="text-gray-500 text-xs truncate">{match.email}</p>
              </div>
              <span className="text-gray-500 text-xs font-mono shrink-0">
                {match.score.toFixed(1)}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {selected.size} of {matchOptions.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Record Selection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
