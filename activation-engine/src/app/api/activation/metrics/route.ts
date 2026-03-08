import { NextResponse } from "next/server"
import db from "@/lib/db"

/** Get the start of the ISO week (Monday 00:00 UTC) for a given date */
function getISOWeekStart(d: Date): Date {
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1
  return new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - diff,
    0, 0, 0, 0
  ))
}

/**
 * GET /api/activation/metrics
 * Deep analytics for the metrics page:
 *  - Stage conversion rates
 *  - Weekly activation trend (last 8 weeks)
 *  - Owner leaderboard (activations + active)
 *  - Match statistics
 *  - Average cycle time
 *  - Side-by-side breakdown
 *  - Industry breakdown
 */
export async function GET() {
  const now = new Date()

  // ─── Parallel fetch all data ──────────────────────────
  const [
    totalRecords,
    byStageRaw,
    bySideRaw,
    byIndustryRaw,
    totalActivated,
    totalStalled,
    totalDeclined,
    totalMatches,
    selectedMatches,
    introsSent,
    feedbackDelivered,
    // Owner stats: all records grouped by owner
    ownerAllRaw,
    // Owner stats: activated records grouped by owner
    ownerActivatedRaw,
    // Records with timestamps for cycle-time analysis
    cycleTimeRecords,
    // Weekly trend: activated dates
    activatedRecords,
    // Response rate data
    matchesSentRecords,
    respondedRecords,
  ] = await Promise.all([
    db.activationRecord.count(),
    db.activationRecord.groupBy({ by: ["stage"], _count: true }),
    db.activationRecord.groupBy({ by: ["side"], _count: true }),
    db.activationRecord.groupBy({
      by: ["industry"],
      _count: true,
      orderBy: { _count: { industry: "desc" } },
      take: 15,
    }),
    db.activationRecord.count({ where: { stage: "ACTIVATED" } }),
    db.activationRecord.count({ where: { stage: "STALLED" } }),
    db.activationRecord.count({ where: { stage: "DECLINED" } }),
    db.activationMatch.count(),
    db.activationMatch.count({ where: { selected: true } }),
    db.activationMatch.count({ where: { introSent: true } }),
    db.activationMatch.count({ where: { feedbackDelivered: true } }),
    // Owner leaderboard: total active
    db.activationRecord.groupBy({
      by: ["owner"],
      _count: true,
      where: {
        owner: { not: null },
        stage: { notIn: ["ACTIVATED", "STALLED", "DECLINED"] },
      },
      orderBy: { _count: { owner: "desc" } },
    }),
    // Owner leaderboard: total activated
    db.activationRecord.groupBy({
      by: ["owner"],
      _count: true,
      where: {
        owner: { not: null },
        stage: "ACTIVATED",
      },
    }),
    // Cycle time: records with activatedAt
    db.activationRecord.findMany({
      where: { activatedAt: { not: null } },
      select: {
        createdAt: true,
        matchesSentAt: true,
        respondedAt: true,
        counterpartyAskedAt: true,
        counterpartyRespondedAt: true,
        activatedAt: true,
        side: true,
      },
    }),
    // Weekly trend: last 8 weeks of activated records
    db.activationRecord.findMany({
      where: {
        activatedAt: {
          gte: new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: { activatedAt: true, side: true },
    }),
    // Response rate: how many got matches sent
    db.activationRecord.count({ where: { matchesSentAt: { not: null } } }),
    db.activationRecord.count({ where: { respondedAt: { not: null } } }),
  ])

  // ─── Stage breakdown ─────────────────────────────────
  const stages: Record<string, number> = {}
  for (const s of byStageRaw) stages[s.stage] = s._count

  const sides: Record<string, number> = {}
  for (const s of bySideRaw) sides[s.side] = s._count

  // ─── Stage conversion funnel ─────────────────────────
  const stageOrder = [
    "NEW",
    "S1_MATCHES_SENT",
    "S2_USER_RESPONDED",
    "S3_COUNTERPARTY_ASKED",
    "S3_FEEDBACK_RECEIVED",
    "ACTIVATED",
  ]
  // Cumulative: how many records reached each stage or beyond
  const stageReached: Record<string, number> = {}
  for (const stage of stageOrder) {
    const idx = stageOrder.indexOf(stage)
    // A record "reached" a stage if its current stage index >= this stage's index
    let count = 0
    for (const s of byStageRaw) {
      const sIdx = stageOrder.indexOf(s.stage)
      // Handle terminal stages
      if (s.stage === "STALLED" || s.stage === "DECLINED") {
        // These are dropoffs — they reached at least where they dropped off from
        // We can't know exactly, but at minimum they were in the pipeline
        if (idx === 0) count += s._count // At minimum they were NEW
      } else if (sIdx >= idx) {
        count += s._count
      }
    }
    stageReached[stage] = count
  }

  const conversions = stageOrder.slice(1).map((stage, i) => {
    const prev = stageOrder[i]
    const from = stageReached[prev] || 0
    const to = stageReached[stage] || 0
    return {
      from: prev,
      to: stage,
      fromCount: from,
      toCount: to,
      rate: from > 0 ? Math.round((to / from) * 100) : 0,
    }
  })

  // ─── Weekly trend (last 8 weeks) ─────────────────────
  const weeklyTrend: Array<{
    weekStart: string
    founders: number
    investors: number
    total: number
  }> = []
  for (let w = 7; w >= 0; w--) {
    const d = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000)
    const ws = getISOWeekStart(d)
    const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000)

    let founders = 0
    let investors = 0
    for (const rec of activatedRecords) {
      if (rec.activatedAt && rec.activatedAt >= ws && rec.activatedAt < we) {
        if (rec.side === "FOUNDER") founders++
        else investors++
      }
    }
    weeklyTrend.push({
      weekStart: ws.toISOString().slice(0, 10),
      founders,
      investors,
      total: founders + investors,
    })
  }

  // ─── Average cycle time (in days) ────────────────────
  function avgDays(timestamps: Array<{ start: Date | null; end: Date | null }>): number | null {
    const valid = timestamps.filter(
      (t) => t.start && t.end
    ) as Array<{ start: Date; end: Date }>
    if (valid.length === 0) return null
    const totalMs = valid.reduce(
      (sum, t) => sum + (t.end.getTime() - t.start.getTime()),
      0
    )
    return Math.round((totalMs / valid.length / (1000 * 60 * 60 * 24)) * 10) / 10
  }

  const cycleTimes = {
    newToMatchesSent: avgDays(
      cycleTimeRecords.map((r) => ({ start: r.createdAt, end: r.matchesSentAt }))
    ),
    matchesSentToResponse: avgDays(
      cycleTimeRecords.map((r) => ({ start: r.matchesSentAt, end: r.respondedAt }))
    ),
    responseToCounterparty: avgDays(
      cycleTimeRecords.map((r) => ({ start: r.respondedAt, end: r.counterpartyAskedAt }))
    ),
    counterpartyToActivated: avgDays(
      cycleTimeRecords.map((r) => ({
        start: r.counterpartyAskedAt,
        end: r.activatedAt,
      }))
    ),
    totalCreatedToActivated: avgDays(
      cycleTimeRecords.map((r) => ({ start: r.createdAt, end: r.activatedAt }))
    ),
    sampleSize: cycleTimeRecords.length,
  }

  // ─── Owner leaderboard ───────────────────────────────
  const activatedMap: Record<string, number> = {}
  for (const o of ownerActivatedRaw) {
    if (o.owner) activatedMap[o.owner] = o._count
  }

  const ownerLeaderboard = ownerAllRaw
    .filter((o) => o.owner)
    .map((o) => ({
      owner: o.owner as string,
      active: o._count,
      activated: activatedMap[o.owner as string] ?? 0,
    }))
    .sort((a, b) => b.activated - a.activated || a.active - b.active)

  // ─── Industry breakdown ──────────────────────────────
  const industries = byIndustryRaw.map((i) => ({
    industry: i.industry,
    count: i._count,
  }))

  // ─── Match statistics ────────────────────────────────
  const matchStats = {
    total: totalMatches,
    selected: selectedMatches,
    introsSent,
    feedbackDelivered,
    selectionRate: totalMatches > 0 ? Math.round((selectedMatches / totalMatches) * 100) : 0,
    introRate: selectedMatches > 0 ? Math.round((introsSent / selectedMatches) * 100) : 0,
  }

  // ─── Response rate ───────────────────────────────────
  const responseRate = matchesSentRecords > 0
    ? Math.round((respondedRecords / matchesSentRecords) * 100)
    : 0

  // ─── Activation rate ─────────────────────────────────
  const activationRate = totalRecords > 0
    ? Math.round((totalActivated / totalRecords) * 100)
    : 0

  return NextResponse.json({
    summary: {
      totalRecords,
      totalActivated,
      totalStalled,
      totalDeclined,
      activationRate,
      responseRate,
      matchesSent: matchesSentRecords,
      responded: respondedRecords,
    },
    stages,
    sides,
    conversions,
    weeklyTrend,
    cycleTimes,
    ownerLeaderboard,
    industries,
    matchStats,
  })
}
