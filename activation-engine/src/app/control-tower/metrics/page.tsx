"use client"

import { useState, useEffect, useCallback } from "react"
import { STAGE_LABELS, STAGE_BAR_COLORS, WEEKLY_TARGETS } from "@/lib/constants"

// ─── Types ─────────────────────────────────────────────
interface MetricsData {
  summary: {
    totalRecords: number
    totalActivated: number
    totalStalled: number
    totalDeclined: number
    activationRate: number
    responseRate: number
    matchesSent: number
    responded: number
  }
  stages: Record<string, number>
  sides: Record<string, number>
  conversions: Array<{
    from: string
    to: string
    fromCount: number
    toCount: number
    rate: number
  }>
  weeklyTrend: Array<{
    weekStart: string
    founders: number
    investors: number
    total: number
  }>
  cycleTimes: {
    newToMatchesSent: number | null
    matchesSentToResponse: number | null
    responseToCounterparty: number | null
    counterpartyToActivated: number | null
    totalCreatedToActivated: number | null
    sampleSize: number
  }
  ownerLeaderboard: Array<{
    owner: string
    active: number
    activated: number
  }>
  industries: Array<{
    industry: string
    count: number
  }>
  matchStats: {
    total: number
    selected: number
    introsSent: number
    feedbackDelivered: number
    selectionRate: number
    introRate: number
  }
}

// ─── Helpers ───────────────────────────────────────────
function formatDays(d: number | null): string {
  if (d === null) return "—"
  if (d < 1) return `${Math.round(d * 24)}h`
  return `${d}d`
}

function formatIndustry(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Main Page ─────────────────────────────────────────
export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/activation/metrics")
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error("Failed to fetch metrics:", err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  // Auto-refresh every 60 seconds (silent)
  useEffect(() => {
    const interval = setInterval(() => fetchMetrics(true), 60_000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  if (loading && !data) {
    return <div className="text-center py-20 text-gray-500">Loading metrics…</div>
  }
  if (!data) {
    return <div className="text-center py-20 text-gray-500">Failed to load metrics.</div>
  }

  const { summary, conversions, weeklyTrend, cycleTimes, ownerLeaderboard, industries, matchStats, stages, sides } = data

  // Find max weekly total for bar scaling
  const maxWeeklyTotal = Math.max(...weeklyTrend.map((w) => w.total), 1)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Metrics</h1>
          <p className="text-sm text-gray-400 mt-1">
            Deep analytics for the activation pipeline
          </p>
        </div>
        <button
          onClick={() => fetchMetrics()}
          disabled={loading}
          className="px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "…" : "↻ Refresh"}
        </button>
      </div>

      {/* ─── Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Total Records</p>
          <p className="text-3xl font-bold text-white mt-1">{summary.totalRecords}</p>
          <div className="flex gap-3 mt-2">
            <span className="text-xs text-emerald-400">
              {sides["FOUNDER"] ?? 0} founders
            </span>
            <span className="text-xs text-indigo-400">
              {sides["INVESTOR"] ?? 0} investors
            </span>
          </div>
        </div>
        <div className="p-5 bg-gray-900 rounded-xl border border-green-900/50">
          <p className="text-green-400 text-xs uppercase tracking-wide">Activated</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{summary.totalActivated}</p>
          <p className="text-xs text-gray-500 mt-2">
            {summary.activationRate}% activation rate
          </p>
        </div>
        <div className="p-5 bg-gray-900 rounded-xl border border-purple-900/50">
          <p className="text-purple-400 text-xs uppercase tracking-wide">Response Rate</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{summary.responseRate}%</p>
          <p className="text-xs text-gray-500 mt-2">
            {summary.responded} / {summary.matchesSent} responded
          </p>
        </div>
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Terminal</p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-xl font-bold text-red-400">{summary.totalStalled}</span>
            <span className="text-xs text-gray-500">stalled</span>
            <span className="text-xl font-bold text-gray-500">{summary.totalDeclined}</span>
            <span className="text-xs text-gray-500">declined</span>
          </div>
        </div>
      </div>

      {/* ─── Stage Conversion Funnel ────────────────────── */}
      <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Stage Conversion Funnel</h2>
        <div className="space-y-3">
          {conversions.map((c) => (
            <div key={c.to} className="flex items-center gap-3">
              <div className="w-36 text-right">
                <span className="text-xs text-gray-500">
                  {STAGE_LABELS[c.from] ?? c.from}
                </span>
              </div>
              <div className="text-gray-600 text-xs">→</div>
              <div className="w-36">
                <span className="text-xs text-gray-300">
                  {STAGE_LABELS[c.to] ?? c.to}
                </span>
              </div>
              <div className="flex-1 bg-gray-800 rounded-full h-5 relative overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${STAGE_BAR_COLORS[c.to] ?? "bg-gray-600"}`}
                  style={{ width: `${Math.max(c.rate, 2)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                  {c.rate}%
                </span>
              </div>
              <div className="w-24 text-right">
                <span className="text-xs text-gray-500">
                  {c.fromCount} → {c.toCount}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Two columns: Weekly Trend + Cycle Times ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Activation Trend */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-1">Weekly Activations</h2>
          <p className="text-xs text-gray-500 mb-4">Last 8 weeks</p>

          {/* Target line legend */}
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-emerald-600" /> Founders
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-indigo-600" /> Investors
            </span>
            <span className="text-gray-600 ml-auto">
              Target: {WEEKLY_TARGETS.founders}F + {WEEKLY_TARGETS.investors}I = {WEEKLY_TARGETS.founders + WEEKLY_TARGETS.investors}/wk
            </span>
          </div>

          <div className="flex items-end gap-1.5" style={{ height: 160 }}>
            {weeklyTrend.map((w) => {
              const barMax = Math.max(maxWeeklyTotal, WEEKLY_TARGETS.founders + WEEKLY_TARGETS.investors)
              const founderH = barMax > 0 ? (w.founders / barMax) * 140 : 0
              const investorH = barMax > 0 ? (w.investors / barMax) * 140 : 0
              return (
                <div
                  key={w.weekStart}
                  className="flex-1 flex flex-col items-center justify-end gap-0"
                  title={`${w.weekStart}: ${w.founders}F + ${w.investors}I = ${w.total}`}
                >
                  <span className="text-xs text-gray-400 mb-1">{w.total}</span>
                  <div className="w-full flex flex-col items-stretch">
                    <div
                      className="bg-indigo-600 rounded-t"
                      style={{ height: Math.max(investorH, w.investors > 0 ? 3 : 0) }}
                    />
                    <div
                      className="bg-emerald-600 rounded-b"
                      style={{ height: Math.max(founderH, w.founders > 0 ? 3 : 0) }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-600 mt-1">
                    {w.weekStart.slice(5)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Target line */}
          {maxWeeklyTotal > 0 && (
            <div className="relative mt-1">
              <div
                className="absolute w-full border-t border-dashed border-amber-600/50"
                style={{
                  bottom: `${((WEEKLY_TARGETS.founders + WEEKLY_TARGETS.investors) / Math.max(maxWeeklyTotal, WEEKLY_TARGETS.founders + WEEKLY_TARGETS.investors)) * 140 + 20}px`,
                }}
              />
            </div>
          )}
        </div>

        {/* Cycle Times */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-1">Average Cycle Times</h2>
          <p className="text-xs text-gray-500 mb-4">
            Based on {cycleTimes.sampleSize} activated records
          </p>

          <div className="space-y-4">
            {[
              { label: "New → Matches Sent", value: cycleTimes.newToMatchesSent, color: "text-blue-400" },
              { label: "Matches Sent → Response", value: cycleTimes.matchesSentToResponse, color: "text-purple-400" },
              { label: "Response → CP Asked", value: cycleTimes.responseToCounterparty, color: "text-amber-400" },
              { label: "CP Asked → Activated", value: cycleTimes.counterpartyToActivated, color: "text-green-400" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{item.label}</span>
                <span className={`text-lg font-bold ${item.color}`}>
                  {formatDays(item.value)}
                </span>
              </div>
            ))}

            <div className="border-t border-gray-800 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-medium">Total: New → Activated</span>
                <span className="text-2xl font-bold text-white">
                  {formatDays(cycleTimes.totalCreatedToActivated)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Three columns: Owner Leaderboard + Match Stats + Industry ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Owner Leaderboard */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Owner Leaderboard</h2>
          {ownerLeaderboard.length === 0 ? (
            <p className="text-sm text-gray-600">No assigned records yet</p>
          ) : (
            <div className="space-y-3">
              {ownerLeaderboard.map((o, i) => (
                <div key={o.owner} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-5 text-right font-mono">
                    {i + 1}.
                  </span>
                  <span className="text-sm text-white flex-1 truncate">{o.owner}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300">
                      {o.activated} done
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300">
                      {o.active} active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Match Statistics */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Match Statistics</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Matches</span>
              <span className="text-lg font-bold text-white">{matchStats.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Selected</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-blue-400">{matchStats.selected}</span>
                <span className="text-xs text-gray-600">{matchStats.selectionRate}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Intros Sent</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-purple-400">{matchStats.introsSent}</span>
                <span className="text-xs text-gray-600">{matchStats.introRate}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Feedback Delivered</span>
              <span className="text-lg font-bold text-cyan-400">{matchStats.feedbackDelivered}</span>
            </div>

            {/* Visual funnel */}
            {matchStats.total > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <p className="text-xs text-gray-600 mb-2">Match Funnel</p>
                {[
                  { label: "Total", value: matchStats.total, color: "bg-gray-600" },
                  { label: "Selected", value: matchStats.selected, color: "bg-blue-600" },
                  { label: "Intros", value: matchStats.introsSent, color: "bg-purple-600" },
                  { label: "Feedback", value: matchStats.feedbackDelivered, color: "bg-cyan-600" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-gray-500 w-14 text-right">{item.label}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${(item.value / matchStats.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 w-8">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Industry Breakdown */}
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Top Industries</h2>
          {industries.length === 0 ? (
            <p className="text-sm text-gray-600">No data yet</p>
          ) : (
            <div className="space-y-2">
              {industries.map((ind) => {
                const maxCount = industries[0]?.count ?? 1
                return (
                  <div key={ind.industry} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 flex-1 truncate">
                      {formatIndustry(ind.industry)}
                    </span>
                    <div className="w-24 bg-gray-800 rounded-full h-2">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${(ind.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right font-mono">
                      {ind.count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Stage Breakdown (raw counts) ───────────────── */}
      <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Stage Distribution</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stages).map(([stage, count]) => (
            <div
              key={stage}
              className="px-4 py-3 bg-gray-800 rounded-lg border border-gray-700 text-center min-w-[120px]"
            >
              <p className="text-xs text-gray-500 mb-1">
                {STAGE_LABELS[stage] ?? stage}
              </p>
              <p className="text-xl font-bold text-white">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
