import { NextResponse } from "next/server"
import { z } from "zod"
import db from "@/lib/db"

// ─── Validation Schema ──────────────────────────────────
const createMatchSchema = z.object({
  matchSyrenaUserId: z.string().min(1, "matchSyrenaUserId is required"),
  matchSide: z.enum(["INVESTOR", "FOUNDER"]),
  matchName: z.string().min(1, "matchName is required").max(200),
  matchEmail: z.string().email("invalid email"),
  matchCompany: z.string().max(200).nullable().optional(),
  matchIndustry: z.string().max(100).nullable().optional(),
  whyRelevant: z.string().max(500).nullable().optional(),
  score: z.number().min(0).max(100).optional(),
})

/**
 * POST /api/activation/[id]/matches
 * Add a match to an activation record.
 * - Validates input with Zod
 * - Checks parent record exists
 * - Checks for duplicate match (same user paired twice)
 */
export async function POST(
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
  const parsed = createMatchSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }))
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 })
  }

  const data = parsed.data

  // Check parent record exists
  const record = await db.activationRecord.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!record) {
    return NextResponse.json({ error: "Activation record not found" }, { status: 404 })
  }

  // Check for duplicate match — same matchSyrenaUserId for this record
  const existingMatch = await db.activationMatch.findFirst({
    where: {
      activationRecordId: id,
      matchSyrenaUserId: data.matchSyrenaUserId,
    },
    select: { id: true, matchName: true },
  })
  if (existingMatch) {
    return NextResponse.json(
      {
        error: "Duplicate match",
        message: `${data.matchName} is already a match for this record`,
        existingMatchId: existingMatch.id,
      },
      { status: 409 }
    )
  }

  const match = await db.activationMatch.create({
    data: {
      activationRecordId: id,
      matchSyrenaUserId: data.matchSyrenaUserId,
      matchSide: data.matchSide,
      matchName: data.matchName,
      matchEmail: data.matchEmail,
      matchCompany: data.matchCompany ?? null,
      matchIndustry: data.matchIndustry ?? null,
      whyRelevant: data.whyRelevant ?? null,
      score: data.score ?? 0,
    },
  })

  return NextResponse.json(match, { status: 201 })
}

/**
 * DELETE /api/activation/[id]/matches
 * Remove a match. Pass matchId in query param.
 */
export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const matchId = url.searchParams.get("matchId")

  if (!matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 })
  }

  await db.activationMatch.delete({ where: { id: matchId } })
  return NextResponse.json({ ok: true })
}
