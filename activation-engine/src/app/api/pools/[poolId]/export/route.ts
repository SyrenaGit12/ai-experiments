import { NextResponse } from "next/server"
import db from "@/lib/db"

/**
 * GET /api/pools/[poolId]/export
 * Export pool data as CSV.
 *
 * One row per pair with all relevant data:
 * pool info, investor info, founder info, scores, selections, outcomes, feedback
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await params

  const pool = await db.pool.findUnique({
    where: { id: poolId },
    include: {
      members: true,
      pairs: {
        include: {
          matchScore: true,
          personalizationLines: true,
          emails: {
            select: {
              side: true,
              step: true,
              sentAt: true,
              openedAt: true,
              repliedAt: true,
            },
          },
        },
        orderBy: { score: "desc" },
      },
    },
  })

  if (!pool) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  }

  // Build member lookup for stage info
  const memberByUserId = new Map(
    pool.members.map((m) => [`${m.userId}_${m.side}`, m])
  )

  // CSV headers
  const headers = [
    "pool_id",
    "pool_industry",
    "pool_status",
    "pool_is_test",
    "pair_id",
    "pair_score",
    "pair_rank",
    // Investor
    "investor_id",
    "investor_name",
    "investor_email",
    "investor_tier",
    "investor_stage",
    "investor_engagement_score",
    // Founder
    "founder_id",
    "founder_name",
    "founder_email",
    "founder_stage",
    "founder_engagement_score",
    // Score breakdown
    "industry_score",
    "location_score",
    "stage_score",
    "cheque_size_score",
    "engagement_score",
    // Presentation
    "presented_to_investor",
    "presented_to_founder",
    // Selection (Stage 2)
    "investor_selected",
    "founder_selected",
    "cross_match_outcome",
    // Personalization
    "investor_personalization",
    "investor_personalization_approved",
    "founder_personalization",
    "founder_personalization_approved",
    // Feedback (Stage 3)
    "investor_feedback",
    "investor_feedback_positive",
    "founder_feedback",
    "founder_feedback_positive",
    "feedback_delivered_at",
    // Outcome
    "match_score_outcome",
    "match_score_outcome_reason",
    // Email tracking
    "a1_sent_at",
    "a1_opened_at",
    "b1_sent_at",
    "b1_opened_at",
  ]

  // Build CSV rows
  const rows: string[][] = []

  for (const pair of pool.pairs) {
    const investorMember = memberByUserId.get(
      `${pair.investorId}_INVESTOR`
    )
    const founderMember = memberByUserId.get(
      `${pair.founderId}_FOUNDER`
    )

    const investorLine = pair.personalizationLines.find(
      (l) => l.side === "INVESTOR"
    )
    const founderLine = pair.personalizationLines.find(
      (l) => l.side === "FOUNDER"
    )

    const a1Email = pair.emails.find((e) => e.step === "A1_MATCH_LIST")
    const b1Email = pair.emails.find((e) => e.step === "B1_MATCH_LIST")

    rows.push([
      pool.id,
      pool.industry,
      pool.status,
      String(pool.isTestPool),
      pair.id,
      String(pair.score),
      String(pair.rank),
      // Investor
      pair.investorId,
      pair.investorName ?? "",
      pair.investorEmail ?? "",
      investorMember?.investorTier ?? "",
      String(investorMember?.stage ?? ""),
      String(investorMember?.engagementScore ?? ""),
      // Founder
      pair.founderId,
      pair.founderName ?? "",
      pair.founderEmail ?? "",
      String(founderMember?.stage ?? ""),
      String(founderMember?.engagementScore ?? ""),
      // Score breakdown
      String(pair.matchScore?.industryScore ?? ""),
      String(pair.matchScore?.locationScore ?? ""),
      String(pair.matchScore?.stageScore ?? ""),
      String(pair.matchScore?.chequeSizeScore ?? ""),
      String(pair.matchScore?.engagementScore ?? ""),
      // Presentation
      String(pair.presentedToInvestor),
      String(pair.presentedToFounder),
      // Selection
      String(pair.investorSelected),
      String(pair.founderSelected),
      pair.crossMatchOutcome ?? "",
      // Personalization
      investorLine?.line ?? "",
      String(investorLine?.approved ?? ""),
      founderLine?.line ?? "",
      String(founderLine?.approved ?? ""),
      // Feedback
      pair.investorFeedback ?? "",
      pair.investorFeedbackPositive != null
        ? String(pair.investorFeedbackPositive)
        : "",
      pair.founderFeedback ?? "",
      pair.founderFeedbackPositive != null
        ? String(pair.founderFeedbackPositive)
        : "",
      pair.feedbackDeliveredAt?.toISOString() ?? "",
      // Outcome
      pair.matchScore?.outcome ?? "",
      pair.matchScore?.outcomeReason ?? "",
      // Email tracking
      a1Email?.sentAt?.toISOString() ?? "",
      a1Email?.openedAt?.toISOString() ?? "",
      b1Email?.sentAt?.toISOString() ?? "",
      b1Email?.openedAt?.toISOString() ?? "",
    ])
  }

  // Build CSV string
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ),
  ]
  const csv = csvLines.join("\n")

  // Return as downloadable CSV
  const filename = `pool_${pool.id}_${pool.industry}_${pool.status.toLowerCase()}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
