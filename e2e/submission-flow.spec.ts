import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../src/types/database.types'

type TestUser = { id: string; email: string; password: string }

let admin: SupabaseClient<Database>
let lecturer: TestUser
let student: TestUser
let outsider: TestUser
let normalAssignmentId: string
let fallbackAssignmentId: string
let failedUploadAssignmentId: string

async function createUser(label: string, claimedRole?: string): Promise<TestUser> {
  const email = `submitproof-e2e-${label}-${randomUUID()}@example.test`
  const password = `${randomUUID()}Aa1!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${label}`, ...(claimedRole ? { role: claimedRole } : {}) },
  })
  if (error || !data.user) throw error ?? new Error('Could not create an E2E user.')
  return { id: data.user.id, email, password }
}

async function createPublishedAssignment(courseId: string, ownerId: string, title: string, fallbackEnabled: boolean) {
  const { data: assignmentId, error: createError } = await admin.rpc('create_assignment', {
    p_actor_id: ownerId,
    p_course_id: courseId,
    p_title: title,
    p_description: 'Created by the browser test fixture.',
    p_policy: {
      deadlineAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      fallbackEnabled,
      gracePeriodMinutes: 60,
      allowedMimeTypes: ['application/pdf'],
      maxFileSizeBytes: 1_048_576,
    },
  })
  if (createError || !assignmentId) throw createError ?? new Error('Could not create an E2E assignment.')
  const { error: publishError } = await admin.rpc('publish_assignment', {
    p_actor_id: ownerId,
    p_assignment_id: assignmentId,
  })
  if (publishError) throw publishError
  return assignmentId
}

async function signIn(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/student$/)
}

async function choosePdf(page: Page, name: string, bytes: string) {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from(bytes),
  })
}

test.beforeAll(async () => {
  test.setTimeout(120_000)
  const url = process.env.E2E_SUPABASE_URL
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Local Supabase E2E credentials are unavailable.')
  admin = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  lecturer = await createUser('lecturer')
  student = await createUser('student', 'lecturer')
  outsider = await createUser('outsider')
  const { error: promoteError } = await admin.from('profiles').update({ role: 'lecturer' }).eq('id', lecturer.id)
  if (promoteError) throw promoteError
  const randomPhoneSuffix = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0')
  const { error: phoneError } = await admin.from('profiles').update({ phone_e164: `+234${randomPhoneSuffix}` }).eq('id', student.id)
  if (phoneError) throw phoneError

  const { data: course, error: courseError } = await admin.from('courses').insert({
    code: `E2E-${randomUUID().slice(0, 8)}`,
    title: 'SubmitProof browser test course',
    lecturer_id: lecturer.id,
  }).select('id').single()
  if (courseError || !course) throw courseError ?? new Error('Could not create an E2E course.')

  const { error: enrollmentError } = await admin.from('enrollments').insert({
    course_id: course.id,
    student_id: student.id,
  })
  if (enrollmentError) throw enrollmentError

  normalAssignmentId = await createPublishedAssignment(course.id, lecturer.id, 'Browser normal upload', false)
  fallbackAssignmentId = await createPublishedAssignment(course.id, lecturer.id, 'Browser fallback upload', true)
  failedUploadAssignmentId = await createPublishedAssignment(course.id, lecturer.id, 'Browser failed reservation', false)
})

test('student records a normal upload and a simulated commitment, then verifies matching and mismatching files', async ({ page }) => {
  await signIn(page, student)
  await expect(page).toHaveURL(/\/student$/)

  await page.goto(`/student/assignments/${normalAssignmentId}`)
  await expect(page.getByRole('heading', { name: 'Browser normal upload' })).toBeVisible()
  await page.getByRole('link', { name: 'Upload assignment' }).click()
  await choosePdf(page, 'normal.pdf', '%PDF-1.7\nnormal upload\n%%EOF\n')
  const normalSubmit = page.getByRole('button', { name: 'Submit Normally' })
  await expect(normalSubmit).toBeEnabled()
  await normalSubmit.click()
  await expect(page).toHaveURL(new RegExp(`/student/assignments/${normalAssignmentId}/receipt`))
  await expect(page.getByRole('heading', { name: 'Submission receipt' })).toBeVisible()
  await expect(page.getByText('not applicable', { exact: true })).toHaveCount(2)

  await page.goto(`/student/assignments/${fallbackAssignmentId}`)
  await page.getByRole('link', { name: 'Upload assignment' }).click()
  await choosePdf(page, 'committed.pdf', '%PDF-1.7\ncommitted bytes\n%%EOF\n')
  await expect(page.getByRole('link', { name: /fallback submission/i })).toBeVisible()
  await page.getByRole('link', { name: /fallback submission/i }).click()
  await page.getByRole('button', { name: 'Request fallback token' }).click()
  await expect(page.locator('pre')).toContainText(/^SP1\|/)
  await page.getByRole('button', { name: 'Simulate SMS' }).click()
  await expect(page.getByRole('heading', { name: 'Commitment recorded' })).toBeVisible()
  await expect(page.getByText(/simulated fallback commitment/)).toBeVisible()
  await expect(page).not.toHaveURL(/token/i)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Commitment recorded' })).toBeVisible()
  await page.getByRole('link', { name: 'Upload original file' }).click()
  await choosePdf(page, 'committed.pdf', '%PDF-1.7\ncommitted bytes\n%%EOF\n')
  await page.getByRole('button', { name: 'Upload and verify' }).click()
  await expect(page.getByRole('heading', { name: 'Upload recorded' })).toBeVisible()
  await expect(page.getByText('match', { exact: true })).toBeVisible()
  await expect(page.getByText('qualifies', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Remove file' }).click()
  await choosePdf(page, 'different.pdf', '%PDF-1.7\ndifferent bytes\n%%EOF\n')
  await page.getByRole('button', { name: 'Upload and verify' }).click()
  await expect(page.getByRole('heading', { name: 'Upload recorded' })).toBeVisible()
  await expect(page.getByText('mismatch', { exact: true })).toBeVisible()
  await expect(page.getByText('does not qualify', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'View receipt' }).click()
  await expect(page.getByRole('heading', { name: 'Submission receipt' })).toBeVisible()
  const viewFile = page.getByRole('button', { name: 'View file' })
  await expect(viewFile).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await viewFile.click()
  const download = await downloadPromise
  expect(await download.failure()).toBeNull()
})

test('a failed upload reservation stays on the form and shows the API error', async ({ page }) => {
  await signIn(page, student)
  await page.goto(`/student/assignments/${failedUploadAssignmentId}`)
  await page.getByRole('link', { name: 'Upload assignment' }).click()
  await choosePdf(page, 'reservation-failure.pdf', '%PDF-1.7\nreservation failure\n%%EOF\n')
  await page.route(new RegExp(`/api/assignments/${failedUploadAssignmentId}/uploads$`), async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'service_unavailable', message: 'Upload reservation is temporarily unavailable.' } }),
    })
  })

  await page.getByRole('button', { name: 'Submit Normally' }).click()
  await expect(page.getByRole('alert')).toContainText('Upload reservation is temporarily unavailable.')
  await expect(page.getByRole('heading', { name: 'Submit Assignment' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/receipt$/)
})

test('a different student cannot open another student assignment', async ({ page }) => {
  await signIn(page, outsider)
  await page.goto(`/student/assignments/${fallbackAssignmentId}`)
  await expect(page.getByRole('heading', { name: 'Assignment not found' })).toBeVisible()
})
