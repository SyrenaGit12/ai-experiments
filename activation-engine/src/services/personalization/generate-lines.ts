import OpenAI from "openai"
import type { PersonalizationRequest, PersonalizationResult } from "@/lib/types"

/**
 * Humanize enum-style strings for LLM prompts.
 * "AI_MACHINE_LEARNING" → "AI / Machine Learning"
 */
function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/ And /g, " & ")
    .replace(/ Of /g, " of ")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSaas\b/g, "SaaS")
    .replace(/\bIot\b/g, "IoT")
    .replace(/\bVc\b/g, "VC")
    .replace(/\bPe\b/g, "PE")
}

function humanizeList(values: string[]): string {
  return values.map(humanize).join(", ")
}

/**
 * Build the LLM prompt for a single investor-founder pair.
 */
function buildPrompt(req: PersonalizationRequest): string {
  const inv = req.investorProfile
  const fou = req.founderProfile

  return `You are writing brief, specific reasons why an investor and founder should meet on a curated matching platform called Syrena.

INVESTOR PROFILE:
- Name: ${inv.name}
- Type: ${inv.investorType ? humanize(inv.investorType) : "Investor"}
- Industries: ${humanizeList(inv.industries)}
- Stages: ${humanizeList(inv.fundingStages)}
${inv.bio ? `- Bio: ${inv.bio}` : ""}

FOUNDER PROFILE:
- Name: ${fou.name}
${fou.companyName ? `- Company: ${fou.companyName}` : ""}
- Industries: ${humanizeList(fou.industries)}
${fou.fundingStage ? `- Stage: ${humanize(fou.fundingStage)}` : ""}
${fou.bio ? `- Bio: ${fou.bio}` : ""}

Write TWO personalization lines (max 120 characters each):

1. FOR THE INVESTOR (why this founder is worth meeting): Focus on what makes this founder's company or traction interesting for the investor. Reference specific overlaps like industry, stage, or the founder's unique angle.

2. FOR THE FOUNDER (why this investor is worth meeting): Focus on what the investor brings — expertise, portfolio, stage fit, or sector knowledge that would be valuable.

Rules:
- Be specific and reference actual profile details
- Don't use generic phrases like "great opportunity" or "perfect match"
- Write in third person (e.g., "Builds AI solutions for..." not "You build...")
- Keep each line under 120 characters
- Don't include the person's name in their own line

Respond in this exact JSON format:
{"investorLine": "...", "founderLine": "..."}`
}

/**
 * Generate personalization lines for a single pair using OpenAI.
 */
export async function generateLineForPair(
  client: OpenAI,
  request: PersonalizationRequest
): Promise<PersonalizationResult> {
  const prompt = buildPrompt(request)

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a concise writer for a curated investor-founder matching platform. You write brief, specific reasons why two people should meet. Always respond in valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 300,
    response_format: { type: "json_object" },
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error("Empty response from OpenAI")
  }

  const parsed = JSON.parse(content) as {
    investorLine?: string
    founderLine?: string
  }

  if (!parsed.investorLine || !parsed.founderLine) {
    throw new Error(
      `Invalid LLM response — missing fields: ${JSON.stringify(parsed)}`
    )
  }

  // Enforce 120-char limit
  return {
    investorLine: parsed.investorLine.slice(0, 120),
    founderLine: parsed.founderLine.slice(0, 120),
  }
}

/**
 * Generate lines for multiple pairs in parallel using Promise.allSettled.
 * Failures are logged but don't block other pairs.
 */
export async function generateLinesForPairs(
  client: OpenAI,
  requests: (PersonalizationRequest & { pairId: string })[]
): Promise<
  {
    pairId: string
    result?: PersonalizationResult
    error?: string
  }[]
> {
  const results = await Promise.allSettled(
    requests.map(async (req) => {
      const result = await generateLineForPair(client, req)
      return { pairId: req.pairId, result }
    })
  )

  return results.map((settled, i) => {
    if (settled.status === "fulfilled") {
      return settled.value
    }
    const errorMsg =
      settled.reason instanceof Error
        ? settled.reason.message
        : "Unknown error"
    console.error(
      `[Personalization] Failed for pair ${requests[i].pairId}: ${errorMsg}`
    )
    return { pairId: requests[i].pairId, error: errorMsg }
  })
}
