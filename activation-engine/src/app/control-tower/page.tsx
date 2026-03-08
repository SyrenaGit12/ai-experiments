import db from "@/lib/db"
import Link from "next/link"
import { WEEKLY_TARGETS, STAGE_LABELS, STAGE_BAR_COLORS } from "@/lib/constants"

/** Get the start of the current ISO week (Monday 00:00 UTC) */
function getISOWeekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1 // Days since Monday
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - diff,
    0, 0, 0, 0
  ))
  return monday
}

async function getDashboardStats() {
  const now = new Date()
  const weekStart = getISOWeekStart()

  const [
    totalRecords,
    activatedThisWeek,
    slaOverdue,
    byStageRaw,
    bySideRaw,
    byOwnerRaw,
    recentActivity,
    activatedFoundersThisWeek,
    activatedInvestorsThisWeek,
    totalMatches,
    introsSent,
  ] = await Promise.all([
    db.activationRecord.count(),
    db.activationRecord.count({
      where: { activatedAt: { gte: weekStart } },
    }),
    db.activationRecord.count({
      where: {
        slaDeadline: { lt: now },
        stage: { notIn: ["ACTIVATED", "STALLED", "DECLINED"] },
      },
    }),
    db.activationRecord.groupBy({ by: ["stage"], _count: true }),
    db.activationRecord.groupBy({ by: ["side"], _count: true }),
    db.activationRecord.groupBy({
      by: ["owner"],
      _count: true,
      where: {
        owner: { not: null },
        stage: { notIn: ["ACTIVATED", "STALLED", "DECLINED"] },
      },
      orderBy: { _count: { owner: "desc" } },
    }),
    db.activationRecord.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        side: true,
        stage: true,
        updatedAt: true,
        company: true,
      },
    }),
    db.activationRecord.count({
      where: { activatedAt: { gte: weekStart }, side: "FOUNDER" },
    }),
    db.activationRecord.count({
      where: { activatedAt: { gte: weekStart }, side: "INVESTOR" },
    }),
    db.activationMatch.count(),
    db.activationMatch.count({ where: { introSent: true } }),
  ])

  const byStage = Object.fromEntries(
    byStageRaw.map((s) => [s.stage, s._count])
  )
  const bySide = Object.fromEntries(
    bySideRaw.map((s) => [s.side, s._count])
  )
  const byOwner = byOwnerRaw
    .filter((o) => o.owner)
    .map((o) => ({ owner: o.owner as string, count: o._count }))

  return {
    totalRecords,
    activatedThisWeek,
    slaOverdue,
    byStage,
    bySide,
    byOwner,
    recentActivity,
    activatedFoundersThisWeek,
    activatedInvestorsThisWeek,
    totalMatches,
    introsSent,
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  const founderPct = Math.min(
    100,
    Math.round((stats.activatedFoundersThisWeek / WEEKLY_TARGETS.founders) * 100)
  )
  const investorPct = Math.min(
    100,
    Math.round((stats.activatedInvestorsThisWeek / WEEKLY_TARGETS.investors) * 100)
  )

  const funnelStages = [
    "NEW",
    "S1_MATCHES_SENT",
    "S2_USER_RESPONDED",
    "S3_COUNTERPARTY_ASKED",
    "S3_FEEDBACK_RECEIVED",
    "ACTIVATED",
  ]
  const maxFunnelCount = Math.max(
    1,
    ...funnelStages.map((s) => stats.byStage[s] ?? 0)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Activation Workspace Overview
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Pipeline</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.totalRecords}</p>
          <p className="text-gray-500 text-xs mt-1">
            {stats.bySide["INVESTOR"] ?? 0} inv &middot; {stats.bySide["FOUNDER"] ?? 0} fdr
          </p>
        </div>
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">Activated (this week)</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{stats.activatedThisWeek}</p>
        </div>
        <div className="p-5 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-xs uppercase tracking-wide">SLA Overdue</p>
          <p className={`text-3xl font-bold mt-1 ${stats.slaOverdue > 0 ? "text-red-400" : "text-white"}`}>
            {stats.slaOverdue}
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
            {funnelStages.map((stage) => {
              const count = stats.byStage[stage] ?? 0
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
          {(stats.byStage["STALLED"] ?? 0) + (stats.byStage["DECLINED"] ?? 0) > 0 && (
            <p className="text-gray-600 text-xs mt-3">
              + {stats.byStage["STALLED"] ?? 0} stalled, {stats.byStage["DECLINED"] ?? 0} declined
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
          {stats.byOwner.length === 0 ? (
            <p className="text-gray-500 text-sm">No records assigned yet</p>
          ) : (
            <div className="space-y-2">
              {stats.byOwner.map((o) => (
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
                    {new Date(rec.updatedAt).toLocaleDateString()}
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
