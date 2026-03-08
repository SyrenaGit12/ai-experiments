"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { WEEKLY_TARGETS, STAGE_LABELS, STAGE_BAR_COLORS } from "@/lib/constants"

// ─── Types ────────────────────────────────────────────

interface RecentRecord {
  id: string
  name: string
  side: string
  stage: string
  updatedAt: string
  company: string | null
}

interface OwnerCount {
  owner: string
  count: number
}

interface DashboardStats {
  total: number
  activatedThisWeek: number
  overdue: number
  stages: Record<string, number>
  sides: Record<string, number>
  owners: OwnerCount[]
  recentActivity: RecentRecord[]
  activatedFoundersThisWeek: number
  activatedInvestorsThisWeek: number
  totalMatches: number
  introsSent: number
}

// ─── Helpers ──────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const FUNNEL_STAGES = [
  "NEW",
  "S1_MATCHES_SENT",
  "S2_USER_RESPONDED",
  "S3_COUNTERPARTY_ASKED",
  "S3_FEEDBACK_RECEIVED",
  "ACTIVATED",
]

const AUTO_REFRESH_MS = 30_000

// ─── Component ────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/activation/stats")
      if (!res.ok) throw new Error(`Failed to load stats (${res.status})`)
      const data: DashboardStats = await res.json()
      setStats(data)
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchStats])

  // Loading state
  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-semibold text-white">Dashboard Error</h2>
        <p className="text-sm text-gray-400">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return null

  // Calculations
  const founderPct = Math.min(
    100,
    Math.round((stats.activatedFoundersThisWeek / WEEKLY_TARGETS.founders) * 100)
  )
  const investorPct = Math.min(
    100,
    Math.round((stats.activatedInvestorsThisWeek / WEEKLY_TARGETS.investors) * 100)
  )
  const maxFunnelCount = Math.max(
    1,
    ...FUNNEL_STAGES.map((s) => stats.stages[s] ?? 0)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Activation Workspace Overview
            <span className="text-gray-600 ml-2">
              · Updated {timeAgo(lastRefresh.toISOString())}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchStats}
            className="px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm hover:bg-gray-700 hover:text-gray-300 border border-gray-700 transition-colors"
            title="Refresh now"
          >
            ↻
          </button>
          <Link
            href="/control-tower/pipeline"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            Open Pipeline
          </Link>
          <Link
            href="/control-tower/match-finder"
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 border border-gray-700 transition-colors"
          >
            Find Matches
          </Link>
        </div>
      </div>

      {/* Error banner (for refresh errors when we already have data) */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
          ⚠ Refresh failed: {error} — showing last known data
        </div>
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Pipeline</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
          <p className="text-gray-500 text-xs mt-1">
            {stats.sides["INVESTOR"] ?? 0} inv &middot; {stats.sides["FOUNDER"] ?? 0} fdr
          </p>
        </div>
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Activated (this week)</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{stats.activatedThisWeek}</p>
        </div>
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">SLA Overdue</p>
          <p className={`text-3xl font-bold mt-1 ${stats.overdue > 0 ? "text-red-400" : "text-white"}`}>
            {stats.overdue}
          </p>
        </div>
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Total Matches</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.totalMatches}</p>
        </div>
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Intros Sent</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{stats.introsSent}</p>
        </div>
      </div>

      {/* Weekly Targets + Pipeline Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Weekly Targets */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
            Weekly Activation Targets
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-emerald-300">
                  Founders: {stats.activatedFoundersThisWeek} / {WEEKLY_TARGETS.founders}
                </span>
                <span className="text-xs text-gray-500">{founderPct}%</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${founderPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-indigo-300">
                  Investors: {stats.activatedInvestorsThisWeek} / {WEEKLY_TARGETS.investors}
                </span>
                <span className="text-xs text-gray-500">{investorPct}%</span>
              </div>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${investorPct}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-4">
            Target: 40 founders + 20 investors activated per week
          </p>
        </div>

        {/* Pipeline Funnel */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
            Pipeline Funnel
          </h2>
          <div className="space-y-2">
            {FUNNEL_STAGES.map((stage) => {
              const count = stats.stages[stage] ?? 0
              const pct = Math.round((count / maxFunnelCount) * 100)
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-28 truncate">
                    {STAGE_LABELS[stage]}
                  </span>
                  <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden">
                    <div
                      className={`h-full rounded ${STAGE_BAR_COLORS[stage]}`}
                      style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs text-white w-8 text-right font-medium">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
          {(stats.stages["STALLED"] ?? 0) + (stats.stages["DECLINED"] ?? 0) > 0 && (
            <p className="text-gray-600 text-xs mt-3">
              + {stats.stages["STALLED"] ?? 0} stalled, {stats.stages["DECLINED"] ?? 0} declined
            </p>
          )}
        </div>
      </div>

      {/* Team Workload + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team Workload */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
            Team Workload (Active)
          </h2>
          {stats.owners.length === 0 ? (
            <p className="text-gray-500 text-sm">No records assigned yet</p>
          ) : (
            <div className="space-y-2">
              {stats.owners.map((o) => (
                <div key={o.owner} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{o.owner}</span>
                  <span className="text-sm font-medium text-white bg-gray-800 px-3 py-0.5 rounded-full">
                    {o.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {stats.recentActivity.map((rec) => (
              <Link
                key={rec.id}
                href={`/control-tower/pipeline/${rec.id}`}
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      rec.side === "INVESTOR" ? "bg-indigo-500" : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    {rec.name}
                    {rec.company && (
                      <span className="text-gray-500"> @ {rec.company}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {STAGE_LABELS[rec.stage] ?? rec.stage}
                  </span>
                  <span className="text-xs text-gray-600">
                    {timeAgo(rec.updatedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
