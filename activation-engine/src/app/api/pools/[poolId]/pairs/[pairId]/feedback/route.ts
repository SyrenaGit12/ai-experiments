import { NextResponse } from "next/server"
import { render } from "@react-email/components"
import db from "@/lib/db"
import { resend, EMAIL_FROM } from "@/lib/resend"
import { applyTestMode } from "@/lib/email-test-mode"
import { FeedbackDelivery } from "@/services/email/templates/feedback-delivery"
import type { PoolMemberSide, Prisma } from "@prisma/client"

/**
 * POST /api/pools/[poolId]/pairs/[pairId]/feedback
 * Record feedback for a pair and optionally send a feedback delivery email.
 *
 * Body: {
 *   side: "INVESTOR" | "FOUNDER"   — which side's feedback this is
 *   feedback: string               — the feedback message
 *   positive: boolean              — positive or negative outcome
 *   sendEmail?: boolean            — whether to send a feedback delivery email (default: false)
 * }
 *
 * This endpoint:
 * 1. Stores feedback on the PoolPair (investorFeedback/founderFeedback)
 * 2. Optionally sends a feedback delivery email to the OTHER side
 * 3. Checks if all presented pairs for the member have feedback → advances to stage 3
 * 4. Updates MatchScore.outcome
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ poolId: string; pairId: string }> }
) {
  const { poolId, pairId } = await params
  const body = await request.json()

  const side = body.side as PoolMemberSide
  const feedback = body.feedback as string | undefined
  const positive = body.positive as boolean
  const sendEmail = body.sendEmail === true

  // ── Validate inputs ─────────────────────────────────────
  if (!side || !["INVESTOR", "FOUNDER"].includes(side)) {
    return NextResponse.json(
      { error: "side must be INVESTOR or FOUNDER" },
      { status: 400 }
    )
  }

  if (typeof positive !== "boolean") {
    return NextResponse.json(
      { error: "positive must be a boolean" },
      { status: 400 }
    )
  }

  // ── Load pair + pool ────────────────────────────────────
  const pair = await db.poolPair.findUnique({
    where: { id: pairId },
    include: {
      pool: {
        include: { members: true, pairs: true },
      },
    },
  })

  if (!pair || pair.poolId !== poolId) {
    return NextResponse.json(
      { error: "Pair not found in this pool" },
      { status: 404 }
    )
  }

  const pool = pair.pool

  if (pool.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Cannot record feedback for pool in ${pool.status} status` },
      { status: 400 }
    )
  }

  // ── Store feedback ──────────────────────────────────────
  const feedbackData =
    side === "INVESTOR"
      ? {
          investorFeedback: feedback ?? null,
          investorFeedbackPositive: positive,
        }
      : {
          founderFeedback: feedback ?? null,
          founderFeedbackPositive: positive,
        }

  await db.poolPair.update({
    where: { id: pairId },
    data: {
      ...feedbackData,
      feedbackDeliveredAt: new Date(),
    },
  })

  // ── Optionally send feedback email to the OTHER side ────
  let emailSent = false

  if (sendEmail) {
    // The feedback is about this side's experience → deliver to the OTHER side
    const recipientSide: PoolMemberSide =
      side === "INVESTOR" ? "FOUNDER" : "INVESTOR"
    const recipientUserId =
      recipientSide === "INVESTOR" ? pair.investorId : pair.founderId
    const recipientName =
      recipientSide === "INVESTOR" ? pair.investorName : pair.founderName
    const recipientEmail =
      recipientSide === "INVESTOR" ? pair.investorEmail : pair.founderEmail
    const matchName =
      side === "INVESTOR" ? pair.investorName : pair.founderName

    if (recipientEmail) {
      const firstName = recipientName?.split(" ")[0] ?? "there"

      const html = await render(
        FeedbackDelivery({
          recipientFirstName: firstName,
          matchName: matchName ?? "your match",
          positive,
          feedbackMessage: feedback,
        })
      )

      const subject = positive
        ? `Great news about your Syrena match!`
        : `Update on your Syrena match`

      const testAdjusted = applyTestMode(recipientEmail, subject)

      const emailResult = await resend.emails.send({
        from: EMAIL_FROM,
        to: testAdjusted.to,
        subject: testAdjusted.subject,
        html,
      })

      // Record OutreachEmail
      const step =
        recipientSide === "INVESTOR"
          ? "A4_FEEDBACK" as const
          : "B4_FEEDBACK" as const

      await db.outreachEmail.create({
        data: {
          poolPairId: pairId,
          side: recipientSide,
          step,
          resendEmailId: emailResult.data?.id,
          sentAt: new Date(),
        },
      })

      emailSent = true
    }
  }

  // ── Check if member should advance to stage 3 ──────────
  // The member who GAVE feedback is on `side`
  const feedbackGiverUserId =
    side === "INVESTOR" ? pair.investorId : pair.founderId
  const feedbackGiverMember = pool.members.find(
    (m) => m.userId === feedbackGiverUserId && m.side === side
  )

  let memberAdvanced = false

  if (feedbackGiverMember) {
    // Check all presented pairs for this member — do they all have feedback delivered?
    const memberPresentedPairs = pool.pairs.filter((p) => {
      if (side === "INVESTOR") {
        return p.investorId === feedbackGiverUserId && p.presentedToInvestor
      } else {
        return p.founderId === feedbackGiverUserId && p.presentedToFounder
      }
    })

    // Re-fetch the updated pair for accurate check
    const updatedPairs = await db.poolPair.findMany({
      where: {
        id: { in: memberPresentedPairs.map((p) => p.id) },
      },
    })

    const allHaveFeedback = updatedPairs.every(
      (p) => p.feedbackDeliveredAt !== null
    )

    if (allHaveFeedback && feedbackGiverMember.stage < 3) {
      await db.poolMember.update({
        where: { id: feedbackGiverMember.id },
        data: {
          stage: 3,
          stageCompletedAt: new Date(),
        },
      })
      memberAdvanced = true
    }
  }

  // ── Update MatchScore outcome ───────────────────────────
  const matchScoreOutcome = positive ? "MUTUAL_YES" : "NO_MATCH"
  await db.matchScore.updateMany({
    where: { poolPairId: pairId },
    data: {
      outcome: matchScoreOutcome,
      outcomeReason: feedback ?? undefined,
      outcomeAt: new Date(),
    },
  })

  // ── Log event ───────────────────────────────────────────
  await db.eventLedger.create({
    data: {
      type: "RESPONSE_PARSED",
      actorId: "operator",
      poolId,
      payload: {
        pairId,
        side,
        positive,
        feedback: feedback ?? null,
        emailSent,
        memberAdvanced,
        testMode: process.env.EMAIL_TEST_MODE === "true",
      },
    },
  })

  return NextResponse.json({
    success: true,
    pairId,
    side,
    positive,
    emailSent,
    memberAdvanced,
    memberStage: memberAdvanced ? 3 : feedbackGiverMember?.stage ?? null,
  })
}

/**
 * GET /api/pools/[poolId]/pairs/[pairId]/feedback
 * Get feedback status for a specific pair.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ poolId: string; pairId: string }> }
) {
  const { poolId, pairId } = await params

  const pair = await db.poolPair.findUnique({
    where: { id: pairId },
    select: {
      id: true,
      poolId: true,
      investorId: true,
      founderId: true,
      investorName: true,
      founderName: true,
      investorSelected: true,
      founderSelected: true,
      crossMatchOutcome: true,
      investorFeedback: true,
      investorFeedbackPositive: true,
      founderFeedback: true,
      founderFeedbackPositive: true,
      feedbackDeliveredAt: true,
    },
  })

  if (!pair || pair.poolId !== poolId) {
    return NextResponse.json(
      { error: "Pair not found in this pool" },
      { status: 404 }
    )
  }

  return NextResponse.json(pair)
}
