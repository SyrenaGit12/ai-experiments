import { NextResponse } from "next/server"
import db from "@/lib/db"
import { runNewJoinerMatching } from "@/services/new-joiners"

/**
 * GET /api/new-joiners
 * List all new joiner matches (for operator review in Control Tower).
 * Groups by user with match details.
 */
export async function GET() {
  try {
    const matches = await db.newJoinerMatch.findMany({
      orderBy: [{ createdAt: "desc" }],
    })

    // Group by userId
    const grouped = new Map<
      string,
      {
        userId: string
        userName: string | null
        userEmail: string | null
        side: string
        matches: typeof matches
      }
    >()

    for (const match of matches) {
      if (!grouped.has(match.userId)) {
        grouped.set(match.userId, {
          userId: match.userId,
          userName: match.userName,
          userEmail: match.userEmail,
          side: match.side,
          matches: [],
        })
      }
      grouped.get(match.userId)!.matches.push(match)
    }

    return NextResponse.json({
      users: Array.from(grouped.values()),
      totalMatches: matches.length,
      totalUsers: grouped.size,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list new joiner matches"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/new-joiners
 * Trigger new joiner matching: finds users who signed up within 7 days
 * and generates 2-3 curated matches for each.
 */
export async function POST() {
  try {
    const result = await runNewJoinerMatching()

    return NextResponse.json({
      summary: result.summary,
      results: result.results,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "New joiner matching failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
