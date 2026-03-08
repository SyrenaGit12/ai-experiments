import { NextResponse } from "next/server"
import db from "@/lib/db"

/**
 * GET /api/activation/stats
 * Dashboard statistics for the activation pipeline.
 */
export async function GET() {
  const [
    totalRecords,
    byStage,
    bySide,
    byOwner,
    overdueCount,
    activatedThisWeek,
    recentActivity,
  ] = await Promise.all([
    // Total pipeline records
    db.activationRecord.count(),

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

    // Count by owner
    db.activationRecord.groupBy({
      by: ["owner"],
      _count: true,
      where: { owner: { not: null } },
      orderBy: { _count: { owner: "desc" } },
    }),

    // Overdue (SLA deadline passed)
    db.activationRecord.count({
      where: {
        slaDeadline: { lt: new Date() },
        stage: { notIn: ["ACTIVATED", "STALLED", "DECLINED"] },
      },
    }),

    // Activated this week (last 7 days)
    db.activationRecord.count({
      where: {
        stage: "ACTIVATED",
        activatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
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
        owner: true,
        updatedAt: true,
      },
    }),
  ])

  // Build stage funnel
  const stageCounts: Record<string, number> = {}
  for (const s of byStage) {
    stageCounts[s.stage] = s._count
  }

  const sideCounts: Record<string, number> = {}
  for (const s of bySide) {
    sideCounts[s.side] = s._count
  }

  const ownerCounts: { owner: string; count: number }[] = byOwner.map((o) => ({
    owner: o.owner ?? "Unassigned",
    count: o._count,
  }))

  return NextResponse.json({
    total: totalRecords,
    stages: stageCounts,
    sides: sideCounts,
    owners: ownerCounts,
    overdue: overdueCount,
    activatedThisWeek,
    recentActivity,
  })
}
