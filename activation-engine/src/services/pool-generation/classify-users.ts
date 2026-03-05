import db from "@/lib/db"
import { sql } from "@/lib/syrena"
import { ACTIVATION_THRESHOLDS } from "@/lib/constants"
import type { ActivationStatus, PoolMemberSide } from "@prisma/client"

/**
 * Step 1: Classify users into activation statuses.
 * Reads user data from Syrena, cross-references with sandbox UserActivationStatus,
 * and upserts the current status.
 */
export async function classifyUsers() {
  // Get all approved users from Syrena
  const syrenaUsers = await sql`
    SELECT u.id, u.role, u."lastLogin", u."createdAt"
    FROM "User" u
    WHERE u.status IN ('APPROVED', 'PROFILE_COMPLETED')
      AND u.role IN ('FOUNDER', 'INVESTOR')
  `

  // Get existing activation statuses from sandbox
  const existingStatuses = await db.userActivationStatus.findMany()
  const statusMap = new Map(existingStatuses.map((s) => [s.userId, s]))

  // Get users currently in active pools
  const activePoolMembers = await db.poolMember.findMany({
    where: {
      pool: { status: { in: ["APPROVED", "ACTIVE"] } },
    },
    select: { userId: true },
  })
  const inActivePool = new Set(activePoolMembers.map((m) => m.userId))

  const upserts: {
    userId: string
    side: PoolMemberSide
    status: ActivationStatus
  }[] = []

  for (const user of syrenaUsers) {
    const existing = statusMap.get(user.id)
    const side: PoolMemberSide =
      user.role === "INVESTOR" ? "INVESTOR" : "FOUNDER"

    let status: ActivationStatus = "UNACTIVATED"

    if (inActivePool.has(user.id)) {
      status = "IN_POOL"
    } else if (existing) {
      if (
        existing.introCount >= ACTIVATION_THRESHOLDS.STRONG_ACTIVATED_INTROS
      ) {
        status = "STRONG_ACTIVATED"
      } else if (existing.introCount > 0) {
        // Check if at risk (activated but inactive for 30+ days)
        const lastActivity = existing.lastPoolAt ?? existing.activatedAt
        if (lastActivity) {
          const daysSince = Math.floor(
            (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSince >= ACTIVATION_THRESHOLDS.AT_RISK_INACTIVE_DAYS) {
            status = "AT_RISK"
          } else {
            status = "ACTIVATED"
          }
        } else {
          status = "ACTIVATED"
        }
      } else if (existing.poolCount > 0) {
        // Was in a pool but no intros yet
        status = "UNACTIVATED"
      }
    }

    upserts.push({ userId: user.id, side, status })
  }

  // Batch upsert
  const results = await Promise.all(
    upserts.map((u) =>
      db.userActivationStatus.upsert({
        where: { userId: u.userId },
        create: {
          userId: u.userId,
          side: u.side,
          status: u.status,
        },
        update: {
          status: u.status,
        },
      })
    )
  )

  return {
    total: results.length,
    byStatus: results.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    ),
  }
}
