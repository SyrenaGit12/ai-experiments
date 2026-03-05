import { NextResponse } from "next/server"
import { render } from "@react-email/components"
import db from "@/lib/db"
import { sql } from "@/lib/syrena"
import { resend, EMAIL_FROM, BATCH_SIZE, BATCH_DELAY_MS } from "@/lib/resend"
import { applyTestMode } from "@/lib/email-test-mode"
import { A1InvestorMatchList } from "@/services/email/templates/a1-investor-match-list"
import { B1FounderMatchList } from "@/services/email/templates/b1-founder-match-list"
import type { PoolMemberSide, Prisma } from "@prisma/client"

/**
 * POST /api/pools/[poolId]/trigger-emails
 * Send A1 (investor) or B1 (founder) match list emails.
 *
 * Body: { side: "INVESTOR" | "FOUNDER" }
 *
 * Gates:
 * - Pool must be APPROVED or ACTIVE
 * - Only sends for presented pairs (presentedToInvestor / presentedToFounder)
 * - All presented pairs must have approved PersonalizationLine before sending
 * - Test mode: redirects all emails to aziz@syrena.co.uk
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const { poolId } = await params
  const body = await request.json()
  const side = body.side as PoolMemberSide

  if (!side || !["INVESTOR", "FOUNDER"].includes(side)) {
    return NextResponse.json(
      { error: "side must be INVESTOR or FOUNDER" },
      { status: 400 }
    )
  }

  const pool = await db.pool.findUnique({
    where: { id: poolId },
    include: {
      members: true,
      pairs: {
        include: {
          matchScore: true,
          personalizationLines: true,
        },
      },
    },
  })

  if (!pool) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 })
  }

  if (pool.status !== "APPROVED" && pool.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Cannot send emails for pool in ${pool.status} status` },
      { status: 400 }
    )
  }

  // ── Presented-only filter ─────────────────────────────────────
  // Only include pairs that have been marked as presented to this side
  const presentedPairs = pool.pairs.filter((p) =>
    side === "INVESTOR" ? p.presentedToInvestor : p.presentedToFounder
  )

  if (presentedPairs.length === 0) {
    return NextResponse.json(
      { error: "No pairs have been presented to this side. Generate the pool first." },
      { status: 400 }
    )
  }

  // ── Personalization gate ──────────────────────────────────────
  // Every presented pair must have an approved line for this side
  const pairsWithoutApprovedLine = presentedPairs.filter((pair) => {
    const approvedLine = pair.personalizationLines.find(
      (line) => line.side === side && line.approved
    )
    return !approvedLine
  })

  if (pairsWithoutApprovedLine.length > 0) {
    return NextResponse.json(
      {
        error: `${pairsWithoutApprovedLine.length} presented pair(s) lack approved personalization lines. Approve all lines before sending.`,
        missingPairIds: pairsWithoutApprovedLine.map((p) => p.id),
      },
      { status: 400 }
    )
  }

  // ── Fetch Syrena profiles for rich email content ──────────────
  // Collect all user IDs we need profiles for
  const founderUserIds = [...new Set(presentedPairs.map((p) => p.founderId))]
  const investorUserIds = [...new Set(presentedPairs.map((p) => p.investorId))]

  // Fetch founder profiles from Syrena
  const founderProfiles = new Map<
    string,
    { bio: string | null; companyName: string | null; fundingStage: string | null }
  >()
  if (founderUserIds.length > 0) {
    const founders = await sql`
      SELECT f."userId", f.bio, f."companyName", f."fundingStage"
      FROM founders f
      WHERE f."userId" = ANY(${founderUserIds})
    `
    for (const f of founders) {
      founderProfiles.set(f.userId, {
        bio: f.bio,
        companyName: f.companyName,
        fundingStage: f.fundingStage,
      })
    }
  }

  // Fetch investor profiles from Syrena
  const investorProfiles = new Map<
    string,
    {
      bio: string | null
      investorType: string | null
      fundingStages: string[]
      firm: string | null
    }
  >()
  if (investorUserIds.length > 0) {
    const investors = await sql`
      SELECT i."userId", i.bio, i."investorType", i."fundingStages", i."firm"
      FROM investors i
      WHERE i."userId" = ANY(${investorUserIds})
    `
    for (const inv of investors) {
      investorProfiles.set(inv.userId, {
        bio: inv.bio,
        investorType: inv.investorType,
        fundingStages: Array.isArray(inv.fundingStages) ? inv.fundingStages : [],
        firm: inv.firm,
      })
    }
  }

  // ── Build emails ──────────────────────────────────────────────
  const step = side === "INVESTOR" ? "A1_MATCH_LIST" : "B1_MATCH_LIST"
  const targetMembers = pool.members.filter((m) => m.side === side)

  const emails: {
    from: string
    to: string
    subject: string
    html: string
    memberId: string
    pairIds: string[]
  }[] = []

  for (const member of targetMembers) {
    // Only include presented pairs for this member
    const memberPairs = presentedPairs.filter((p) =>
      side === "INVESTOR"
        ? p.investorId === member.userId
        : p.founderId === member.userId
    )

    if (memberPairs.length === 0) continue

    const firstName = member.displayName?.split(" ")[0] ?? "there"

    let subject =
      side === "INVESTOR"
        ? `Your curated founder matches in ${pool.industry.replace(/_/g, " ")}`
        : `Investors interested in your space — ${pool.industry.replace(/_/g, " ")}`

    let html: string
    if (side === "INVESTOR") {
      // Build founder match cards with Syrena profile data + personalization
      const founderCards = memberPairs.map((p, i) => {
        const profile = founderProfiles.get(p.founderId)
        const approvedLine = p.personalizationLines.find(
          (l) => l.side === "INVESTOR" && l.approved
        )
        return {
          index: i + 1,
          name: p.founderName ?? "Unknown",
          company: profile?.companyName ?? null,
          bio: profile?.bio ?? null,
          industry: pool.industry,
          fundingStage: profile?.fundingStage ?? null,
          whyRelevant: approvedLine?.line ?? null,
        }
      })

      html = await render(
        A1InvestorMatchList({
          investorFirstName: firstName,
          industry: pool.industry,
          founders: founderCards,
        })
      )
    } else {
      // Build investor match cards with Syrena profile data + personalization
      const investorCards = memberPairs.map((p, i) => {
        const profile = investorProfiles.get(p.investorId)
        const approvedLine = p.personalizationLines.find(
          (l) => l.side === "FOUNDER" && l.approved
        )
        return {
          index: i + 1,
          name: p.investorName ?? "Unknown",
          firm: profile?.firm ?? null,
          investorType: profile?.investorType ?? null,
          fundingStages: profile?.fundingStages ?? [],
          bio: profile?.bio ?? null,
          whyRelevant: approvedLine?.line ?? null,
        }
      })

      html = await render(
        B1FounderMatchList({
          founderFirstName: firstName,
          industry: pool.industry,
          investors: investorCards,
        })
      )
    }

    // ── Apply test mode ───────────────────────────────────────
    const recipientEmail = member.email ?? ""
    const testAdjusted = applyTestMode(recipientEmail, subject)

    emails.push({
      from: EMAIL_FROM,
      to: testAdjusted.to,
      subject: testAdjusted.subject,
      html,
      memberId: member.id,
      pairIds: memberPairs.map((p) => p.id),
    })
  }

  if (emails.length === 0) {
    return NextResponse.json(
      { error: "No emails to send — no members have presented matches" },
      { status: 400 }
    )
  }

  // ── Send in batches ───────────────────────────────────────────
  let sentCount = 0
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)

    const batchResult = await resend.batch.send(
      batch.map((e) => ({
        from: e.from,
        to: e.to,
        subject: e.subject,
        html: e.html,
      }))
    )

    // Create OutreachEmail records
    if (batchResult.data) {
      for (let j = 0; j < batch.length; j++) {
        const email = batch[j]
        const resendData = batchResult.data.data[j]

        for (const pairId of email.pairIds) {
          await db.outreachEmail.create({
            data: {
              poolPairId: pairId,
              side,
              step,
              resendEmailId: resendData?.id,
              sentAt: new Date(),
            },
          })
        }
      }
    }

    sentCount += batch.length

    // Delay between batches
    if (i + BATCH_SIZE < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  // ── Activate pool if first email send ─────────────────────────
  if (pool.status === "APPROVED") {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.pool.update({
        where: { id: poolId },
        data: { status: "ACTIVE", activatedAt: new Date() },
      })
      await tx.eventLedger.create({
        data: {
          type: "POOL_ACTIVATED",
          actorId: "operator",
          poolId,
          payload: { side, emailsSent: sentCount },
        },
      })
    })
  }

  // ── Log email sent event ──────────────────────────────────────
  await db.eventLedger.create({
    data: {
      type: "EMAIL_SENT",
      actorId: "operator",
      poolId,
      payload: {
        side,
        step,
        count: sentCount,
        testMode: process.env.EMAIL_TEST_MODE === "true",
      },
    },
  })

  return NextResponse.json({
    sent: sentCount,
    side,
    step,
    poolStatus: pool.status === "APPROVED" ? "ACTIVE" : pool.status,
    testMode: process.env.EMAIL_TEST_MODE === "true",
  })
}
