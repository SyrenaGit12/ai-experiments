import { NextResponse } from "next/server"
import db from "@/lib/db"
import { applyTestMode, isTestMode } from "@/lib/email-test-mode"

/**
 * POST /api/new-joiners/[matchId]/send
 * Send the welcome email for an approved new joiner match.
 *
 * Respects test mode: if EMAIL_TEST_MODE=true, email goes to aziz@syrena.co.uk
 * with the real recipient in the subject line.
 *
 * Note: Actual email sending via Resend will be implemented in Step 7 (email templates).
 * For now, this route marks the match as sent and records the timestamp.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params
    const match = await db.newJoinerMatch.findUnique({
      where: { id: matchId },
    })

    if (!match) {
      return NextResponse.json(
        { error: "Match not found" },
        { status: 404 }
      )
    }

    if (!match.approved) {
      return NextResponse.json(
        { error: "Match must be approved before sending" },
        { status: 400 }
      )
    }

    if (match.emailSentAt) {
      return NextResponse.json(
        { error: "Email already sent for this match" },
        { status: 400 }
      )
    }

    // Determine recipient (test mode applies redirect)
    const recipientEmail = match.userEmail ?? ""
    const subject = `Welcome to Syrena — We found a match for you!`
    const { to: finalTo, subject: finalSubject } = applyTestMode(
      recipientEmail,
      subject
    )

    // TODO: Step 7 — Render new-joiner-welcome template and send via Resend
    // For now, we mark the match as sent and log the email details
    console.log(
      `[New Joiner Email] To: ${finalTo}, Subject: ${finalSubject}, ` +
        `Match: ${match.matchName}, Test Mode: ${isTestMode()}`
    )

    // Mark as sent
    const updated = await db.newJoinerMatch.update({
      where: { id: matchId },
      data: {
        emailSentAt: new Date(),
        stage: 1, // Advance to "Presented"
      },
    })

    return NextResponse.json({
      match: updated,
      emailDetails: {
        to: finalTo,
        subject: finalSubject,
        testMode: isTestMode(),
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
