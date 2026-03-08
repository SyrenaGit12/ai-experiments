import { NextResponse } from "next/server"
import db from "@/lib/db"

/** Escape a string value for CSV: double-quote any embedded quotes */
function csvEscape(value: string): string {
  return value.replace(/"/g, '""')
}

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
    csvEscape(r.side),
    csvEscape(r.name),
    csvEscape(r.email),
    csvEscape(r.company ?? ""),
    csvEscape(r.industry),
    csvEscape(r.stage),
    csvEscape(r.owner ?? ""),
    r.matches.length.toString(),
    r.matchesSentAt?.toISOString() ?? "",
    csvEscape(r.matches.find((m) => m.selected)?.matchName ?? ""),
    r.respondedAt?.toISOString() ?? "",
    r.counterpartyAskedAt?.toISOString() ?? "",
    r.counterpartyRespondedAt?.toISOString() ?? "",
    csvEscape(r.outcome ?? ""),
    r.activatedAt?.toISOString() ?? "",
    csvEscape(r.notes ?? ""),
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
