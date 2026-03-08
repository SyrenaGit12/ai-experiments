import { NextResponse } from "next/server"
import { z } from "zod"
import db from "@/lib/db"
import { STAGES, TEAM_MEMBERS } from "@/lib/constants"
import { logStageChange, logOwnerChange, logActivity } from "@/lib/activity-log"

// ─── Validation Schema ──────────────────────────────────
const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one ID required").max(100),
  action: z.enum(["assign_owner", "set_stage", "delete"]),
  value: z.string().nullable().optional(),
  actor: z.string().max(100).optional(),
}).refine(
  (data) => {
    if (data.action === "assign_owner") {
      // value must be a valid team member or null (unassign)
      return data.value === null || TEAM_MEMBERS.includes(data.value as typeof TEAM_MEMBERS[number])
    }
    if (data.action === "set_stage") {
      return data.value && STAGES.includes(data.value as typeof STAGES[number])
    }
    return true // delete doesn't need a value
  },
  { message: "Invalid value for the specified action" }
)

/**
 * POST /api/activation/bulk
 * Perform a bulk action on multiple activation records.
 * Actions: assign_owner, set_stage, delete
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = bulkActionSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }))
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 })
  }

  const { ids, action, value, actor } = parsed.data

  // Fetch existing records for diff logging
  const existing = await db.activationRecord.findMany({
    where: { id: { in: ids } },
    select: { id: true, stage: true, owner: true, name: true },
  })

  const existingMap = new Map(existing.map((r) => [r.id, r]))
  const validIds = existing.map((r) => r.id)

  if (validIds.length === 0) {
    return NextResponse.json({ error: "No matching records found" }, { status: 404 })
  }

  let updated = 0

  if (action === "delete") {
    // Delete all matching records
    const result = await db.activationRecord.deleteMany({
      where: { id: { in: validIds } },
    })
    updated = result.count

    // Log each deletion
    for (const rec of existing) {
      logActivity({
        activationRecordId: rec.id,
        action: "record_deleted",
        actor: actor ?? null,
        detail: `Record deleted: ${rec.name}`,
      })
    }
  } else if (action === "assign_owner") {
    const newOwner = value ?? null
    const result = await db.activationRecord.updateMany({
      where: { id: { in: validIds } },
      data: { owner: newOwner },
    })
    updated = result.count

    // Log owner changes (non-blocking)
    for (const rec of existing) {
      if (rec.owner !== newOwner) {
        logOwnerChange(rec.id, rec.owner, newOwner, actor ?? null)
      }
    }
  } else if (action === "set_stage") {
    const newStage = value!

    // Build update data with timestamp handling
    const data: Record<string, unknown> = { stage: newStage }

    if (newStage === "S1_MATCHES_SENT") {
      data.matchesSentAt = new Date()
      data.matchesSentBy = actor ?? null
      data.slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
    if (newStage === "S2_USER_RESPONDED") {
      data.respondedAt = new Date()
    }
    if (newStage === "S3_COUNTERPARTY_ASKED") {
      data.counterpartyAskedAt = new Date()
      data.slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
    if (newStage === "S3_FEEDBACK_RECEIVED") {
      data.counterpartyRespondedAt = new Date()
    }
    if (newStage === "ACTIVATED") {
      data.activatedAt = new Date()
      data.slaDeadline = null
    }

    const result = await db.activationRecord.updateMany({
      where: { id: { in: validIds } },
      data,
    })
    updated = result.count

    // Log stage changes (non-blocking)
    for (const rec of existing) {
      if (rec.stage !== newStage) {
        logStageChange(rec.id, rec.stage, newStage, actor ?? null)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    action,
    updated,
    requested: ids.length,
    found: validIds.length,
  })
}
