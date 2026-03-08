import db from "@/lib/db"
import { STAGE_LABELS_FULL } from "@/lib/constants"
import type { Prisma } from "@prisma/client"

interface LogOptions {
  activationRecordId: string
  action: string
  actor?: string | null
  detail?: string
  meta?: Record<string, unknown>
}

/**
 * Create an activity log entry for an activation record.
 * Non-blocking — errors are logged but don't interrupt the caller.
 */
export async function logActivity(opts: LogOptions): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        activationRecordId: opts.activationRecordId,
        action: opts.action,
        actor: opts.actor ?? null,
        detail: opts.detail ?? null,
        meta: (opts.meta as Prisma.InputJsonValue) ?? undefined,
      },
    })
  } catch (err) {
    console.error("[activity-log] Failed to log activity:", err)
  }
}

/**
 * Log a stage change with human-readable description.
 */
export async function logStageChange(
  activationRecordId: string,
  fromStage: string,
  toStage: string,
  actor?: string | null
): Promise<void> {
  const fromLabel = STAGE_LABELS_FULL[fromStage] ?? fromStage
  const toLabel = STAGE_LABELS_FULL[toStage] ?? toStage
  await logActivity({
    activationRecordId,
    action: "stage_changed",
    actor,
    detail: `Stage changed from "${fromLabel}" to "${toLabel}"`,
    meta: { from: fromStage, to: toStage },
  })
}

/**
 * Log an owner assignment change.
 */
export async function logOwnerChange(
  activationRecordId: string,
  fromOwner: string | null,
  toOwner: string | null,
  actor?: string | null
): Promise<void> {
  const detail = toOwner
    ? fromOwner
      ? `Owner changed from ${fromOwner} to ${toOwner}`
      : `Owner set to ${toOwner}`
    : `Owner removed (was ${fromOwner})`
  await logActivity({
    activationRecordId,
    action: "owner_changed",
    actor,
    detail,
    meta: { from: fromOwner, to: toOwner },
  })
}

/**
 * Log a notes update.
 */
export async function logNotesUpdate(
  activationRecordId: string,
  actor?: string | null
): Promise<void> {
  await logActivity({
    activationRecordId,
    action: "notes_updated",
    actor,
    detail: "Notes updated",
  })
}

/**
 * Log a match-related action (selected, intro sent, feedback delivered, etc.)
 */
export async function logMatchAction(
  activationRecordId: string,
  action: string,
  matchName: string,
  detail: string,
  actor?: string | null,
  meta?: Record<string, unknown>
): Promise<void> {
  await logActivity({
    activationRecordId,
    action,
    actor,
    detail,
    meta: { matchName, ...meta },
  })
}
