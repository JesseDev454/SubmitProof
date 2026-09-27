export function isReminderEligible(input: {
  status: string
  deadlineAt: string
  now: number
  optedIn: boolean
  hasCompletedUpload: boolean
}): boolean {
  const deadline = Date.parse(input.deadlineAt)
  return input.status === 'published'
    && input.optedIn
    && !input.hasCompletedUpload
    && Number.isFinite(deadline)
    && deadline > input.now
    && deadline <= input.now + 24 * 60 * 60 * 1000
}
