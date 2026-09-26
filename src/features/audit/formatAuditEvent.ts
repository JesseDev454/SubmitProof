/**
 * Maps audit event_type strings to friendly human-readable labels.
 * Used in both student receipt and lecturer dashboard activity feeds.
 */

const EVENT_LABELS: Record<string, string> = {
  FILE_SELECTED: 'selected a file',
  FILE_UPLOADED: 'uploaded a file',
  FILE_SUBMITTED: 'submitted a file',
  SMS_COMMITMENT_RECEIVED: 'made a fallback commitment',
  SMS_COMMITMENT_CONFIRMED: 'confirmed a fallback commitment',
  HASH_VERIFICATION_PASSED: 'was verified',
  HASH_VERIFICATION_FAILED: 'had a hash mismatch',
  HASH_MISMATCH_DETECTED: 'had a hash mismatch detected',
  SUBMISSION_CREATED: 'created a submission',
  SUBMISSION_OPENED: 'opened a submission',
  SUBMISSION_CLOSED: 'closed a submission',
  AWAITING_FULL_UPLOAD: 'is awaiting upload',
  UPLOAD_COMPLETED: 'completed an upload',
  ASSIGNMENT_PUBLISHED: 'published an assignment',
  ASSIGNMENT_CLOSED: 'closed an assignment',
  FALLBACK_TOKEN_GENERATED: 'generated a fallback token',
}

/** Returns a friendly label for a given audit event_type. */
export function formatAuditEvent(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.toLowerCase().replace(/_/g, ' ')
}
