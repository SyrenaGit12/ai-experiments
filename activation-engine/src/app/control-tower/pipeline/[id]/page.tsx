"use client"

import { useEffect, useState, useCallback, use } from "react"
import Link from "next/link"
import { STAGE_LABELS_FULL, STAGE_ORDER, TEAM_MEMBERS } from "@/lib/constants"

interface ActivationMatch {
  id: string
  matchSyrenaUserId: string
  matchSide: string
  matchName: string
  matchEmail: string
  matchCompany: string | null
  matchIndustry: string | null
  whyRelevant: string | null
  selected: boolean
  counterpartyResponse: string | null
  introSent: boolean
  introSentAt: string | null
  emailSentToMatch: boolean
  emailSentToMatchAt: string | null
  feedback: string | null
  feedbackDelivered: boolean
  feedbackDeliveredAt: string | null
  score: number
  createdAt: string
}

interface ActivityLog {
  id: string
  action: string
  actor: string | null
  detail: string | null
  meta: Record<string, unknown> | null
  createdAt: string
}

interface ActivationRecord {
  id: string
  syrenaUserId: string
  side: "INVESTOR" | "FOUNDER"
  name: string
  email: string
  company: string | null
  industry: string
  fundingStage: string | null
  stage: string
  owner: string | null
  matchesSentAt: string | null
  matchesSentBy: string | null
  respondedAt: string | null
  selectedMatchId: string | null
  counterpartyAskedAt: string | null
  counterpartyRespondedAt: string | null
  outcome: string | null
  activatedAt: string | null
  notes: string | null
  slaDeadline: string | null
  poolId: string | null
  createdAt: string
  updatedAt: string
  matches: ActivationMatch[]
}

// Use STAGE_LABELS_FULL for the detail page (longer labels)
const STAGE_LABELS = STAGE_LABELS_FULL

export default function PipelineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [record, setRecord] = useState<ActivationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editNotes, setEditNotes] = useState("")
  const [editOwner, setEditOwner] = useState("")
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({})
  const [showSendConfirm, setShowSendConfirm] = useState(false)
  const [sendingBy, setSendingBy] = useState("")
  const [introMatchId, setIntroMatchId] = useState<string | null>(null) // which match is composing intro
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/activation/${id}/activity`)
      if (res.ok) {
        const data = await res.json()
        setActivityLogs(data.logs ?? [])
      }
    } catch {
      // Non-blocking — activity feed is supplementary
    }
  }, [id])

  const fetchRecord = useCallback(async () => {
    const res = await fetch(`/api/activation/${id}`)
    if (res.ok) {
      const data = await res.json()
      setRecord(data)
      setEditNotes(data.notes ?? "")
      setEditOwner(data.owner ?? "")
      // Initialize feedback drafts from existing feedback (only for matches that have feedback)
      const drafts: Record<string, string> = {}
      for (const m of data.matches ?? []) {
        if (m.feedback) drafts[m.id] = m.feedback
      }
      setFeedbackDrafts((prev) => {
        // Merge: keep any in-progress drafts the user is typing
        const merged = { ...drafts }
        for (const [k, v] of Object.entries(prev)) {
          if (v && !drafts[k]) merged[k] = v
        }
        return merged
      })
    }
    setLoading(false)
    // Also refresh activity feed
    fetchActivity()
  }, [id, fetchActivity])

  useEffect(() => {
    fetchRecord()
  }, [fetchRecord])

  async function updateRecord(patch: Record<string, unknown>) {
    setSaving(true)
    // Include actor for audit trail (use current owner or "Control Tower")
    const actor = record?.owner ?? "Control Tower"
    await fetch(`/api/activation/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, actor }),
    })
    await fetchRecord()
    setSaving(false)
  }

  async function updateMatch(matchId: string, patch: Record<string, unknown>) {
    setSaving(true)
    const actor = record?.owner ?? "Control Tower"
    await fetch(`/api/activation/${id}/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, actor }),
    })
    await fetchRecord()
    setSaving(false)
  }

  async function advanceStage(newStage: string) {
    await updateRecord({ stage: newStage })
  }

  if (loading) return <p className="text-gray-400 py-8">Loading...</p>
  if (!record) return <p className="text-red-400 py-8">Record not found</p>

  const currentStageIndex = (STAGE_ORDER as readonly string[]).indexOf(record.stage)

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/control-tower/pipeline"
          className="text-gray-400 hover:text-white text-sm"
        >
          ← Back to Pipeline
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">{record.name}</h1>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                record.side === "INVESTOR"
                  ? "bg-indigo-900/50 text-indigo-300"
                  : "bg-emerald-900/50 text-emerald-300"
              }`}
            >
              {record.side}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {record.email}
            {record.company && <span> · {record.company}</span>}
            {record.fundingStage && <span> · {record.fundingStage.replace(/_/g, " ")}</span>}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {record.industry.replace(/_/g, " ")} · Added {new Date(record.createdAt).toLocaleDateString()}
          </p>
        </div>
        {saving && <span className="text-amber-400 text-sm">Saving...</span>}
      </div>

      {/* Stage Progress */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Stage Progress</h2>
        <div className="flex items-center gap-1">
          {STAGE_ORDER.map((stage, i) => {
            const isCurrent = record.stage === stage
            const isPast = currentStageIndex > i
            const isTerminal = ["STALLED", "DECLINED"].includes(record.stage)
            return (
              <div key={stage} className="flex items-center flex-1">
                <div
                  className={`flex-1 py-2 px-3 rounded-lg text-center text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-blue-600 text-white"
                      : isPast && !isTerminal
                      ? "bg-green-900/50 text-green-300"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {STAGE_LABELS[stage]}
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <span className="text-gray-600 mx-1">→</span>
                )}
              </div>
            )
          })}
        </div>
        {["STALLED", "DECLINED"].includes(record.stage) && (
          <div className="mt-3 px-3 py-2 bg-red-900/30 rounded-lg text-red-300 text-sm">
            Status: {STAGE_LABELS[record.stage]}
          </div>
        )}

        {/* Stage action buttons */}
        <div className="flex gap-2 mt-4">
          {record.stage === "NEW" && (
            <button
              onClick={() => {
                setSendingBy(record.owner ?? "")
                setShowSendConfirm(true)
              }}
              disabled={record.matches.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark S1: Matches Sent
            </button>
          )}
          {record.stage === "S1_MATCHES_SENT" && (
            <button
              onClick={() => advanceStage("S2_USER_RESPONDED")}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-500"
            >
              Mark S2: User Responded
            </button>
          )}
          {record.stage === "S2_USER_RESPONDED" && (
            <button
              onClick={() => advanceStage("S3_COUNTERPARTY_ASKED")}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-500"
            >
              Mark S3: Counterparty Asked
            </button>
          )}
          {record.stage === "S3_COUNTERPARTY_ASKED" && (
            <button
              onClick={() => advanceStage("S3_FEEDBACK_RECEIVED")}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-500"
            >
              Mark S3: Feedback Received
            </button>
          )}
          {record.stage === "S3_FEEDBACK_RECEIVED" && (
            <button
              onClick={() => advanceStage("ACTIVATED")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-500"
            >
              Mark Activated ✓
            </button>
          )}
          {!["ACTIVATED", "STALLED", "DECLINED"].includes(record.stage) && (
            <>
              <button
                onClick={() => advanceStage("STALLED")}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
              >
                Mark Stalled
              </button>
              <button
                onClick={() => advanceStage("DECLINED")}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
              >
                Mark Declined
              </button>
            </>
          )}
          {["STALLED", "DECLINED"].includes(record.stage) && (
            <button
              onClick={() => advanceStage("NEW")}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
            >
              Reopen as New
            </button>
          )}
        </div>
      </div>

      {/* Two column: Owner/Notes + Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Owner & Notes */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Details</h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Owner</label>
              <div className="flex gap-2">
                <select
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                >
                  <option value="">Unassigned</option>
                  {TEAM_MEMBERS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={() => updateRecord({ owner: editOwner || null })}
                  className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600"
                >
                  Save
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none"
                placeholder="Add notes about this activation..."
              />
              <button
                onClick={() => updateRecord({ notes: editNotes })}
                className="mt-2 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600"
              >
                Save Notes
              </button>
            </div>

            {record.slaDeadline && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">SLA Deadline</label>
                <p className={`text-sm ${
                  new Date(record.slaDeadline) < new Date() ? "text-red-400" : "text-gray-300"
                }`}>
                  {new Date(record.slaDeadline).toLocaleString()}
                  {new Date(record.slaDeadline) < new Date() && " (OVERDUE)"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">
            Activity Feed {activityLogs.length > 0 && <span className="text-gray-600 font-normal">({activityLogs.length})</span>}
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {activityLogs.length === 0 ? (
              <>
                {/* Fallback: show milestone timestamps if no audit logs yet */}
                {[
                  { label: "Created", date: record.createdAt },
                  { label: "Matches Sent", date: record.matchesSentAt, by: record.matchesSentBy },
                  { label: "User Responded", date: record.respondedAt },
                  { label: "Counterparty Asked", date: record.counterpartyAskedAt },
                  { label: "Counterparty Responded", date: record.counterpartyRespondedAt },
                  { label: "Activated", date: record.activatedAt },
                ]
                  .filter((e) => e.date)
                  .map((e, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm text-white">{e.label}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(e.date!).toLocaleString()}
                          {e.by && ` by ${e.by}`}
                        </p>
                      </div>
                    </div>
                  ))}
                {record.outcome && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-white">Outcome: {record.outcome}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              activityLogs.map((log) => {
                const actionColors: Record<string, string> = {
                  stage_changed: "bg-blue-500",
                  owner_changed: "bg-purple-500",
                  notes_updated: "bg-gray-500",
                  match_selected: "bg-green-500",
                  match_removed: "bg-red-500",
                  counterparty_response: "bg-amber-500",
                  intro_sent: "bg-cyan-500",
                  email_sent_to_match: "bg-indigo-500",
                  feedback_delivered: "bg-emerald-500",
                  outcome_set: "bg-green-400",
                  record_created: "bg-blue-400",
                }
                const dotColor = actionColors[log.action] ?? "bg-gray-500"

                return (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{log.detail ?? log.action.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleString()}
                        {log.actor && <span className="text-gray-400"> · {log.actor}</span>}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Matches */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase">
            Matches ({record.matches.length})
          </h2>
          <Link
            href={`/control-tower/match-finder?for=${record.id}&side=${record.side === "INVESTOR" ? "FOUNDER" : "INVESTOR"}`}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            + Find Matches
          </Link>
        </div>

        {record.matches.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">
            No matches added yet. Use the Match Finder to search Syrena and add matches.
          </p>
        ) : (
          <div className="space-y-3">
            {record.matches.map((match) => (
              <div
                key={match.id}
                className={`p-4 rounded-lg border transition-colors ${
                  match.selected
                    ? "border-green-700/50 bg-green-950/20"
                    : "border-gray-800 bg-gray-800/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm">{match.matchName}</p>
                      {match.selected && (
                        <span className="text-green-400 text-xs font-medium">★ Selected</span>
                      )}
                      {match.introSent && (
                        <span className="text-blue-400 text-xs font-medium">Intro Sent</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs">
                      {match.matchEmail}
                      {match.matchCompany && ` · ${match.matchCompany}`}
                    </p>
                    {match.whyRelevant && (
                      <p className="text-indigo-400 text-xs mt-1 italic">{match.whyRelevant}</p>
                    )}
                    {match.counterpartyResponse && (
                      <p className={`text-xs mt-1 ${
                        match.counterpartyResponse === "interested" ? "text-green-400" :
                        match.counterpartyResponse === "declined" ? "text-red-400" : "text-gray-400"
                      }`}>
                        Counterparty: {match.counterpartyResponse}
                      </p>
                    )}
                    {match.feedback && !match.counterpartyResponse && (
                      <p className="text-gray-300 text-xs mt-1">Feedback: {match.feedback}</p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {!match.selected && (
                      <button
                        onClick={() => updateMatch(match.id, { selected: true })}
                        className="px-2.5 py-1 bg-green-800 text-green-200 rounded text-xs hover:bg-green-700"
                      >
                        Select
                      </button>
                    )}
                    {match.selected && !match.counterpartyResponse && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateMatch(match.id, { counterpartyResponse: "interested" })}
                          className="px-2.5 py-1 bg-green-800 text-green-200 rounded text-xs hover:bg-green-700"
                        >
                          CP: Yes
                        </button>
                        <button
                          onClick={() => updateMatch(match.id, { counterpartyResponse: "declined" })}
                          className="px-2.5 py-1 bg-red-800 text-red-200 rounded text-xs hover:bg-red-700"
                        >
                          CP: No
                        </button>
                      </div>
                    )}
                    {match.selected && match.counterpartyResponse === "interested" && !match.introSent && (
                      <button
                        onClick={() => setIntroMatchId(match.id)}
                        className="px-2.5 py-1 bg-blue-800 text-blue-200 rounded text-xs hover:bg-blue-700"
                      >
                        Compose Intro
                      </button>
                    )}
                  </div>
                </div>

                {/* Feedback input — show when counterparty has responded */}
                {match.counterpartyResponse && (
                  <div className="mt-3 border-t border-gray-700/50 pt-3">
                    <label className="text-xs text-gray-500 block mb-1">
                      Feedback {match.feedbackDelivered && (
                        <span className="text-green-400 ml-1">
                          ✓ Delivered {match.feedbackDeliveredAt && new Date(match.feedbackDeliveredAt).toLocaleDateString()}
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={feedbackDrafts[match.id] ?? ""}
                        onChange={(e) =>
                          setFeedbackDrafts((prev) => ({ ...prev, [match.id]: e.target.value }))
                        }
                        placeholder={
                          match.counterpartyResponse === "interested"
                            ? "e.g. Great match — intro went well"
                            : "e.g. Not the right fit at this stage"
                        }
                        className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs placeholder:text-gray-600"
                      />
                      <button
                        onClick={() => {
                          const text = feedbackDrafts[match.id]?.trim()
                          if (text) updateMatch(match.id, { feedback: text })
                        }}
                        disabled={!feedbackDrafts[match.id]?.trim() || feedbackDrafts[match.id]?.trim() === match.feedback}
                        className="px-2.5 py-1.5 bg-gray-700 text-gray-200 rounded text-xs hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                      {match.feedback && !match.feedbackDelivered && (
                        <button
                          onClick={() => updateMatch(match.id, { feedbackDelivered: true })}
                          className="px-2.5 py-1.5 bg-purple-800 text-purple-200 rounded text-xs hover:bg-purple-700"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Score */}
                {match.score > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(match.score, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{match.score.toFixed(0)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Confirmation Modal */}
      {showSendConfirm && record && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full">
            <h3 className="text-white font-semibold text-lg mb-3">Confirm: Mark Matches Sent</h3>
            <p className="text-gray-400 text-sm mb-4">
              You are marking that {record.matches.length} match{record.matches.length !== 1 ? "es" : ""} have been sent to <strong className="text-white">{record.name}</strong>.
            </p>
            <div className="bg-gray-800 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
              {record.matches.map((m) => (
                <div key={m.id} className="text-sm text-gray-300 py-1">
                  • {m.matchName} {m.matchCompany && `(${m.matchCompany})`} — {m.matchEmail}
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">Sent by</label>
              <select
                value={sendingBy}
                onChange={(e) => setSendingBy(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              >
                <option value="">Select team member</option>
                {TEAM_MEMBERS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSendConfirm(false)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await updateRecord({
                    stage: "S1_MATCHES_SENT",
                    matchesSentBy: sendingBy || null,
                    actor: sendingBy || "Control Tower",
                  })
                  setShowSendConfirm(false)
                }}
                disabled={!sendingBy}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Sent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intro Email Compose Panel */}
      {introMatchId && record && (() => {
        const match = record.matches.find((m) => m.id === introMatchId)
        if (!match) return null
        const subjectLine = `Intro: ${record.name} ↔ ${match.matchName}`
        const bodyTemplate = `Hi ${record.name} and ${match.matchName},

I'd like to introduce you both:

${record.name}${record.company ? ` (${record.company})` : ""} — ${record.side === "INVESTOR" ? "Investor" : "Founder"} in ${record.industry.replace(/_/g, " ")}
${match.matchName}${match.matchCompany ? ` (${match.matchCompany})` : ""} — ${match.matchSide === "INVESTOR" ? "Investor" : "Founder"}${match.matchIndustry ? ` in ${match.matchIndustry.replace(/_/g, " ")}` : ""}

${match.whyRelevant ? `${match.whyRelevant}\n\n` : ""}I'll let you take it from here. Feel free to find a time that works for a quick chat.

Best,
Syrena Team`

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-2xl w-full">
              <h3 className="text-white font-semibold text-lg mb-3">Compose Intro Email</h3>
              <p className="text-gray-400 text-sm mb-4">
                Copy this template to send the intro between{" "}
                <strong className="text-white">{record.name}</strong> and{" "}
                <strong className="text-white">{match.matchName}</strong>.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">To</label>
                  <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    {record.email}, {match.matchEmail}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Subject</label>
                  <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
                    {subjectLine}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Body</label>
                  <pre className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
                    {bodyTemplate}
                  </pre>
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button
                  onClick={() => setIntroMatchId(null)}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`To: ${record.email}, ${match.matchEmail}\nSubject: ${subjectLine}\n\n${bodyTemplate}`)
                  }}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 border border-gray-600"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={async () => {
                    await updateMatch(match.id, { introSent: true })
                    setIntroMatchId(null)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500"
                >
                  Mark Intro Sent
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
