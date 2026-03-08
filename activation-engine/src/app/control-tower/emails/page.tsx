"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useToast } from "@/components/ui/toast"

// ─── Types ─────────────────────────────────────────────
interface TimelineItem {
  type: "matches_sent" | "intro_sent" | "feedback_delivered" | "response_received"
  timestamp: string
  recordId: string
  recordName: string
  side: string
  detail: string
}

interface PendingResponse {
  id: string
  name: string
  email: string
  side: string
  owner: string | null
  matchesSentAt: string
  slaDeadline: string | null
}

interface EmailActivityData {
  summary: {
    matchesSent: number
    responded: number
    responseRate: number
    counterpartyAsked: number
    counterpartyResponded: number
    matchEmailsSent: number
    introsSent: number
    feedbackDelivered: number
  }
  timeline: TimelineItem[]
  pendingResponses: PendingResponse[]
}

// ─── Helpers ───────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff < 0) {
    const overdue = Math.abs(diff)
    const hours = Math.floor(overdue / 3600000)
    if (hours < 1) return `${Math.floor(overdue / 60000)}m overdue`
    if (hours < 24) return `${hours}h overdue`
    return `${Math.floor(hours / 24)}d overdue`
  }
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return `${Math.floor(diff / 60000)}m left`
  if (hours < 24) return `${hours}h left`
  return `${Math.floor(hours / 24)}d left`
}

const TIMELINE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  matches_sent: { icon: "↗", color: "text-blue-400", bg: "bg-blue-900/30" },
  intro_sent: { icon: "🤝", color: "text-emerald-400", bg: "bg-emerald-900/30" },
  feedback_delivered: { icon: "💬", color: "text-purple-400", bg: "bg-purple-900/30" },
  response_received: { icon: "✓", color: "text-amber-400", bg: "bg-amber-900/30" },
}

// ─── Tab type ──────────────────────────────────────────
type Tab = "timeline" | "pending"

// ─── Main Page ─────────────────────────────────────────
export default function EmailActivityPage() {
  const [data, setData] = useState<EmailActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("timeline")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const toast = useToast()

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/activation/email-activity")
      if (res.ok) {
        setData(await res.json())
      } else if (!silent) {
        toast.error("Failed to load email activity")
      }
    } catch (err) {
      console.error("Failed to fetch email activity:", err)
      if (!silent) toast.error("Failed to load email activity")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 30 seconds (silent)
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Filter timeline items
  const filteredTimeline = data?.timeline.filter(
    (item) => typeFilter === "all" || item.type === typeFilter
  ) ?? []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Activity</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track emails across the activation pipeline
          </p>
        </div>
        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "↻ Refresh"}
        </button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Matches Sent</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{data.summary.matchesSent}</p>
            <p className="text-xs text-gray-600 mt-1">
              {data.summary.responded} responded ({data.summary.responseRate}%)
            </p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Match Emails</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{data.summary.matchEmailsSent}</p>
            <p className="text-xs text-gray-600 mt-1">
              Individual match emails sent
            </p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Intros Sent</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{data.summary.introsSent}</p>
            <p className="text-xs text-gray-600 mt-1">
              Introductions made
            </p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Feedback Delivered</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{data.summary.feedbackDelivered}</p>
            <p className="text-xs text-gray-600 mt-1">
              CP asked: {data.summary.counterpartyAsked} · replied: {data.summary.counterpartyResponded}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-800">
        <button
          onClick={() => setTab("timeline")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "timeline"
              ? "border-blue-500 text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Activity Timeline
          {data && <span className="ml-1.5 text-xs text-gray-600">({data.timeline.length})</span>}
        </button>
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "pending"
              ? "border-amber-500 text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          Pending Responses
          {data && data.pendingResponses.length > 0 && (
            <span className="ml-1.5 text-xs bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded-full">
              {data.pendingResponses.length}
            </span>
          )}
        </button>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="text-center py-20 text-gray-500">Loading email activity...</div>
      )}

      {/* Timeline Tab */}
      {tab === "timeline" && data && (
        <div>
          {/* Type filter */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500">Filter:</span>
            {[
              { value: "all", label: "All" },
              { value: "matches_sent", label: "Match Lists" },
              { value: "intro_sent", label: "Intros" },
              { value: "feedback_delivered", label: "Feedback" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  typeFilter === f.value
                    ? "bg-gray-700 text-white"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredTimeline.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-gray-400 text-sm">No email activity yet</p>
              <p className="text-gray-600 text-xs mt-1">
                Activity will appear here as emails are sent through the pipeline
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTimeline.map((item, i) => {
                const config = TIMELINE_CONFIG[item.type] ?? TIMELINE_CONFIG.matches_sent
                return (
                  <Link
                    key={`${item.recordId}-${item.type}-${i}`}
                    href={`/control-tower/pipeline/${item.recordId}`}
                    className="flex items-start gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors group"
                  >
                    <span className={`text-lg mt-0.5 ${config.color}`}>{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            item.side === "INVESTOR" ? "bg-indigo-500" : "bg-emerald-500"
                          }`}
                        />
                        <span className="text-sm text-white font-medium truncate group-hover:text-blue-300 transition-colors">
                          {item.recordName}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                          {item.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{item.detail}</p>
                    </div>
                    <span className="text-xs text-gray-600 flex-shrink-0 mt-1">
                      {timeAgo(item.timestamp)}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Pending Responses Tab */}
      {tab === "pending" && data && (
        <div>
          {data.pendingResponses.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-2">✓</p>
              <p className="text-green-400 text-sm font-medium">No pending responses</p>
              <p className="text-gray-600 text-xs mt-1">
                All match list recipients have responded
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                Records waiting for a response after receiving their match list
              </p>
              {data.pendingResponses.map((rec) => (
                <Link
                  key={rec.id}
                  href={`/control-tower/pipeline/${rec.id}`}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        rec.side === "INVESTOR" ? "bg-indigo-500" : "bg-emerald-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm text-white font-medium group-hover:text-blue-300 transition-colors">
                        {rec.name}
                      </p>
                      <p className="text-xs text-gray-500">{rec.email}</p>
                    </div>
                    {rec.owner && (
                      <span className="text-xs text-gray-600">→ {rec.owner}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-xs text-gray-500">
                      Sent {timeAgo(rec.matchesSentAt)}
                    </span>
                    {rec.slaDeadline && (
                      <span
                        className={`text-xs font-medium ${
                          new Date(rec.slaDeadline) < new Date()
                            ? "text-red-400"
                            : "text-amber-400"
                        }`}
                      >
                        ⏱ {timeUntil(rec.slaDeadline)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
