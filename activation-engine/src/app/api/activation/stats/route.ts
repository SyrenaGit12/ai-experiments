import { NextResponse } from "next/server"
import db from "@/lib/db"

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

/**
 * GET /api/activation/stats
 * Dashboard statistics for the activation pipeline.
 * Returns all data needed for the dashboard overview.
 */
export async function GET() {
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
    // Total pipeline records
    db.activationRecord.count(),

    // Activated this ISO week (since Monday 00:00 UTC)
    db.activationRecord.count({
      where: { activatedAt: { gte: weekStart } },
    }),

    // Overdue (SLA deadline passed, still in active stage)
    db.activationRecord.count({
      where: {
        slaDeadline: { lt: now },
        stage: { notIn: ["ACTIVATED", "STALLED", "DECLINED"] },
      },
    }),

    // Count by stage
    db.activationRecord.groupBy({
      by: ["stage"],
      _count: true,
    }),

    // Count by side
    db.activationRecord.groupBy({
      by: ["side"],
      _count: true,
    }),

    // Count by owner (active records only)
    db.activationRecord.groupBy({
      by: ["owner"],
      _count: true,
      where: {
        owner: { not: null },
        stage: { notIn: ["ACTIVATED", "STALLED", "DECLINED"] },
      },
      orderBy: { _count: { owner: "desc" } },
    }),

    // Recent activity (last 10 updates)
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

    // Founders activated this week
    db.activationRecord.count({
      where: { activatedAt: { gte: weekStart }, side: "FOUNDER" },
    }),

    // Investors activated this week
    db.activationRecord.count({
      where: { activatedAt: { gte: weekStart }, side: "INVESTOR" },
    }),

    // Total matches created
    db.activationMatch.count(),

    // Intros sent
    db.activationMatch.count({ where: { introSent: true } }),
  ])

  // Build stage/side maps
  const stages: Record<string, number> = {}
  for (const s of byStageRaw) {
    stages[s.stage] = s._count
  }

  const sides: Record<string, number> = {}
  for (const s of bySideRaw) {
    sides[s.side] = s._count
  }

  const owners = byOwnerRaw
    .filter((o) => o.owner)
    .map((o) => ({ owner: o.owner as string, count: o._count }))

  return NextResponse.json({
    total: totalRecords,
    activatedThisWeek,
    overdue: slaOverdue,
    stages,
    sides,
    owners,
    recentActivity,
    activatedFoundersThisWeek,
    activatedInvestorsThisWeek,
    totalMatches,
    introsSent,
  })
}
