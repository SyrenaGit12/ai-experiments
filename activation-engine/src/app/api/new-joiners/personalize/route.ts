import { NextResponse } from "next/server"
import { generatePersonalizationForNewJoiners } from "@/services/personalization"

/**
 * POST /api/new-joiners/personalize
 * Generate AI personalization lines for new joiner matches.
 *
 * Body (optional):
 * - { matchIds: string[] } — Generate for specific matches only
 * - {} or no body — Generate for all matches missing whyRelevant
 *
 * Requires OPENAI_API_KEY in environment.
 */
export async function POST(request: Request) {
  try {
    let matchIds: string[] | undefined

    try {
      const body = await request.json()
      if (Array.isArray(body.matchIds) && body.matchIds.length > 0) {
        matchIds = body.matchIds
      }
    } catch {
      // No body or invalid JSON — generate for all
    }

    const result = await generatePersonalizationForNewJoiners(matchIds)

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate new joiner personalization"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
