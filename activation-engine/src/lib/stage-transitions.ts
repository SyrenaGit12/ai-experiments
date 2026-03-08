/**
 * Shared stage transition logic.
 * Applies timestamp side-effects when an activation record changes stage.
 *
 * Used by both the single-record PATCH and the bulk set_stage action.
 */

const SLA_HOURS = 48

/**
 * Given a target stage, returns the additional timestamp fields that
 * should be set alongside `{ stage: newStage }`.
 */
export function getStageTransitionFields(
  newStage: string,
  actor?: string | null
): Record<string, unknown> {
  const fields: Record<string, unknown> = {}

  switch (newStage) {
    case "S1_MATCHES_SENT":
      fields.matchesSentAt = new Date()
      fields.matchesSentBy = actor ?? null
      fields.slaDeadline = new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000)
      break
    case "S2_USER_RESPONDED":
      fields.respondedAt = new Date()
      break
    case "S3_COUNTERPARTY_ASKED":
      fields.counterpartyAskedAt = new Date()
      fields.slaDeadline = new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000)
      break
    case "S3_FEEDBACK_RECEIVED":
      fields.counterpartyRespondedAt = new Date()
      break
    case "ACTIVATED":
      fields.activatedAt = new Date()
      fields.slaDeadline = null
      break
    case "STALLED":
    case "DECLINED":
      fields.slaDeadline = null
      break
  }

  return fields
}
