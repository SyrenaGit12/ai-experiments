import { NextResponse } from "next/server"
import db from "@/lib/db"

/**
 * GET /api/templates
 * List all email templates.
 */
export async function GET() {
  const templates = await db.emailTemplate.findMany({
    orderBy: { slug: "asc" },
  })
  return NextResponse.json(templates)
}

/**
 * POST /api/templates
 * Create or update an email template (upsert by slug).
 */
export async function POST(request: Request) {
  const body = await request.json()

  const template = await db.emailTemplate.upsert({
    where: { slug: body.slug },
    create: {
      slug: body.slug,
      name: body.name,
      subject: body.subject,
      body: body.body,
      side: body.side ?? null,
      description: body.description ?? null,
    },
    update: {
      name: body.name,
      subject: body.subject,
      body: body.body,
      side: body.side ?? null,
      description: body.description ?? null,
    },
  })

  return NextResponse.json(template)
}
