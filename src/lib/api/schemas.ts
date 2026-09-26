import { z } from 'zod'

const mimeType = z.enum(['application/pdf', 'image/png', 'image/jpeg', 'text/plain'])

export const policySchema = z.object({
  deadlineAt: z.string().refine(
    (value) => Number.isFinite(Date.parse(value)) && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value),
    'Deadline must be an ISO timestamp with a timezone.',
  ),
  fallbackEnabled: z.boolean(),
  gracePeriodMinutes: z.number().int().min(0).max(2147483647),
  allowedMimeTypes: z.array(mimeType).min(1).max(4).refine((values) => new Set(values).size === values.length),
  maxFileSizeBytes: z.number().int().min(1048576).max(52428800),
}).strict()

export const createAssignmentSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000).nullable().optional(),
  policy: policySchema,
}).strict()

export const patchAssignmentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  policy: policySchema.optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required.')

export const issueTokenSchema = z.object({ rotate: z.boolean() }).strict()

export const reserveUploadSchema = z.object({
  kind: z.enum(['normal', 'fallback']),
  mimeType,
  fileSizeBytes: z.number().int().min(1).max(52428800),
  idempotencyKey: z.string().min(8).max(128),
}).strict()

export const simulateSmsSchema = z.object({
  payload: z.string().max(512),
  providerMessageId: z.string().trim().min(1).max(200).optional(),
}).strict()

export type AssignmentPolicyInput = z.infer<typeof policySchema>
