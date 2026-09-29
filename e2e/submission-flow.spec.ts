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
let courseId: string

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

async function signIn(page: Page, user: TestUser, role: 'student' | 'lecturer' = 'student') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(new RegExp(`/${role}$`))
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
  courseId = course.id

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
  await expect(page.getByText(/Normal online upload: no SMS commitment was used/)).toBeVisible()

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
  await expect(page.getByText(/uploaded file does not match a recorded SMS fingerprint/)).toBeVisible()
  const viewFile = page.getByRole('button', { name: 'View file' })
  await expect(viewFile).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await viewFile.click()
  const download = await downloadPromise
  expect(await download.failure()).toBeNull()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
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
  await expect(page.getByText('Upload reservation is temporarily unavailable.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Submit Assignment' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/receipt$/)
})

test('a different student cannot open another student assignment', async ({ page }) => {
  await signIn(page, outsider)
  await page.goto(`/student/assignments/${fallbackAssignmentId}`)
  await expect(page.getByRole('heading', { name: 'Assignment not found' })).toBeVisible()
})

test('a failed sign out shows an error and keeps the student signed in', async ({ page }) => {
  await signIn(page, student)
  await page.route('**/auth/v1/logout*', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Logout unavailable' }) })
  })

  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page.getByText('Could not sign out: Logout unavailable', { exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/\/login$/)
})

test('lecturer publishes assignments, reviews evidence, archives, and saves shared profile preferences', async ({ page }) => {
  await signIn(page, lecturer, 'lecturer')
  await expect(page.getByRole('heading', { name: /^Welcome/ })).toBeVisible()

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/lecturer/assignments/new')
  const titleInput = page.getByLabel('Title')
  await expect(titleInput).toBeVisible()
  const titleColor = await titleInput.evaluate((element) => getComputedStyle(element).color)
  const placeholder = await titleInput.evaluate((element) => ({
    color: getComputedStyle(element, '::placeholder').color,
    opacity: getComputedStyle(element, '::placeholder').opacity,
  }))
  expect(titleColor).not.toBe('rgb(237, 237, 237)')
  expect(placeholder.color).not.toBe('rgb(237, 237, 237)')
  expect(placeholder.opacity).toBe('1')

  await page.getByLabel('Title').fill('Draft retained after publish failure')
  await page.getByLabel('Course').selectOption(courseId)
  const courseColor = await page.getByLabel('Course').evaluate((element) => getComputedStyle(element).color)
  expect(courseColor).not.toBe('rgb(237, 237, 237)')
  await page.getByRole('button', { name: 'Publish assignment' }).click()
  await expect(page.locator('#assignment-error')).toContainText('Choose a future deadline before publishing.')
  await expect(page.getByLabel('Deadline')).toBeFocused()
  await page.getByLabel('Description').fill('This verifies that a publication failure preserves the saved draft.')
  const graceInput = page.getByLabel('Fallback upload grace period (minutes)')
  await graceInput.press('ControlOrMeta+A')
  await graceInput.press('Backspace')
  await expect(graceInput).toHaveValue('')
  await graceInput.fill('45')
  const deadline = new Date(Date.now() + 48 * 60 * 60_000)
  const localDeadline = [deadline.getFullYear(), String(deadline.getMonth() + 1).padStart(2, '0'), String(deadline.getDate()).padStart(2, '0')].join('-')
    + `T${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`
  await page.getByLabel('Deadline').fill(localDeadline)
  let releasePublish: () => void = () => {}
  let markPublishStarted: () => void = () => {}
  const publishStarted = new Promise<void>((resolve) => { markPublishStarted = resolve })
  const publishGate = new Promise<void>((resolve) => { releasePublish = resolve })
  const publishEndpoint = /\/api\/assignments\/[^/]+\/publish$/
  await page.route(publishEndpoint, async (route) => {
    markPublishStarted()
    await publishGate
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'service_unavailable', message: 'Publish is temporarily unavailable.' } }),
    })
  })
  await page.getByRole('button', { name: 'Publish assignment' }).click()
  await publishStarted
  await expect(page.getByRole('button', { name: 'Publishing…' })).toBeDisabled()
  releasePublish()
  await expect(
    page.locator('div[role="alert"]').filter({ hasText: 'Draft saved, but publishing failed' }),
  ).toContainText('Draft saved, but publishing failed: Publish is temporarily unavailable.')
  await page.getByRole('link', { name: 'Open saved draft' }).click()
  await expect(page.getByRole('heading', { name: 'Draft retained after publish failure' })).toBeVisible()
  await expect(page.getByText('draft', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit draft settings' })).toBeVisible()
  await page.getByRole('link', { name: 'Edit draft settings' }).click()
  const settingsGrace = page.getByLabel('Fallback grace period (minutes)')
  await expect(settingsGrace).toHaveValue('45')
  await settingsGrace.press('ControlOrMeta+A')
  await settingsGrace.press('Backspace')
  await expect(settingsGrace).toHaveValue('')
  await settingsGrace.fill('90')
  await page.getByRole('button', { name: 'Save draft settings' }).click()
  await expect(page.getByText(/Draft settings saved/)).toBeVisible()
  await page.unroute(publishEndpoint)

  await page.goto('/lecturer/assignments/new')
  await page.getByLabel('Title').fill('Lecturer published assignment')
  await page.getByLabel('Course').selectOption(courseId)
  await page.getByLabel('Deadline').fill(localDeadline)
  await page.getByRole('button', { name: 'Publish assignment' }).click()
  await expect(page).toHaveURL(/\/lecturer\/assignments\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: 'Lecturer published assignment' })).toBeVisible()
  await expect(page.getByText('published', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit draft settings' })).toHaveCount(0)

  const { data: submission, error: submissionError } = await admin
    .from('submissions')
    .select('id')
    .eq('assignment_id', fallbackAssignmentId)
    .eq('student_id', student.id)
    .single()
  if (submissionError) {
    throw new Error(`E2E fallback submission lookup returned ${submissionError.code}: ${submissionError.message}`)
  }
  const { data: uploadsBeforeReview, error: uploadReadError } = await admin
    .from('submission_uploads')
    .select('verification_result, policy_result')
    .eq('submission_id', submission.id)
    .order('finalized_at', { ascending: false })
    .limit(1)
    .single()
  if (uploadReadError) {
    throw new Error(`E2E fallback upload lookup returned ${uploadReadError.code}: ${uploadReadError.message}`)
  }

  await page.goto(`/lecturer/assignments/${fallbackAssignmentId}/submissions/${submission.id}`)
  await expect(page.getByText('Latest fallback policy result')).toBeVisible()
  await expect(
    page.getByText('Latest fallback policy result').locator('..').getByText('does not qualify', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText(/uploaded file does not match a recorded SMS fingerprint/)).toBeVisible()
  await page.getByRole('button', { name: 'Flag for review' }).click()
  await page.getByRole('button', { name: 'Confirm flagged' }).click()
  await expect(page.getByText(/Latest decision: flagged/)).toBeVisible()
  await page.getByLabel(/Reason/).fill('Checked the file manually against the course instructions.')
  await page.getByRole('button', { name: 'Accept submission' }).click()
  await page.getByRole('button', { name: 'Confirm accepted' }).click()
  await expect(page.getByText(/Latest decision: accepted/)).toBeVisible()
  const { data: uploadsAfterReview, error: uploadAfterReviewError } = await admin
    .from('submission_uploads')
    .select('verification_result, policy_result')
    .eq('submission_id', submission.id)
    .order('finalized_at', { ascending: false })
    .limit(1)
    .single()
  if (uploadAfterReviewError) throw uploadAfterReviewError
  expect(uploadsAfterReview).toEqual(uploadsBeforeReview)

  await page.goto(`/lecturer/assignments/${fallbackAssignmentId}`)
  await page.getByRole('button', { name: 'Close assignment' }).click()
  await expect(page.getByText('closed', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Archive closed assignment' }).click()
  await expect(page.getByText('archived', { exact: true })).toBeVisible()
  await page.goto('/lecturer/assignments?archived=true')
  await expect(page.getByRole('heading', { name: 'Browser fallback upload' })).toBeVisible()
  await page.goto('/lecturer/assignments')
  await expect(page.getByRole('heading', { name: 'Browser fallback upload' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Archived' })).toBeVisible()

  await page.goto('/lecturer/profile')
  const phoneSuffix = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0')
  await page.getByLabel('Phone number').fill(`+2348${phoneSuffix}`)
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('status')).toContainText('Profile saved.')
  await page.getByRole('checkbox', { name: 'Product updates' }).check()
  await page.getByRole('button', { name: 'Save notification preferences' }).click()
  await expect(page.getByText('Notification preferences saved.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Product updates' })).toBeChecked()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
