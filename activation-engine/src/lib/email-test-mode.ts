/**
 * Test Mode: When EMAIL_TEST_MODE=true, all outgoing emails redirect to aziz@syrena.co.uk.
 * The real recipient is preserved in the subject line for debugging.
 */

const TEST_RECIPIENT = "aziz@syrena.co.uk"

export function isTestMode(): boolean {
  return process.env.EMAIL_TEST_MODE === "true"
}

/**
 * In test mode: replaces the real recipient with aziz@syrena.co.uk
 * and prepends the real recipient to the subject line for debugging.
 */
export function applyTestMode(
  to: string,
  subject: string
): { to: string; subject: string } {
  if (!isTestMode()) return { to, subject }
  return {
    to: TEST_RECIPIENT,
    subject: `[TEST → ${to}] ${subject}`,
  }
}

/**
 * Apply test mode to a batch of emails.
 */
export function applyTestModeBatch(
  emails: { to: string; subject: string }[]
): { to: string; subject: string }[] {
  if (!isTestMode()) return emails
  return emails.map((e) => applyTestMode(e.to, e.subject))
}
