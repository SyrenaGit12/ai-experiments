import { NextResponse } from "next/server"
import db from "@/lib/db"

/**
 * GET /api/activation/export
 * Export all activation records as CSV.
 */
export async function GET() {
  const records = await db.activationRecord.findMany({
    include: { matches: true },
    orderBy: [{ side: "asc" }, { stage: "asc" }, { updatedAt: "desc" }],
  })

  const headers = [
    "Side",
    "Name",
    "Email",
    "Company",
    "Industry",
    "Stage",
    "Owner",
    "Matches Offered",
    "Matches Sent Date",
    "Selected Match",
    "Responded Date",
    "Counterparty Asked Date",
    "Counterparty Responded Date",
    "Outcome",
    "Activated Date",
    "Notes",
    "SLA Deadline",
  ]

  const rows = records.map((r) => [
    r.side,
    r.name,
    r.email,
    r.company ?? "",
    r.industry,
    r.stage,
    r.owner ?? "",
    r.matches.length.toString(),
    r.matchesSentAt?.toISOString() ?? "",
    r.matches.find((m) => m.selected)?.matchName ?? "",
    r.respondedAt?.toISOString() ?? "",
    r.counterpartyAskedAt?.toISOString() ?? "",
    r.counterpartyRespondedAt?.toISOString() ?? "",
    r.outcome ?? "",
    r.activatedAt?.toISOString() ?? "",
    (r.notes ?? "").replace(/"/g, '""'),
    r.slaDeadline?.toISOString() ?? "",
  ])

  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="activation-pipeline-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
