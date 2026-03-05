"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface NewJoinerMatch {
  id: string
  userId: string
  side: string
  matchUserId: string
  userName: string | null
  userEmail: string | null
  matchName: string | null
  matchEmail: string | null
  score: number
  whyRelevant: string | null
  approved: boolean
  stage: number
  selected: boolean
  feedback: string | null
  feedbackPositive: boolean | null
  emailSentAt: string | null
  isTestMode: boolean
  createdAt: string
}

interface UserGroup {
  userId: string
  userName: string | null
  userEmail: string | null
  side: string
  matches: NewJoinerMatch[]
}

const stageLabels: Record<number, { label: string; color: string }> = {
  0: { label: "Draft", color: "bg-gray-700 text-gray-300" },
  1: { label: "Presented", color: "bg-blue-900/50 text-blue-300" },
  2: { label: "Selected", color: "bg-amber-900/50 text-amber-300" },
  3: { label: "Done", color: "bg-green-900/50 text-green-300" },
}

export default function NewJoinersPage() {
  const [users, setUsers] = useState<UserGroup[]>([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch("/api/new-joiners")
      const json = await res.json()
      setUsers(json.users ?? [])
      setTotalMatches(json.totalMatches ?? 0)
    } catch {
      console.error("Failed to fetch new joiners")
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function runMatching() {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch("/api/new-joiners", { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setRunResult(`Error: ${json.error}`)
      } else {
        const s = json.summary
        setRunResult(
          `Found ${s?.newJoinersFound ?? 0} new joiners, created ${s?.matchesCreated ?? 0} matches`
        )
      }
      await fetchData()
    } catch {
      setRunResult("Failed to run matching")
    }
    setRunning(false)
  }

  async function toggleApprove(matchId: string, currentApproved: boolean) {
    await fetch(`/api/new-joiners/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !currentApproved }),
    })
    await fetchData()
  }

  async function saveWhyRelevant(matchId: string) {
    await fetch(`/api/new-joiners/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whyRelevant: editText }),
    })
    setEditingId(null)
    setEditText("")
    await fetchData()
  }

  async function removeMatch(matchId: string) {
    if (!confirm("Remove this match?")) return
    await fetch(`/api/new-joiners/${matchId}`, { method: "DELETE" })
    await fetchData()
  }

  async function sendEmail(matchId: string) {
    setSendingId(matchId)
    try {
      const res = await fetch(`/api/new-joiners/${matchId}/send`, {
        method: "POST",
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? "Failed to send")
      }
      await fetchData()
    } catch {
      alert("Failed to send email")
    }
    setSendingId(null)
  }

  // Summary counts
  const allMatches = users.flatMap((u) => u.matches)
  const approvedCount = allMatches.filter((m) => m.approved).length
  const sentCount = allMatches.filter((m) => m.emailSentAt).length
  const draftCount = allMatches.filter((m) => m.stage === 0).length

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Loading new joiners...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/control-tower"
              className="text-gray-500 hover:text-white text-sm"
            >
              Control Tower
            </Link>
            <span className="text-gray-600">/</span>
            <h1 className="text-xl font-semibold text-white">New Joiners</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Users who signed up within the last 7 days get 2-3 curated matches.
          </p>
        </div>
        <button
          onClick={runMatching}
          disabled={running}
          className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors"
        >
          {running ? "Matching..." : "Run Matching"}
        </button>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            runResult.startsWith("Error")
              ? "bg-red-900/20 border border-red-800/30 text-red-300"
              : "bg-green-900/20 border border-green-800/30 text-green-300"
          }`}
        >
          {runResult}
        </div>
      )}

      {/* Summary bar */}
      <div className="flex gap-6 mb-6 text-xs">
        <span className="text-gray-400">
          {users.length} users
        </span>
        <span className="text-gray-400">
          {totalMatches} matches
        </span>
        <span className="text-green-400">
          {approvedCount} approved
        </span>
        <span className="text-blue-400">
          {sentCount} sent
        </span>
        <span className="text-gray-500">
          {draftCount} drafts
        </span>
      </div>

      {/* Empty state */}
      {users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm mb-2">No new joiner matches found.</p>
          <p className="text-gray-600 text-xs">
            Click &quot;Run Matching&quot; to find users who signed up in the last 7 days.
          </p>
        </div>
      )}

      {/* User groups */}
      <div className="space-y-6">
        {users.map((user) => {
          const allApproved = user.matches.every((m) => m.approved)
          const anySent = user.matches.some((m) => m.emailSentAt)
          const allSent = user.matches.every((m) => m.emailSentAt)

          // Determine user-level status
          let userStatus: { label: string; color: string }
          if (allSent) {
            userStatus = { label: "All Sent", color: "bg-green-900/50 text-green-300" }
          } else if (anySent) {
            userStatus = { label: "Partially Sent", color: "bg-blue-900/50 text-blue-300" }
          } else if (allApproved) {
            userStatus = { label: "Ready to Send", color: "bg-amber-900/50 text-amber-300" }
          } else {
            userStatus = { label: "Pending Review", color: "bg-gray-700 text-gray-300" }
          }

          return (
            <div
              key={user.userId}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
            >
              {/* User header */}
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium">
                        {user.userName ?? "Unknown User"}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          user.side === "INVESTOR"
                            ? "bg-blue-900/40 text-blue-300"
                            : "bg-purple-900/40 text-purple-300"
                        }`}
                      >
                        {user.side}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${userStatus.color}`}
                      >
                        {userStatus.label}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {user.userEmail ?? "No email"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Send All button (only if all approved and none sent) */}
                  {allApproved && !allSent && (
                    <button
                      onClick={async () => {
                        const unsent = user.matches.filter((m) => !m.emailSentAt)
                        for (const m of unsent) {
                          await sendEmail(m.id)
                        }
                      }}
                      disabled={sendingId !== null}
                      className="px-3 py-1.5 bg-green-700 text-white rounded text-xs font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      Send Welcome Emails
                    </button>
                  )}
                  <span className="text-xs text-gray-500">
                    {user.matches.length} match{user.matches.length !== 1 ? "es" : ""}
                  </span>
                </div>
              </div>

              {/* Matches */}
              <div className="divide-y divide-gray-800/50">
                {user.matches.map((match) => {
                  const stage = stageLabels[match.stage] ?? stageLabels[0]
                  const isEditing = editingId === match.id

                  return (
                    <div
                      key={match.id}
                      className="px-5 py-3 flex items-start gap-4"
                    >
                      {/* Match info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-white font-medium truncate">
                            {match.matchName ?? "Unknown"}
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {match.score.toFixed(1)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${stage.color}`}
                          >
                            {stage.label}
                          </span>
                          {match.isTestMode && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/50 text-amber-300">
                              TEST
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {match.matchEmail ?? "No email"}
                        </p>

                        {/* Why relevant line */}
                        {isEditing ? (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              maxLength={120}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                              placeholder="Why this match is relevant..."
                            />
                            <button
                              onClick={() => saveWhyRelevant(match.id)}
                              className="px-2 py-1 bg-blue-700 text-white rounded text-xs hover:bg-blue-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null)
                                setEditText("")
                              }}
                              className="px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : match.whyRelevant ? (
                          <p className="text-xs text-indigo-300 italic mt-1">
                            {match.whyRelevant}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-600 italic mt-1">
                            No personalization line
                          </p>
                        )}

                        {/* Feedback if any */}
                        {match.feedback && (
                          <p className="text-xs text-gray-400 mt-1">
                            Feedback ({match.feedbackPositive ? "+" : "-"}): {match.feedback}
                          </p>
                        )}

                        {/* Sent timestamp */}
                        {match.emailSentAt && (
                          <p className="text-xs text-gray-600 mt-1">
                            Sent {new Date(match.emailSentAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Approve toggle */}
                        <button
                          onClick={() => toggleApprove(match.id, match.approved)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            match.approved
                              ? "bg-green-800 text-green-200 hover:bg-green-700"
                              : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                          }`}
                          title={match.approved ? "Approved — click to unapprove" : "Click to approve"}
                        >
                          {match.approved ? "✓" : "○"}
                        </button>

                        {/* Edit line */}
                        <button
                          onClick={() => {
                            setEditingId(match.id)
                            setEditText(match.whyRelevant ?? "")
                          }}
                          className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs hover:bg-gray-600 hover:text-white transition-colors"
                          title="Edit personalization line"
                        >
                          ✎
                        </button>

                        {/* Send individual */}
                        {match.approved && !match.emailSentAt && (
                          <button
                            onClick={() => sendEmail(match.id)}
                            disabled={sendingId === match.id}
                            className="px-2 py-1 bg-blue-700 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50 transition-colors"
                            title="Send welcome email"
                          >
                            {sendingId === match.id ? "..." : "Send"}
                          </button>
                        )}

                        {/* Remove */}
                        {!match.emailSentAt && (
                          <button
                            onClick={() => removeMatch(match.id)}
                            className="px-2 py-1 bg-gray-800 text-gray-500 rounded text-xs hover:bg-red-900/50 hover:text-red-400 transition-colors"
                            title="Remove match"
                          >
                            ✗
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
