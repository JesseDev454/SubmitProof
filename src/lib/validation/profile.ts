import { z } from 'zod'

export const profileSettingsSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.').max(200),
  department: z.string().trim().max(120).nullable(),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a phone number in international E.164 format, such as +2348012345678.').nullable(),
}).strict()
