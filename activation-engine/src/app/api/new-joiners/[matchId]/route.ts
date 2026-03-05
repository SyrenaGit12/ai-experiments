import { NextResponse } from "next/server"
import db from "@/lib/db"

/**
 * GET /api/new-joiners/[matchId]
 * Get a specific new joiner match.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params
    const match = await db.newJoinerMatch.findUnique({
      where: { id: matchId },
    })

    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ match })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get match"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/new-joiners/[matchId]
 * Update a new joiner match:
 * - Approve/reject the match
 * - Update personalization line (whyRelevant)
 * - Record selection or feedback
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params
    const body = await request.json()

    const existing = await db.newJoinerMatch.findUnique({
      where: { id: matchId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      )
    }

    // Build update data from allowed fields
    const updateData: Record<string, unknown> = {}

    if (typeof body.approved === "boolean") {
      updateData.approved = body.approved
    }

    if (typeof body.whyRelevant === "string") {
      updateData.whyRelevant = body.whyRelevant
    }

    if (typeof body.stage === "number") {
      updateData.stage = body.stage
    }

    if (typeof body.selected === "boolean") {
      updateData.selected = body.selected
    }

    if (typeof body.feedback === "string") {
      updateData.feedback = body.feedback
    }

    if (typeof body.feedbackPositive === "boolean") {
      updateData.feedbackPositive = body.feedbackPositive
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    const updated = await db.newJoinerMatch.update({
      where: { id: matchId },
      data: updateData,
    })

    return NextResponse.json({ match: updated })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update match"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/new-joiners/[matchId]
 * Remove a new joiner match.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params
    const existing = await db.newJoinerMatch.findUnique({
      where: { id: matchId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      )
    }

    await db.newJoinerMatch.delete({
      where: { id: matchId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete match"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
