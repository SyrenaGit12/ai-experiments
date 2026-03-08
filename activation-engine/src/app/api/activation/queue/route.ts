import { NextResponse } from "next/server"
import type { ActivationStage } from "@prisma/client"
import db from "@/lib/db"

/**
 * GET /api/activation/queue
 * Returns action-needed items grouped by urgency bucket.
 * Query params:
 *   owner - filter to a specific team member (only affects buckets 1,2,4,5)
 *
 * Buckets (in priority order):
 *   1. sla_overdue   - SLA deadline has passed, not terminal
 *   2. needs_action   - stuck in a stage that needs operator action
 *   3. new_unassigned - NEW stage, no owner assigned (always shows unassigned)
 *   4. sla_soon       - SLA deadline within 12 hours
 *   5. waiting        - waiting for external response
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const owner = url.searchParams.get("owner")

  const now = new Date()
  const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000)

  // Base filter: exclude terminal states
  const baseWhere: Record<string, unknown> = {
    stage: { notIn: ["ACTIVATED", "STALLED", "DECLINED"] },
  }
  if (owner) baseWhere.owner = owner

  const matchSelect = { id: true, matchName: true, selected: true, introSent: true, counterpartyResponse: true }

  // ─── WHERE clauses (shared between findMany + count) ───
  const slaOverdueWhere = {
    ...baseWhere,
    slaDeadline: { lt: now },
  }

  const needsActionWhere = {
    ...baseWhere,
    stage: { in: ["S2_USER_RESPONDED", "S3_FEEDBACK_RECEIVED"] as ActivationStage[] },
    OR: [
      { slaDeadline: null },
      { slaDeadline: { gte: now } },
    ],
  }

  // Bug fix: Always show NEW + unassigned items regardless of owner filter
  const newUnassignedWhere = {
    stage: "NEW" as const,
    owner: null,
  }

  const slaSoonWhere = {
    ...baseWhere,
    slaDeadline: { gte: now, lt: twelveHoursFromNow },
  }

  const waitingWhere = {
    ...baseWhere,
    stage: { in: ["S1_MATCHES_SENT", "S3_COUNTERPARTY_ASKED"] as ActivationStage[] },
    OR: [
      { slaDeadline: null },
      { slaDeadline: { gte: twelveHoursFromNow } },
    ],
  }

  // ─── Parallel fetch: data (capped at 50) + true counts ───
  const [
    slaOverdue,
    needsAction,
    newUnassigned,
    slaSoon,
    waiting,
    slaOverdueCount,
    needsActionCount,
    newUnassignedCount,
    slaSoonCount,
    waitingCount,
  ] = await Promise.all([
    // Data queries (capped at 50 for UI performance)
    db.activationRecord.findMany({
      where: slaOverdueWhere,
      include: { matches: { select: matchSelect } },
      orderBy: { slaDeadline: "asc" },
      take: 50,
    }),
    db.activationRecord.findMany({
      where: needsActionWhere,
      include: { matches: { select: matchSelect } },
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
    db.activationRecord.findMany({
      where: newUnassignedWhere,
      include: { matches: { select: { id: true, matchName: true, selected: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    db.activationRecord.findMany({
      where: slaSoonWhere,
      include: { matches: { select: matchSelect } },
      orderBy: { slaDeadline: "asc" },
      take: 50,
    }),
    db.activationRecord.findMany({
      where: waitingWhere,
      include: { matches: { select: { id: true, matchName: true, selected: true, introSent: true } } },
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
    // True count queries (not capped)
    db.activationRecord.count({ where: slaOverdueWhere }),
    db.activationRecord.count({ where: needsActionWhere }),
    db.activationRecord.count({ where: newUnassignedWhere }),
    db.activationRecord.count({ where: slaSoonWhere }),
    db.activationRecord.count({ where: waitingWhere }),
  ])

  return NextResponse.json({
    slaOverdue,
    needsAction,
    newUnassigned,
    slaSoon,
    waiting,
    counts: {
      slaOverdue: slaOverdueCount,
      needsAction: needsActionCount,
      newUnassigned: newUnassignedCount,
      slaSoon: slaSoonCount,
      waiting: waitingCount,
      total: slaOverdueCount + needsActionCount + newUnassignedCount + slaSoonCount + waitingCount,
    },
  })
}
