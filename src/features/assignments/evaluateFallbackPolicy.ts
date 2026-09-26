/**
 * evaluateFallbackPolicy
 *
 * Pure function — takes assignment + commitment + submission data and returns
 * the three independent PRD policy checks plus an overall `qualifies` boolean.
 *
 * Deliberately takes plain objects so it is easy to unit-test without Supabase.
 */

export interface FallbackPolicyInput {
  deadline_at: string | null          // assignment deadline (ISO)
  grace_period_minutes: number | null // assignment grace window
  commitment_received_at: string | null // when SMS commitment was logged
  commitment_file_hash: string | null   // hash sent in commitment
  uploaded_file_hash: string | null     // hash of the uploaded file
  uploaded_at: string | null            // when the file was actually uploaded
}

export interface FallbackPolicyResult {
  /** Commitment was received before the assignment deadline. */
  preDeadlineCommitment: boolean
  preDeadlineCommitmentValue: string   // human-readable computed value shown in the UI

  /** Uploaded file hash matches the committed hash (case-insensitive). */
  fileMatches: boolean
  fileMatchesValue: string             // truncated hash shown in the UI

  /** File was uploaded after the deadline but within the grace window. */
  withinGracePeriod: boolean
  withinGracePeriodValue: string       // formatted upload time + offset label

  /** Overall: all three checks must pass. */
  qualifies: boolean

  /** When qualifies is false, the name of the first failing check. */
  failureReason: string | null
}

export function evaluateFallbackPolicy(input: FallbackPolicyInput): FallbackPolicyResult {
  const {
    deadline_at,
    grace_period_minutes,
    commitment_received_at,
    commitment_file_hash,
    uploaded_file_hash,
    uploaded_at,
  } = input

  // ── Check 1: pre-deadline commitment ─────────────────────────────────────
  let preDeadlineCommitment = false
  let preDeadlineCommitmentValue = '—'

  if (commitment_received_at && deadline_at) {
    const commitMs  = new Date(commitment_received_at).getTime()
    const deadlineMs = new Date(deadline_at).getTime()
    preDeadlineCommitment = commitMs < deadlineMs

    const diffMs   = deadlineMs - commitMs
    const absDays  = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24))
    const fmtTime  = new Date(commitment_received_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
    const offset = absDays === 0
      ? 'On the deadline'
      : preDeadlineCommitment
        ? `${absDays} day${absDays === 1 ? '' : 's'} before deadline`
        : `${absDays} day${absDays === 1 ? '' : 's'} after deadline`

    preDeadlineCommitmentValue = `${fmtTime} (${offset})`
  } else if (commitment_received_at) {
    preDeadlineCommitmentValue = new Date(commitment_received_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  }

  // ── Check 2: file hash matches ────────────────────────────────────────────
  let fileMatches = false
  let fileMatchesValue = '—'

  if (uploaded_file_hash && commitment_file_hash) {
    fileMatches = uploaded_file_hash.toLowerCase() === commitment_file_hash.toLowerCase()
    // Show truncated hash with suffix
    const truncated = uploaded_file_hash.length > 12
      ? uploaded_file_hash.slice(0, 12) + '…' + uploaded_file_hash.slice(-4)
      : uploaded_file_hash
    fileMatchesValue = `SHA-256 hash ${truncated}`
  } else if (uploaded_file_hash) {
    fileMatchesValue = 'No commitment hash to compare'
  } else {
    fileMatchesValue = 'File not yet uploaded'
  }

  // ── Check 3: uploaded within grace period ────────────────────────────────
  let withinGracePeriod = false
  let withinGracePeriodValue = '—'

  if (uploaded_at && deadline_at) {
    const uploadMs    = new Date(uploaded_at).getTime()
    const deadlineMs  = new Date(deadline_at).getTime()
    const gracePeriodMs = (grace_period_minutes ?? 0) * 60 * 1000
    const graceEndMs  = deadlineMs + gracePeriodMs

    // Uploaded after deadline AND before grace end
    withinGracePeriod = uploadMs > deadlineMs && uploadMs <= graceEndMs

    const diffFromDeadlineMs = uploadMs - deadlineMs
    const absDays = Math.round(Math.abs(diffFromDeadlineMs) / (1000 * 60 * 60 * 24))
    const fmtTime = new Date(uploaded_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
    const offset = absDays === 0
      ? 'On the deadline'
      : diffFromDeadlineMs < 0
        ? `${absDays} day${absDays === 1 ? '' : 's'} before deadline`
        : `${absDays} day${absDays === 1 ? '' : 's'} after deadline`

    withinGracePeriodValue = `${fmtTime} (${offset})`
  } else if (uploaded_at) {
    withinGracePeriodValue = new Date(uploaded_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  }

  // ── Overall ───────────────────────────────────────────────────────────────
  const qualifies = preDeadlineCommitment && fileMatches && withinGracePeriod

  let failureReason: string | null = null
  if (!qualifies) {
    if (!preDeadlineCommitment) failureReason = 'Commitment was not received before the deadline'
    else if (!fileMatches) failureReason = 'Uploaded file hash does not match the commitment'
    else if (!withinGracePeriod) failureReason = 'File was not uploaded within the grace period'
  }

  return {
    preDeadlineCommitment,
    preDeadlineCommitmentValue,
    fileMatches,
    fileMatchesValue,
    withinGracePeriod,
    withinGracePeriodValue,
    qualifies,
    failureReason,
  }
}
