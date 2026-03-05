"use client"

import { useState } from "react"

interface PersonalizationLine {
  id: string
  side: string
  line: string
  approved: boolean
  generatedAt: string
  approvedAt: string | null
}

interface PairWithLines {
  pairId: string
  investorName: string | null
  founderName: string | null
  score: number
  presentedToInvestor: boolean
  presentedToFounder: boolean
  lines: PersonalizationLine[]
}

interface Summary {
  totalPresentedPairs: number
  pairsWithBothLines: number
  pairsFullyApproved: number
  totalLines: number
  approved: number
  pending: number
  readyToSendInvestor: boolean
  readyToSendFounder: boolean
}

interface PersonalizationReviewProps {
  poolId: string
  onRefresh: () => void
}

export function PersonalizationReview({
  poolId,
  onRefresh,
}: PersonalizationReviewProps) {
  const [data, setData] = useState<{
    pairs: PairWithLines[]
    summary: Summary
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  async function fetchLines() {
    setLoading(true)
    const res = await fetch(`/api/pools/${poolId}/personalize`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  async function generateAll() {
    setGenerating(true)
    const res = await fetch(`/api/pools/${poolId}/personalize`, {
      method: "POST",
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? "Generation failed")
    }
    await fetchLines()
    setGenerating(false)
    onRefresh()
  }

  async function approveAll() {
    await fetch(`/api/pools/${poolId}/personalize`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_all" }),
    })
    await fetchLines()
    onRefresh()
  }

  async function approveLine(lineId: string) {
    await fetch(`/api/pools/${poolId}/personalize`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", lineIds: [lineId] }),
    })
    await fetchLines()
  }

  async function rejectLine(lineId: string) {
    await fetch(`/api/pools/${poolId}/personalize`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", lineIds: [lineId] }),
    })
    await fetchLines()
  }

  async function saveEdit(lineId: string) {
    await fetch(`/api/pools/${poolId}/personalize`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "edit", lineId, line: editText }),
    })
    setEditingLine(null)
    setEditText("")
    await fetchLines()
  }

  // Initial load
  if (!data && !loading) {
    fetchLines()
    return <p className="text-gray-400 text-sm">Loading personalization lines...</p>
  }

  if (loading && !data) {
    return <p className="text-gray-400 text-sm">Loading...</p>
  }

  if (!data) return null

  const { pairs, summary } = data

  return (
    <div>
      {/* Summary + Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-xs">
          <span className="text-gray-400">
            {summary.totalPresentedPairs} presented pairs
          </span>
          <span className="text-gray-400">
            {summary.totalLines} lines ({summary.approved} approved,{" "}
            {summary.pending} pending)
          </span>
          {summary.readyToSendInvestor && (
            <span className="text-green-400">✓ Ready for investor emails</span>
          )}
          {summary.readyToSendFounder && (
            <span className="text-green-400">✓ Ready for founder emails</span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={generateAll}
            disabled={generating}
            className="px-3 py-1.5 bg-purple-700 text-white rounded text-xs font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating..." : "Generate All"}
          </button>
          {summary.pending > 0 && (
            <button
              onClick={approveAll}
              className="px-3 py-1.5 bg-green-700 text-white rounded text-xs font-medium hover:bg-green-600 transition-colors"
            >
              Approve All ({summary.pending})
            </button>
          )}
          <button
            onClick={fetchLines}
            className="px-3 py-1.5 bg-gray-700 text-white rounded text-xs font-medium hover:bg-gray-600 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Readiness indicator */}
      {!summary.readyToSendInvestor && !summary.readyToSendFounder && summary.totalLines > 0 && (
        <div className="p-3 mb-4 bg-amber-900/20 border border-amber-800/30 rounded-lg text-xs text-amber-300">
          ⚠️ Emails are gated — all personalization lines must be approved before sending.
        </div>
      )}

      {/* Pair list */}
      {pairs.length === 0 && (
        <p className="text-gray-500 text-sm py-4 text-center">
          No presented pairs found. Generate a pool and present matches first.
        </p>
      )}

      <div className="space-y-3">
        {pairs.map((pair) => {
          const investorLine = pair.lines.find((l) => l.side === "INVESTOR")
          const founderLine = pair.lines.find((l) => l.side === "FOUNDER")

          return (
            <div
              key={pair.pairId}
              className="p-4 bg-gray-900 rounded-lg border border-gray-800"
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">
                    {pair.investorName ?? "Unknown"} × {pair.founderName ?? "Unknown"}
                  </span>
                  <span className="text-gray-500 text-xs font-mono">
                    Score: {pair.score.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {investorLine?.approved && founderLine?.approved ? (
                    <span className="text-green-400">✓ Fully approved</span>
                  ) : (
                    <span className="text-yellow-400">Pending</span>
                  )}
                </div>
              </div>

              {/* Investor line */}
              {pair.presentedToInvestor && (
                <LineRow
                  label="→ Investor sees"
                  line={investorLine}
                  editingLine={editingLine}
                  editText={editText}
                  onStartEdit={(l) => {
                    setEditingLine(l.id)
                    setEditText(l.line)
                  }}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => {
                    setEditingLine(null)
                    setEditText("")
                  }}
                  onEditTextChange={setEditText}
                  onApprove={approveLine}
                  onReject={rejectLine}
                />
              )}

              {/* Founder line */}
              {pair.presentedToFounder && (
                <LineRow
                  label="→ Founder sees"
                  line={founderLine}
                  editingLine={editingLine}
                  editText={editText}
                  onStartEdit={(l) => {
                    setEditingLine(l.id)
                    setEditText(l.line)
                  }}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => {
                    setEditingLine(null)
                    setEditText("")
                  }}
                  onEditTextChange={setEditText}
                  onApprove={approveLine}
                  onReject={rejectLine}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineRow({
  label,
  line,
  editingLine,
  editText,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTextChange,
  onApprove,
  onReject,
}: {
  label: string
  line: PersonalizationLine | undefined
  editingLine: string | null
  editText: string
  onStartEdit: (line: PersonalizationLine) => void
  onSaveEdit: (lineId: string) => void
  onCancelEdit: () => void
  onEditTextChange: (text: string) => void
  onApprove: (lineId: string) => void
  onReject: (lineId: string) => void
}) {
  if (!line) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-xs text-gray-500 w-28">{label}</span>
        <span className="text-xs text-gray-600 italic">Not generated yet</span>
      </div>
    )
  }

  const isEditing = editingLine === line.id

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-xs text-gray-500 w-28 shrink-0 pt-0.5">
        {label}
      </span>

      {isEditing ? (
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            maxLength={120}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
          />
          <button
            onClick={() => onSaveEdit(line.id)}
            className="px-2 py-1 bg-blue-700 text-white rounded text-xs hover:bg-blue-600"
          >
            Save
          </button>
          <button
            onClick={onCancelEdit}
            className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <p className="flex-1 text-xs text-indigo-300 italic">{line.line}</p>
          <div className="flex gap-1 shrink-0">
            {line.approved ? (
              <span className="px-2 py-0.5 bg-green-900/50 text-green-300 rounded text-xs">
                ✓
              </span>
            ) : (
              <>
                <button
                  onClick={() => onApprove(line.id)}
                  className="px-2 py-0.5 bg-green-800 text-white rounded text-xs hover:bg-green-700"
                >
                  ✓
                </button>
                <button
                  onClick={() => onReject(line.id)}
                  className="px-2 py-0.5 bg-red-800 text-white rounded text-xs hover:bg-red-700"
                >
                  ✗
                </button>
              </>
            )}
            <button
              onClick={() => onStartEdit(line)}
              className="px-2 py-0.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
            >
              ✎
            </button>
          </div>
        </>
      )}
    </div>
  )
}
