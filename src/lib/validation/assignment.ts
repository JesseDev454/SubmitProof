import { z } from 'zod'

/** Shared schema for both draft and publish. */
const base = z.object({
  title: z.string().min(1, 'Title is required'),
  course_id: z.string().min(1, 'Course is required'),
  description: z.string().optional().default(''),
  deadline_date: z.string().optional().default(''),
  deadline_time: z.string().optional().default(''),
  allowed_file_types: z.string().optional().default(''),
  max_file_size_mb: z.number().int().positive().default(50),
  grace_period_days: z.number().int().min(0).default(0),
  fallback_enabled: z.boolean().default(true),
  status: z.enum(['draft', 'published']).default('draft'),
})

/** Draft: only title + course required. */
export const draftSchema = base

/** Publish: all key fields required. */
export const publishSchema = base.superRefine((data, ctx) => {
  if (!data.description) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Description is required', path: ['description'] })
  }
  if (!data.deadline_date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deadline date is required', path: ['deadline_date'] })
  }
  if (!data.deadline_time) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deadline time is required', path: ['deadline_time'] })
  }
  if (!data.allowed_file_types) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Allowed file types are required', path: ['allowed_file_types'] })
  }
})

export type AssignmentFormValues = z.infer<typeof base>
