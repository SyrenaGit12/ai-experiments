import { NextResponse } from "next/server"
import { render } from "@react-email/components"
import db from "@/lib/db"
import { resend, EMAIL_FROM, BATCH_SIZE, BATCH_DELAY_MS } from "@/lib/resend"
import { A1InvestorMatchList } from "@/services/email/templates/a1-investor-match-list"
import { B1FounderMatchList } from "@/services/email/templates/b1-founder-match-list"
import type { PoolMemberSide, Prisma } from "@prisma/client"

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
        include: { matchScore: true },
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

  const step = side === "INVESTOR" ? "A1_MATCH_LIST" : "B1_MATCH_LIST"

  // Group pairs by the target user (investor for A1, founder for B1)
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
    const memberPairs = pool.pairs.filter(
      (p) =>
        side === "INVESTOR"
          ? p.investorId === member.userId
          : p.founderId === member.userId
    )

    if (memberPairs.length === 0) continue

    const firstName = member.displayName?.split(" ")[0] ?? "there"

    const subject =
      side === "INVESTOR"
        ? `Your curated founder matches in ${pool.industry.replace(/_/g, " ")}`
        : `Investors interested in your space — ${pool.industry.replace(/_/g, " ")}`

    let html: string
    if (side === "INVESTOR") {
      html = await render(
        A1InvestorMatchList({
          investorFirstName: firstName,
          industry: pool.industry,
          founders: memberPairs.map((p, i) => ({
            index: i + 1,
            name: p.founderName ?? "Unknown",
            company: null,
            bio: null,
            industry: pool.industry,
            fundingStage: null,
          })),
        })
      )
    } else {
      html = await render(
        B1FounderMatchList({
          founderFirstName: firstName,
          industry: pool.industry,
          investors: memberPairs.map((p, i) => ({
            index: i + 1,
            name: p.investorName ?? "Unknown",
            firm: null,
            investorType: null,
            fundingStages: [],
            bio: null,
          })),
        })
      )
    }

    emails.push({
      from: EMAIL_FROM,
      to: member.email ?? "",
      subject,
      html,
      memberId: member.id,
      pairIds: memberPairs.map((p) => p.id),
    })
  }

  // Send in batches
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

        // Create one OutreachEmail per pair
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

  // Activate pool if first email send
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

  // Log email sent events
  await db.eventLedger.create({
    data: {
      type: "EMAIL_SENT",
      actorId: "operator",
      poolId,
      payload: { side, step, count: sentCount },
    },
  })

  return NextResponse.json({
    sent: sentCount,
    side,
    step,
    poolStatus: pool.status === "APPROVED" ? "ACTIVE" : pool.status,
  })
}
