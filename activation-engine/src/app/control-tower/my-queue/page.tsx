"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { STAGE_LABELS, STAGE_BADGE_COLORS, TEAM_MEMBERS } from "@/lib/constants"
import { useToast } from "@/components/ui/toast"

// ─── Types ─────────────────────────────────────────────
interface MatchSummary {
  id: string
  matchName: string
  selected?: boolean
  introSent?: boolean
  counterpartyResponse?: string | null
}

interface QueueRecord {
  id: string
  name: string
  email: string
  side: "INVESTOR" | "FOUNDER"
  stage: string
  owner: string | null
  company: string | null
  industry: string
  slaDeadline: string | null
  matchesSentAt: string | null
  respondedAt: string | null
  counterpartyAskedAt: string | null
  updatedAt: string
  createdAt: string
  matches: MatchSummary[]
}

interface QueueData {
  slaOverdue: QueueRecord[]
  needsAction: QueueRecord[]
  newUnassigned: QueueRecord[]
  slaSoon: QueueRecord[]
  waiting: QueueRecord[]
  counts: {
    slaOverdue: number
    needsAction: number
    newUnassigned: number
    slaSoon: number
    waiting: number
    total: number
  }
}

// ─── Helpers ───────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
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

function getNextAction(rec: QueueRecord): string {
  switch (rec.stage) {
    case "NEW": return "Find matches & send"
    case "S1_MATCHES_SENT": return "Waiting for reply"
    case "S2_USER_RESPONDED": return "Ask counterparty"
    case "S3_COUNTERPARTY_ASKED": return "Waiting for CP reply"
    case "S3_FEEDBACK_RECEIVED": return "Deliver feedback → Activate"
    default: return rec.stage
  }
}

// ─── Queue Card Component ──────────────────────────────
function QueueCard({ rec, bucketColor }: { rec: QueueRecord; bucketColor: string }) {
  const matchCount = rec.matches?.length ?? 0
  const selectedCount = rec.matches?.filter((m) => m.selected).length ?? 0
  const introSentCount = rec.matches?.filter((m) => m.introSent).length ?? 0

  return (
    <Link
      href={`/control-tower/pipeline/${rec.id}`}
      className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                rec.side === "INVESTOR" ? "bg-indigo-500" : "bg-emerald-500"
              }`}
            />
            <span className="text-sm font-medium text-white truncate group-hover:text-blue-300 transition-colors">
              {rec.name}
            </span>
            {rec.company && (
              <span className="text-xs text-gray-500 truncate">@ {rec.company}</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_BADGE_COLORS[rec.stage] ?? "bg-gray-700 text-gray-300"}`}>
              {STAGE_LABELS[rec.stage] ?? rec.stage}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${bucketColor}`}>
              {getNextAction(rec)}
            </span>
            {rec.owner && (
              <span className="text-xs text-gray-500">→ {rec.owner}</span>
            )}
          </div>

          {/* Match summary */}
          {matchCount > 0 && (
            <div className="text-xs text-gray-500 mt-2">
              {matchCount} match{matchCount !== 1 ? "es" : ""}
              {selectedCount > 0 && ` · ${selectedCount} selected`}
              {introSentCount > 0 && ` · ${introSentCount} intros sent`}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
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
          <span className="text-xs text-gray-600">{timeAgo(rec.updatedAt)}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Queue Bucket Component ────────────────────────────
function QueueBucket({
  title,
  icon,
  items,
  color,
  badgeColor,
  emptyMessage,
}: {
  title: string
  icon: string
  items: QueueRecord[]
  color: string
  badgeColor: string
  emptyMessage: string
}) {
  const [expanded, setExpanded] = useState(true)

  if (items.length === 0) {
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span>{icon}</span>
          <h3 className={`text-sm font-semibold ${color}`}>{title}</h3>
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">0</span>
        </div>
        <p className="text-xs text-gray-600 px-1">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 px-1 w-full text-left"
      >
        <span>{icon}</span>
        <h3 className={`text-sm font-semibold ${color}`}>{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
          {items.length}
        </span>
        <span className="text-gray-600 text-xs ml-auto">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="space-y-2">
          {items.map((rec) => (
            <QueueCard key={rec.id} rec={rec} bucketColor={badgeColor} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────
export default function MyQueuePage() {
  const [data, setData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [owner, setOwner] = useState<string>("")
  const toast = useToast()

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (owner) params.set("owner", owner)
      const res = await fetch(`/api/activation/queue?${params}`)
      if (res.ok) {
        setData(await res.json())
      } else if (!silent) {
        toast.error("Failed to load queue")
      }
    } catch (err) {
      console.error("Failed to fetch queue:", err)
      if (!silent) toast.error("Failed to load queue")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [owner])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Auto-refresh every 30 seconds (silent — no loading flash)
  useEffect(() => {
    const interval = setInterval(() => fetchQueue(true), 30_000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Queue</h1>
          <p className="text-sm text-gray-400 mt-1">
            Action-needed items, sorted by urgency
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All team members</option>
            {TEAM_MEMBERS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            onClick={() => fetchQueue()}
            disabled={loading}
            className="px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="p-4 bg-gray-900 rounded-xl border border-red-900/50">
            <p className="text-red-400 text-xs uppercase tracking-wide">SLA Overdue</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{data.counts.slaOverdue}</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl border border-amber-900/50">
            <p className="text-amber-400 text-xs uppercase tracking-wide">Needs Action</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{data.counts.needsAction}</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl border border-purple-900/50">
            <p className="text-purple-400 text-xs uppercase tracking-wide">New / Unassigned</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{data.counts.newUnassigned}</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl border border-yellow-900/50">
            <p className="text-yellow-400 text-xs uppercase tracking-wide">SLA Soon</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{data.counts.slaSoon}</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wide">Waiting</p>
            <p className="text-2xl font-bold text-gray-300 mt-1">{data.counts.waiting}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="text-center py-20 text-gray-500">Loading queue…</div>
      )}

      {/* Empty state */}
      {data && data.counts.total === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-lg text-green-400 font-semibold">Queue clear!</p>
          <p className="text-sm text-gray-500 mt-1">
            {owner ? `${owner} has no pending items` : "No action-needed items right now"}
          </p>
        </div>
      )}

      {/* Queue buckets */}
      {data && data.counts.total > 0 && (
        <div>
          <QueueBucket
            title="SLA Overdue"
            icon="🔴"
            items={data.slaOverdue}
            color="text-red-400"
            badgeColor="bg-red-900/50 text-red-300"
            emptyMessage="No overdue items"
          />
          <QueueBucket
            title="Needs Your Action"
            icon="🟡"
            items={data.needsAction}
            color="text-amber-400"
            badgeColor="bg-amber-900/50 text-amber-300"
            emptyMessage="No action needed right now"
          />
          <QueueBucket
            title="New & Unassigned"
            icon="🟣"
            items={data.newUnassigned}
            color="text-purple-400"
            badgeColor="bg-purple-900/50 text-purple-300"
            emptyMessage="All new records have been picked up"
          />
          <QueueBucket
            title="SLA Approaching (< 12h)"
            icon="⏳"
            items={data.slaSoon}
            color="text-yellow-400"
            badgeColor="bg-yellow-900/50 text-yellow-300"
            emptyMessage="No approaching deadlines"
          />
          <QueueBucket
            title="Waiting for Response"
            icon="⏸"
            items={data.waiting}
            color="text-gray-400"
            badgeColor="bg-gray-700 text-gray-300"
            emptyMessage="Nothing waiting"
          />
        </div>
      )}
    </div>
  )
}
