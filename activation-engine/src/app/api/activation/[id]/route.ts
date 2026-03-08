import { NextResponse } from "next/server"
import { z } from "zod"
import db from "@/lib/db"
import { STAGES, TEAM_MEMBERS } from "@/lib/constants"
import { logStageChange, logOwnerChange, logNotesUpdate, logActivity } from "@/lib/activity-log"
import { getStageTransitionFields } from "@/lib/stage-transitions"

// ─── Validation Schema ──────────────────────────────────
const updateActivationSchema = z.object({
  stage: z.enum(STAGES as unknown as [string, ...string[]]).optional(),
  owner: z.enum(TEAM_MEMBERS as unknown as [string, ...string[]]).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  outcome: z.string().max(500).nullable().optional(),
  selectedMatchId: z.string().nullable().optional(),
  actor: z.string().max(100).optional(), // who performed the action
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
)

/**
 * GET /api/activation/[id]
 * Get a single activation record with all matches.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const record = await db.activationRecord.findUnique({
    where: { id },
    include: { matches: { orderBy: { score: "desc" } } },
  })

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(record)
}

/**
 * PATCH /api/activation/[id]
 * Update an activation record (stage, owner, notes, etc.).
 * - Validates input with Zod
 * - Auto-sets timestamps on stage transitions
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate input
  const parsed = updateActivationSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }))
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 })
  }

  const input = parsed.data

  // Check record exists (fetch fields needed for diff logging)
  const existing = await db.activationRecord.findUnique({
    where: { id },
    select: { id: true, stage: true, owner: true, notes: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Build update data — only include fields that are provided
  const data: Record<string, unknown> = {}

  if (input.stage !== undefined) data.stage = input.stage
  if (input.owner !== undefined) data.owner = input.owner
  if (input.notes !== undefined) data.notes = input.notes
  if (input.outcome !== undefined) data.outcome = input.outcome
  if (input.selectedMatchId !== undefined) data.selectedMatchId = input.selectedMatchId

  // Stage transitions — apply timestamp side-effects
  if (input.stage) {
    Object.assign(data, getStageTransitionFields(input.stage, input.actor))
  }

  const record = await db.activationRecord.update({
    where: { id },
    data,
    include: { matches: true },
  })

  // ─── Audit logging (non-blocking) ────────────────────
  const actor = input.actor ?? null

  if (input.stage !== undefined && input.stage !== existing.stage) {
    logStageChange(id, existing.stage, input.stage, actor)
  }
  if (input.owner !== undefined && input.owner !== existing.owner) {
    logOwnerChange(id, existing.owner, input.owner, actor)
  }
  if (input.notes !== undefined && input.notes !== existing.notes) {
    logNotesUpdate(id, actor)
  }
  if (input.outcome !== undefined) {
    logActivity({
      activationRecordId: id,
      action: "outcome_set",
      actor,
      detail: `Outcome set to "${input.outcome}"`,
      meta: { outcome: input.outcome },
    })
  }

  return NextResponse.json(record)
}

/**
 * DELETE /api/activation/[id]
 * Remove an activation record from the pipeline.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Fetch name for audit log before deleting
  const record = await db.activationRecord.findUnique({
    where: { id },
    select: { name: true },
  })

  await db.activationRecord.delete({ where: { id } })

  // Non-blocking audit log
  logActivity({
    activationRecordId: id,
    action: "record_deleted",
    detail: `Record deleted: ${record?.name ?? id}`,
  })

  return NextResponse.json({ ok: true })
}
