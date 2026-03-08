import { NextResponse } from "next/server"
import { z } from "zod"
import db from "@/lib/db"
import { logMatchAction } from "@/lib/activity-log"

// ─── Validation Schema ──────────────────────────────────
const updateMatchSchema = z.object({
  selected: z.boolean().optional(),
  counterpartyResponse: z.enum(["interested", "declined", "no_response"]).nullable().optional(),
  whyRelevant: z.string().max(500).nullable().optional(),
  introSent: z.boolean().optional(),
  emailSentToMatch: z.boolean().optional(),
  feedback: z.string().max(2000).nullable().optional(),
  feedbackDelivered: z.boolean().optional(),
  actor: z.string().max(100).optional(),
}).refine(
  (data) => Object.keys(data).filter(k => k !== "actor").length > 0,
  { message: "At least one field must be provided" }
)

/**
 * PATCH /api/activation/[id]/matches/[matchId]
 * Update a match (selection, counterparty response, feedback, etc.).
 * - Validates input with Zod
 * - Logs activity to audit trail
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const { id, matchId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = updateMatchSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }))
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 })
  }

  const input = parsed.data

  // Fetch existing match for context
  const existing = await db.activationMatch.findUnique({
    where: { id: matchId },
    select: { id: true, matchName: true, selected: true, introSent: true, feedbackDelivered: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (input.selected !== undefined) data.selected = input.selected
  if (input.counterpartyResponse !== undefined) data.counterpartyResponse = input.counterpartyResponse
  if (input.whyRelevant !== undefined) data.whyRelevant = input.whyRelevant
  if (input.introSent !== undefined) {
    data.introSent = input.introSent
    if (input.introSent) data.introSentAt = new Date()
  }
  if (input.emailSentToMatch !== undefined) {
    data.emailSentToMatch = input.emailSentToMatch
    if (input.emailSentToMatch) data.emailSentToMatchAt = new Date()
  }
  if (input.feedback !== undefined) data.feedback = input.feedback
  if (input.feedbackDelivered !== undefined) {
    data.feedbackDelivered = input.feedbackDelivered
    if (input.feedbackDelivered) data.feedbackDeliveredAt = new Date()
  }

  const match = await db.activationMatch.update({
    where: { id: matchId },
    data,
  })

  // ─── Audit logging (non-blocking) ────────────────────
  const actor = input.actor ?? null
  const matchName = existing.matchName ?? "Unknown"

  if (input.selected !== undefined && input.selected !== existing.selected) {
    logMatchAction(id, "match_selected", matchName,
      input.selected ? `Selected match: ${matchName}` : `Deselected match: ${matchName}`,
      actor, { matchId, selected: input.selected }
    )
  }
  if (input.counterpartyResponse !== undefined) {
    logMatchAction(id, "counterparty_response", matchName,
      `Counterparty ${matchName}: ${input.counterpartyResponse}`,
      actor, { matchId, response: input.counterpartyResponse }
    )
  }
  if (input.introSent && !existing.introSent) {
    logMatchAction(id, "intro_sent", matchName,
      `Intro sent for ${matchName}`,
      actor, { matchId }
    )
  }
  if (input.emailSentToMatch) {
    logMatchAction(id, "email_sent_to_match", matchName,
      `Email sent to ${matchName}`,
      actor, { matchId }
    )
  }
  if (input.feedbackDelivered && !existing.feedbackDelivered) {
    logMatchAction(id, "feedback_delivered", matchName,
      `Feedback delivered to ${matchName}`,
      actor, { matchId }
    )
  }

  return NextResponse.json(match)
}

/**
 * DELETE /api/activation/[id]/matches/[matchId]
 * Remove a specific match.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const { id, matchId } = await params

  // Log before delete so we can capture the match name
  const existing = await db.activationMatch.findUnique({
    where: { id: matchId },
    select: { matchName: true },
  })

  await db.activationMatch.delete({ where: { id: matchId } })

  if (existing) {
    logMatchAction(id, "match_removed", existing.matchName,
      `Match removed: ${existing.matchName}`,
      null, { matchId }
    )
  }

  return NextResponse.json({ ok: true })
}
