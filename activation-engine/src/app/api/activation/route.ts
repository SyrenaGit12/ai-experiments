import { NextResponse } from "next/server"
import { z } from "zod"
import db from "@/lib/db"
import type { ActivationSide, ActivationStage } from "@prisma/client"
import { SYRENA_INDUSTRIES, SYRENA_FUNDING_STAGES, TEAM_MEMBERS } from "@/lib/constants"
import { logActivity } from "@/lib/activity-log"

// ─── Validation Schemas ─────────────────────────────────
const createActivationSchema = z.object({
  syrenaUserId: z.string().min(1, "syrenaUserId is required"),
  side: z.enum(["INVESTOR", "FOUNDER"]),
  name: z.string().min(1, "name is required").max(200),
  email: z.string().email("invalid email address"),
  company: z.string().max(200).nullable().optional(),
  industry: z.enum(SYRENA_INDUSTRIES as unknown as [string, ...string[]]),
  fundingStage: z.enum(SYRENA_FUNDING_STAGES as unknown as [string, ...string[]]).nullable().optional(),
  owner: z.enum(TEAM_MEMBERS as unknown as [string, ...string[]]).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  slaDeadline: z.string().datetime().nullable().optional(),
})

/**
 * GET /api/activation
 * List all activation records with optional filters.
 * Query params: side, stage, owner, industry, search, limit, offset
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const side = url.searchParams.get("side") as ActivationSide | null
  const stage = url.searchParams.get("stage") as ActivationStage | null
  const owner = url.searchParams.get("owner")
  const industry = url.searchParams.get("industry")
  const search = url.searchParams.get("search")
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200)
  const offset = parseInt(url.searchParams.get("offset") ?? "0")

  const where: Record<string, unknown> = {}
  if (side) where.side = side
  if (stage) where.stage = stage
  if (owner) where.owner = owner
  if (industry) where.industry = industry
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ]
  }

  // Build base where (without stage filter) for stage counts
  const baseWhere: Record<string, unknown> = {}
  if (side) baseWhere.side = side
  if (owner) baseWhere.owner = owner
  if (industry) baseWhere.industry = industry
  if (search) {
    baseWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ]
  }

  const [records, total, stageGroups] = await Promise.all([
    db.activationRecord.findMany({
      where,
      include: { matches: true },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.activationRecord.count({ where }),
    db.activationRecord.groupBy({
      by: ["stage"],
      where: baseWhere,
      _count: true,
    }),
  ])

  // Convert groupBy result to { stage: count } map
  const stageCounts: Record<string, number> = {}
  for (const g of stageGroups) {
    stageCounts[g.stage] = g._count
  }

  return NextResponse.json({ records, total, limit, offset, stageCounts })
}

/**
 * POST /api/activation
 * Create a new activation record (add user to pipeline).
 * - Validates input with Zod
 * - Checks for duplicate syrenaUserId (returns 409 with existing record)
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate input
  const parsed = createActivationSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }))
    return NextResponse.json({ error: "Validation failed", errors }, { status: 400 })
  }

  const data = parsed.data

  // Check for duplicate — syrenaUserId is unique in the schema
  const existing = await db.activationRecord.findUnique({
    where: { syrenaUserId: data.syrenaUserId },
    select: { id: true, name: true, stage: true },
  })
  if (existing) {
    return NextResponse.json(
      {
        error: "Already in pipeline",
        message: `${existing.name} is already in the pipeline (stage: ${existing.stage})`,
        existingId: existing.id,
      },
      { status: 409 }
    )
  }

  const record = await db.activationRecord.create({
    data: {
      syrenaUserId: data.syrenaUserId,
      side: data.side,
      name: data.name,
      email: data.email,
      company: data.company ?? null,
      industry: data.industry,
      fundingStage: data.fundingStage ?? null,
      owner: data.owner ?? null,
      notes: data.notes ?? null,
      slaDeadline: data.slaDeadline ? new Date(data.slaDeadline) : null,
    },
  })

  // Non-blocking audit log
  logActivity({
    activationRecordId: record.id,
    action: "RECORD_CREATED",
    detail: `${data.name} (${data.side}) added to pipeline`,
    meta: {
      side: data.side,
      industry: data.industry,
      owner: data.owner ?? null,
      fundingStage: data.fundingStage ?? null,
    },
  })

  return NextResponse.json(record, { status: 201 })
}
