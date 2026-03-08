import { NextResponse } from "next/server"
import db from "@/lib/db"

/**
 * GET /api/activation/queue
 * Returns action-needed items grouped by urgency bucket.
 * Query params:
 *   owner - filter to a specific team member
 *
 * Buckets (in priority order):
 *   1. sla_overdue   - SLA deadline has passed, not terminal
 *   2. needs_action   - stuck in a stage that needs operator action
 *   3. new_unassigned - NEW stage, no owner assigned
 *   4. sla_soon       - SLA deadline within 12 hours
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

  // 1. SLA overdue — deadline passed, still in pipeline
  const slaOverdue = await db.activationRecord.findMany({
    where: {
      ...baseWhere,
      slaDeadline: { lt: now },
    },
    include: { matches: { select: { id: true, matchName: true, selected: true, introSent: true, counterpartyResponse: true } } },
    orderBy: { slaDeadline: "asc" },
    take: 50,
  })

  // 2. Needs action — stages where operator must do something
  //    S2_USER_RESPONDED: user replied, need to ask counterparty
  //    S3_FEEDBACK_RECEIVED: feedback in, need to deliver/activate
  const needsAction = await db.activationRecord.findMany({
    where: {
      ...baseWhere,
      stage: { in: ["S2_USER_RESPONDED", "S3_FEEDBACK_RECEIVED"] },
      // Exclude ones already in slaOverdue
      OR: [
        { slaDeadline: null },
        { slaDeadline: { gte: now } },
      ],
    },
    include: { matches: { select: { id: true, matchName: true, selected: true, introSent: true, counterpartyResponse: true } } },
    orderBy: { updatedAt: "asc" }, // oldest first = most urgent
    take: 50,
  })

  // 3. New & unassigned — need to be picked up by someone
  const newUnassigned = await db.activationRecord.findMany({
    where: {
      stage: "NEW",
      owner: owner ? owner : null, // if filtering by owner, show their NEW items; otherwise show unassigned
      ...(owner ? {} : { owner: null }),
    },
    include: { matches: { select: { id: true, matchName: true, selected: true } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  })

  // 4. SLA deadline approaching (within 12 hours but not overdue)
  const slaSoon = await db.activationRecord.findMany({
    where: {
      ...baseWhere,
      slaDeadline: { gte: now, lt: twelveHoursFromNow },
    },
    include: { matches: { select: { id: true, matchName: true, selected: true, introSent: true, counterpartyResponse: true } } },
    orderBy: { slaDeadline: "asc" },
    take: 50,
  })

  // 5. Waiting — S1 or S3_COUNTERPARTY_ASKED, waiting for external response
  const waiting = await db.activationRecord.findMany({
    where: {
      ...baseWhere,
      stage: { in: ["S1_MATCHES_SENT", "S3_COUNTERPARTY_ASKED"] },
      OR: [
        { slaDeadline: null },
        { slaDeadline: { gte: twelveHoursFromNow } },
      ],
    },
    include: { matches: { select: { id: true, matchName: true, selected: true, introSent: true } } },
    orderBy: { updatedAt: "asc" },
    take: 50,
  })

  return NextResponse.json({
    slaOverdue,
    needsAction,
    newUnassigned,
    slaSoon,
    waiting,
    counts: {
      slaOverdue: slaOverdue.length,
      needsAction: needsAction.length,
      newUnassigned: newUnassigned.length,
      slaSoon: slaSoon.length,
      waiting: waiting.length,
      total: slaOverdue.length + needsAction.length + newUnassigned.length + slaSoon.length + waiting.length,
    },
  })
}
