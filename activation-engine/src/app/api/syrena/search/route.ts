import { NextResponse } from "next/server"
import { sql } from "@/lib/syrena"

/**
 * GET /api/syrena/search
 * Search Syrena users (investors/founders) for the Match Finder.
 * Query params: side (INVESTOR|FOUNDER), industry, search, limit
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const side = url.searchParams.get("side") // INVESTOR or FOUNDER
  const industry = url.searchParams.get("industry")
  const search = url.searchParams.get("search") ?? ""
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30"), 100)

  if (side === "INVESTOR") {
    const results = await sql`
      SELECT
        i.id as "investorId",
        i."userId",
        i."investorType",
        i.industries,
        i."fundingStages",
        i."preferredLocations",
        i."investmentActivity",
        i.bio,
        i."linkedinUrl",
        u.email,
        u."firstName",
        u."lastName",
        u."lastLogin",
        u.status as "userStatus"
      FROM investors i
      JOIN users u ON i."userId" = u.id
      WHERE u.status IN ('APPROVED', 'PROFILE_COMPLETED')
        ${industry ? sql`AND ${industry} = ANY(i.industries)` : sql``}
        ${search ? sql`AND (
          u."firstName" ILIKE ${'%' + search + '%'}
          OR u."lastName" ILIKE ${'%' + search + '%'}
          OR u.email ILIKE ${'%' + search + '%'}
          OR i.bio ILIKE ${'%' + search + '%'}
        )` : sql``}
      ORDER BY u."lastLogin" DESC NULLS LAST
      LIMIT ${limit}
    `
    return NextResponse.json({ results, side: "INVESTOR" })
  }

  if (side === "FOUNDER") {
    const results = await sql`
      SELECT
        f.id as "founderId",
        f."userId",
        f.industries,
        f."fundingStage",
        f."chequeSizesAccepted",
        f.bio,
        f."companyName",
        f."targetRaiseAmount",
        f."websiteUrl",
        f."linkedinUrl",
        f."preferredLocations",
        u.email,
        u."firstName",
        u."lastName",
        u."lastLogin",
        u.status as "userStatus"
      FROM founders f
      JOIN users u ON f."userId" = u.id
      WHERE u.status IN ('APPROVED', 'PROFILE_COMPLETED')
        ${industry ? sql`AND ${industry} = ANY(f.industries)` : sql``}
        ${search ? sql`AND (
          u."firstName" ILIKE ${'%' + search + '%'}
          OR u."lastName" ILIKE ${'%' + search + '%'}
          OR u.email ILIKE ${'%' + search + '%'}
          OR f."companyName" ILIKE ${'%' + search + '%'}
          OR f.bio ILIKE ${'%' + search + '%'}
        )` : sql``}
      ORDER BY u."lastLogin" DESC NULLS LAST
      LIMIT ${limit}
    `
    return NextResponse.json({ results, side: "FOUNDER" })
  }

  return NextResponse.json({ error: "side param required (INVESTOR or FOUNDER)" }, { status: 400 })
}
