export type CreateAssignmentInput = {
  title: string
  courseId: string
  description: string
  deadlineLocal: string
  mimeTypes: string[]
  graceInput: string
}

export function parseGracePeriodMinutes(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const minutes = Number(trimmed)
  return Number.isSafeInteger(minutes) && minutes <= 2147483647 ? minutes : null
}

export function validateCreateAssignment(
  input: CreateAssignmentInput,
  status: 'draft' | 'published',
  now: Date,
): { field: string; message: string } | null {
  if (!input.title.trim()) return { field: 'assignment-title', message: 'Enter an assignment title.' }
  if (!input.courseId) return { field: 'assignment-course', message: 'Choose a course.' }
  if (status === 'published' && !input.deadlineLocal) {
    return { field: 'assignment-deadline', message: 'Choose a future deadline before publishing.' }
  }
  if (input.deadlineLocal) {
    const deadline = new Date(input.deadlineLocal)
    if (!Number.isFinite(deadline.getTime())) {
      return { field: 'assignment-deadline', message: 'Enter a valid deadline.' }
    }
    if (status === 'published' && deadline.getTime() <= now.getTime()) {
      return { field: 'assignment-deadline', message: 'Choose a deadline later than the current time.' }
    }
  }
  if (input.mimeTypes.length === 0) {
    return { field: 'assignment-file-types', message: 'Select at least one supported file type.' }
  }
  if (parseGracePeriodMinutes(input.graceInput) === null) {
    return { field: 'grace-minutes', message: 'Enter a whole number of grace minutes from 0 to 2147483647.' }
  }
  return null
}
