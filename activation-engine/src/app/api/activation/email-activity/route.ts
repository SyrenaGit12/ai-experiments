import { NextResponse } from "next/server"
import db from "@/lib/db"

/**
 * GET /api/activation/email-activity
 * Returns email activity across the activation pipeline:
 *  - Summary stats (emails sent, intros, feedback)
 *  - Recent match-list sends
 *  - Recent intro sends
 *  - Recent feedback deliveries
 *  - Records waiting for email action
 */
export async function GET() {
  const [
    // Summary counts
    totalMatchesSent,
    totalResponded,
    totalCounterpartyAsked,
    totalCounterpartyResponded,
    totalMatchEmailsSent,
    totalIntrosSent,
    totalFeedbackDelivered,

    // Recent match-list sends (last 50)
    recentMatchSends,

    // Recent intro sends (last 30)
    recentIntros,

    // Recent feedback deliveries (last 30)
    recentFeedback,

    // Records needing email action (matches sent but no response)
    pendingResponses,
  ] = await Promise.all([
    db.activationRecord.count({ where: { matchesSentAt: { not: null } } }),
    db.activationRecord.count({ where: { respondedAt: { not: null } } }),
    db.activationRecord.count({ where: { counterpartyAskedAt: { not: null } } }),
    db.activationRecord.count({ where: { counterpartyRespondedAt: { not: null } } }),
    db.activationMatch.count({ where: { emailSentToMatch: true } }),
    db.activationMatch.count({ where: { introSent: true } }),
    db.activationMatch.count({ where: { feedbackDelivered: true } }),

    // Recent match list sends
    db.activationRecord.findMany({
      where: { matchesSentAt: { not: null } },
      select: {
        id: true,
        name: true,
        email: true,
        side: true,
        stage: true,
        owner: true,
        matchesSentAt: true,
        matchesSentBy: true,
        respondedAt: true,
        _count: { select: { matches: true } },
      },
      orderBy: { matchesSentAt: "desc" },
      take: 50,
    }),

    // Recent intros
    db.activationMatch.findMany({
      where: { introSent: true },
      select: {
        id: true,
        matchName: true,
        matchEmail: true,
        introSentAt: true,
        activationRecord: {
          select: {
            id: true,
            name: true,
            email: true,
            side: true,
          },
        },
      },
      orderBy: { introSentAt: "desc" },
      take: 30,
    }),

    // Recent feedback deliveries
    db.activationMatch.findMany({
      where: { feedbackDelivered: true },
      select: {
        id: true,
        matchName: true,
        feedbackDeliveredAt: true,
        counterpartyResponse: true,
        activationRecord: {
          select: {
            id: true,
            name: true,
            side: true,
          },
        },
      },
      orderBy: { feedbackDeliveredAt: "desc" },
      take: 30,
    }),

    // Pending: matches sent but no response yet
    db.activationRecord.findMany({
      where: {
        matchesSentAt: { not: null },
        respondedAt: null,
        stage: "S1_MATCHES_SENT",
      },
      select: {
        id: true,
        name: true,
        email: true,
        side: true,
        owner: true,
        matchesSentAt: true,
        slaDeadline: true,
      },
      orderBy: { matchesSentAt: "asc" },
      take: 30,
    }),
  ])

  // Build a unified timeline from all activities
  type TimelineItem = {
    type: "matches_sent" | "intro_sent" | "feedback_delivered" | "response_received"
    timestamp: string
    recordId: string
    recordName: string
    side: string
    detail: string
  }

  const timeline: TimelineItem[] = []

  for (const r of recentMatchSends) {
    timeline.push({
      type: "matches_sent",
      timestamp: r.matchesSentAt!.toISOString(),
      recordId: r.id,
      recordName: r.name,
      side: r.side,
      detail: `${r._count.matches} matches sent${r.matchesSentBy ? ` by ${r.matchesSentBy}` : ""}${r.respondedAt ? " · responded" : ""}`,
    })
  }

  for (const m of recentIntros) {
    timeline.push({
      type: "intro_sent",
      timestamp: m.introSentAt?.toISOString() ?? new Date().toISOString(),
      recordId: m.activationRecord.id,
      recordName: m.activationRecord.name,
      side: m.activationRecord.side,
      detail: `Intro sent → ${m.matchName}`,
    })
  }

  for (const f of recentFeedback) {
    timeline.push({
      type: "feedback_delivered",
      timestamp: f.feedbackDeliveredAt?.toISOString() ?? new Date().toISOString(),
      recordId: f.activationRecord.id,
      recordName: f.activationRecord.name,
      side: f.activationRecord.side,
      detail: `Feedback delivered about ${f.matchName}${f.counterpartyResponse ? ` (${f.counterpartyResponse})` : ""}`,
    })
  }

  // Sort by most recent first
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({
    summary: {
      matchesSent: totalMatchesSent,
      responded: totalResponded,
      responseRate: totalMatchesSent > 0 ? Math.round((totalResponded / totalMatchesSent) * 100) : 0,
      counterpartyAsked: totalCounterpartyAsked,
      counterpartyResponded: totalCounterpartyResponded,
      matchEmailsSent: totalMatchEmailsSent,
      introsSent: totalIntrosSent,
      feedbackDelivered: totalFeedbackDelivered,
    },
    timeline: timeline.slice(0, 50),
    pendingResponses,
  })
}
