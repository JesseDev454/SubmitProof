import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const repoRoot = process.cwd()
const cli = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const status = spawnSync(cli, ['supabase', 'status', '--output', 'env'], {
  cwd: repoRoot,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  windowsHide: true,
})
if (status.status !== 0) throw new Error('Could not read local Supabase status. Start Supabase before the integration run.')

const localConfig = Object.fromEntries(status.stdout.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z0-9_]+)="?([^"\r\n]*)"?$/)
  return match ? [[match[1], match[2]]] : []
}))
const supabaseUrl = localConfig.API_URL ?? localConfig.SUPABASE_URL
const anonKey = localConfig.ANON_KEY
const serviceRoleKey = localConfig.SERVICE_ROLE_KEY
if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Local Supabase did not provide its API URL and keys.')
}
if (!['localhost', '127.0.0.1'].includes(new URL(supabaseUrl).hostname)) {
  throw new Error('The integration suite only runs against a local Supabase endpoint.')
}

const port = process.env.PHASE2_TEST_PORT ?? '3101'
const appOrigin = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, [
  resolve(repoRoot, 'node_modules/next/dist/bin/next'),
  'dev', '--hostname', '127.0.0.1', '--port', port,
], {
  cwd: repoRoot,
  stdio: 'ignore',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    ENABLE_SIMULATED_SMS: 'true',
  },
})

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function waitForApp() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited before becoming ready (${server.exitCode}).`)
    try {
      const response = await fetch(`${appOrigin}/api/health`)
      if (response.ok) return
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000))
  }
  throw new Error('Next.js did not become ready within two minutes.')
}

async function createUser(label, metadataRole = 'student') {
  const email = `phase2-${label}-${randomUUID()}@example.test`
  const password = `${randomUUID()}Aa1!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: metadataRole, full_name: `Phase 2 ${label}` },
  })
  if (error || !data.user) throw error ?? new Error('Could not create a local test user.')
  const { error: phoneError } = await admin
    .from('profiles')
    .update({ phone_e164: `+2348${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}` })
    .eq('id', data.user.id)
  if (phoneError) throw phoneError
  return { id: data.user.id, email, password }
}

async function promoteToLecturer(userId) {
  const { error } = await admin.from('profiles').update({ role: 'lecturer' }).eq('id', userId)
  if (error) throw error
}

async function signedInCookie(user) {
  const values = new Map()
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...values].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => values.set(name, value)),
    },
  })
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) throw error
  return [...values].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function api(path, { cookie, method = 'GET', body, origin = appOrigin } = {}) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  if (body !== undefined) headers.set('content-type', 'application/json')
  if (method !== 'GET') headers.set('origin', origin)
  const response = await fetch(`${appOrigin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json()
  return { response, payload }
}

async function createStoredFile(path, token, bytes) {
  const { error } = await anon.storage.from('submission-files').uploadToSignedUrl(
    path,
    token,
    new Blob([bytes], { type: 'application/pdf' }),
    { contentType: 'application/pdf', upsert: false },
  )
  if (error) throw error
}

async function reserveAndStage({ assignmentId, cookie, fileBytes, idempotencyKey, kind = 'fallback' }) {
  const reservationResult = await api(`/api/assignments/${assignmentId}/uploads`, {
    cookie,
    method: 'POST',
    body: {
      kind,
      mimeType: 'application/pdf',
      fileSizeBytes: fileBytes.byteLength,
      idempotencyKey,
    },
  })
  assert.equal(reservationResult.response.status, 201, JSON.stringify(reservationResult.payload))
  const reservation = reservationResult.payload.data
  const uploadToken = new URL(reservation.signedUploadUrl).searchParams.get('token')
  assert.ok(uploadToken)
  await createStoredFile(reservation.stagingObjectPath, uploadToken, fileBytes)
  return reservation
}

async function reserveAndComplete({ assignmentId, cookie, fileBytes, idempotencyKey, kind = 'fallback' }) {
  const reservation = await reserveAndStage({ assignmentId, cookie, fileBytes, idempotencyKey, kind })
  const completed = await api(`/api/uploads/${reservation.reservationId}/complete`, {
    cookie,
    method: 'POST',
  })
  assert.equal(completed.response.status, 201, JSON.stringify(completed.payload))
  return { reservation, evidence: completed.payload.data }
}

try {
  await waitForApp()
  const lecturer = await createUser('lecturer', 'lecturer')
  const outsiderLecturer = await createUser('outsider', 'lecturer')
  const student = await createUser('student')
  const outsiderStudent = await createUser('other-student')
  await promoteToLecturer(lecturer.id)
  await promoteToLecturer(outsiderLecturer.id)

  const { data: course, error: courseError } = await admin
    .from('courses')
    .insert({ code: `IT-${randomUUID().slice(0, 8)}`, title: 'Phase 2 Integration', lecturer_id: lecturer.id })
    .select('id')
    .single()
  if (courseError || !course) throw courseError ?? new Error('Could not create test course.')
  const { error: enrollmentError } = await admin
    .from('enrollments')
    .insert({ course_id: course.id, student_id: student.id })
  if (enrollmentError) throw enrollmentError

  const lecturerCookie = await signedInCookie(lecturer)
  const outsiderLecturerCookie = await signedInCookie(outsiderLecturer)
  const studentCookie = await signedInCookie(student)
  const outsiderStudentCookie = await signedInCookie(outsiderStudent)
  const deadlineAt = new Date(Date.now() + 15 * 60_000).toISOString()

  const created = await api('/api/assignments', {
    cookie: lecturerCookie,
    method: 'POST',
    body: {
      courseId: course.id,
      title: 'Evidence flow integration assignment',
      description: 'Created through the route handler.',
      policy: {
        deadlineAt,
        fallbackEnabled: true,
        gracePeriodMinutes: 30,
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 1048576,
      },
    },
  })
  assert.equal(created.response.status, 201, JSON.stringify(created.payload))
  const assignmentId = created.payload.data.id

  const published = await api(`/api/assignments/${assignmentId}/publish`, {
    cookie: lecturerCookie,
    method: 'POST',
  })
  assert.equal(published.response.status, 200, JSON.stringify(published.payload))

  const frozenPolicy = await api(`/api/assignments/${assignmentId}`, {
    cookie: lecturerCookie,
    method: 'PATCH',
    body: { policy: {
      deadlineAt,
      fallbackEnabled: false,
      gracePeriodMinutes: 0,
      allowedMimeTypes: ['application/pdf'],
      maxFileSizeBytes: 1048576,
    } },
  })
  assert.equal(frozenPolicy.response.status, 409)

  const tokenResponse = await api(`/api/assignments/${assignmentId}/fallback-token`, {
    cookie: studentCookie,
    method: 'POST',
    body: { rotate: false },
  })
  assert.equal(tokenResponse.response.status, 201, JSON.stringify(tokenResponse.payload))
  const token = tokenResponse.payload.data.token
  assert.equal(token.length, 43)
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const { data: storedToken, error: tokenError } = await admin
    .from('assignment_tokens')
    .select('token_hash')
    .eq('id', tokenResponse.payload.data.tokenId)
    .single()
  if (tokenError) throw tokenError
  assert.equal(storedToken.token_hash, tokenHash)
  assert.notEqual(storedToken.token_hash, token)

  const firstFile = Buffer.from('%PDF-1.7\nSubmitProof integration file one\n%%EOF\n')
  const firstHash = createHash('sha256').update(firstFile).digest('hex')
  const firstNonce = randomUUID().replaceAll('-', '')
  const firstPayload = `SP1|${token}|${firstNonce}|${firstHash}`
  const firstProviderMessageId = randomUUID()
  const accepted = await api('/api/dev/simulate-sms', {
    cookie: studentCookie,
    method: 'POST',
    body: { payload: firstPayload, providerMessageId: firstProviderMessageId },
  })
  assert.equal(accepted.response.status, 201, JSON.stringify(accepted.payload))
  assert.equal(accepted.payload.data.provider, 'simulated')

  const duplicate = await api('/api/dev/simulate-sms', {
    cookie: studentCookie,
    method: 'POST',
    body: { payload: firstPayload, providerMessageId: firstProviderMessageId },
  })
  assert.equal(duplicate.response.status, 200, JSON.stringify(duplicate.payload))
  assert.equal(duplicate.payload.data.outcome, 'duplicate')

  const providerConflict = await api('/api/dev/simulate-sms', {
    cookie: studentCookie,
    method: 'POST',
    body: {
      payload: `SP1|${token}|${firstNonce}|${'f'.repeat(64)}`,
      providerMessageId: firstProviderMessageId,
    },
  })
  assert.equal(providerConflict.response.status, 400)

  const malformedProviderMessageId = randomUUID()
  const malformed = await api('/api/dev/simulate-sms', {
    cookie: studentCookie,
    method: 'POST',
    body: { payload: `SP2|${token}|${firstNonce}|${firstHash}`, providerMessageId: malformedProviderMessageId },
  })
  assert.equal(malformed.response.status, 400)
  const malformedMessageReuse = await api('/api/dev/simulate-sms', {
    cookie: studentCookie,
    method: 'POST',
    body: {
      payload: `SP1|${token}|${randomUUID().replaceAll('-', '')}|${firstHash}`,
      providerMessageId: malformedProviderMessageId,
    },
  })
  assert.equal(malformedMessageReuse.response.status, 400, 'a rejected callback ID cannot accept a later valid payload')
  const { count: malformedMessageCommitments, error: malformedMessageCommitmentsError } = await admin
    .from('commitments')
    .select('id', { count: 'exact', head: true })
    .eq('provider_message_id', malformedProviderMessageId)
  if (malformedMessageCommitmentsError) throw malformedMessageCommitmentsError
  assert.equal(malformedMessageCommitments, 0)

  const completed = await reserveAndComplete({
    assignmentId,
    cookie: studentCookie,
    fileBytes: firstFile,
    idempotencyKey: randomUUID(),
  })
  assert.equal(completed.evidence.verificationResult, 'match')
  assert.equal(completed.evidence.policyResult, 'qualifies')

  const retryCompletion = await api(`/api/uploads/${completed.reservation.reservationId}/complete`, {
    cookie: studentCookie,
    method: 'POST',
  })
  assert.equal(retryCompletion.response.status, 200)
  assert.equal(retryCompletion.payload.data.id, completed.evidence.uploadId)

  const submission = await api(`/api/submissions/${completed.reservation.submissionId}`, { cookie: studentCookie })
  assert.equal(submission.response.status, 200)
  assert.equal(submission.payload.data.uploads.length, 1)
  const studentAudit = await api(`/api/submissions/${completed.reservation.submissionId}/audit`, { cookie: studentCookie })
  assert.equal(studentAudit.response.status, 200)
  assert.ok(studentAudit.payload.data.some((event) => event.event_type === 'fallback.commitment_recorded'))

  const { error: secondEnrollmentError } = await admin
    .from('enrollments')
    .insert({ course_id: course.id, student_id: outsiderStudent.id })
  if (secondEnrollmentError) throw secondEnrollmentError
  const normalFlow = await reserveAndComplete({
    assignmentId,
    cookie: outsiderStudentCookie,
    fileBytes: Buffer.from('%PDF-1.7\nSubmitProof normal upload\n%%EOF\n'),
    idempotencyKey: randomUUID(),
    kind: 'normal',
  })
  assert.equal(normalFlow.evidence.verificationResult, 'not_applicable')
  assert.equal(normalFlow.evidence.policyResult, 'not_applicable')

  const invalidSignatureReservation = await reserveAndStage({
    assignmentId,
    cookie: outsiderStudentCookie,
    fileBytes: Buffer.from([0xff, 0xfe, 0xff]),
    idempotencyKey: randomUUID(),
    kind: 'normal',
  })
  const invalidSignatureResult = await api(`/api/uploads/${invalidSignatureReservation.reservationId}/complete`, {
    cookie: outsiderStudentCookie,
    method: 'POST',
  })
  assert.equal(invalidSignatureResult.response.status, 400)
  const { data: invalidSignatureObject } = await admin.storage
    .from('submission-files')
    .info(invalidSignatureReservation.stagingObjectPath)
  assert.equal(invalidSignatureObject, null, 'rejected unsupported file bytes are removed from staging')

  const disallowedPngReservation = await reserveAndStage({
    assignmentId,
    cookie: outsiderStudentCookie,
    fileBytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    idempotencyKey: randomUUID(),
    kind: 'normal',
  })
  const disallowedPngResult = await api(`/api/uploads/${disallowedPngReservation.reservationId}/complete`, {
    cookie: outsiderStudentCookie,
    method: 'POST',
  })
  assert.equal(disallowedPngResult.response.status, 400)
  const { data: disallowedPngObject } = await admin.storage
    .from('submission-files')
    .info(disallowedPngReservation.stagingObjectPath)
  assert.equal(disallowedPngObject, null, 'rejected policy-mismatched bytes are removed from staging')

  const pendingNormalFile = Buffer.from('%PDF-1.7\nReserved before assignment close\n%%EOF\n')
  const pendingNormalUpload = await reserveAndStage({
    assignmentId,
    cookie: outsiderStudentCookie,
    fileBytes: pendingNormalFile,
    idempotencyKey: randomUUID(),
    kind: 'normal',
  })

  const lecturerEvidence = await api(`/api/assignments/${assignmentId}/submissions`, { cookie: lecturerCookie })
  assert.equal(lecturerEvidence.response.status, 200)
  assert.equal(lecturerEvidence.payload.data.submissions.length, 2)
  assert.equal(
    lecturerEvidence.payload.data.submissions.find((submission) => submission.id === completed.reservation.submissionId).uploads[0].verification_result,
    'match',
  )

  const anonymous = await api('/api/assignments')
  assert.equal(anonymous.response.status, 401)
  const crossOrigin = await api(`/api/assignments/${assignmentId}/close`, {
    cookie: lecturerCookie,
    method: 'POST',
    origin: 'https://attacker.example',
  })
  assert.equal(crossOrigin.response.status, 403)
  const otherLecturerRead = await api(`/api/assignments/${assignmentId}`, { cookie: outsiderLecturerCookie })
  assert.equal(otherLecturerRead.response.status, 404)
  const otherStudentRead = await api(`/api/submissions/${completed.reservation.submissionId}`, { cookie: outsiderStudentCookie })
  assert.equal(otherStudentRead.response.status, 404)

  const secondFile = Buffer.from('%PDF-1.7\nSubmitProof integration file two\n%%EOF\n')
  const secondHash = createHash('sha256').update(secondFile).digest('hex')
  const secondCommitment = await api('/api/dev/simulate-sms', {
    cookie: studentCookie,
    method: 'POST',
    body: { payload: `SP1|${token}|${randomUUID().replaceAll('-', '')}|${secondHash}` },
  })
  assert.equal(secondCommitment.response.status, 201, JSON.stringify(secondCommitment.payload))

  const closed = await api(`/api/assignments/${assignmentId}/close`, {
    cookie: lecturerCookie,
    method: 'POST',
  })
  assert.equal(closed.response.status, 200, JSON.stringify(closed.payload))
  const finalizedAfterClose = await api(`/api/uploads/${pendingNormalUpload.reservationId}/complete`, {
    cookie: outsiderStudentCookie,
    method: 'POST',
  })
  assert.equal(finalizedAfterClose.response.status, 409, JSON.stringify(finalizedAfterClose.payload))
  const { data: postCloseEvidence, error: postCloseEvidenceError } = await admin
    .from('submission_uploads')
    .select('id')
    .eq('reservation_id', pendingNormalUpload.reservationId)
    .maybeSingle()
  if (postCloseEvidenceError) throw postCloseEvidenceError
  assert.equal(postCloseEvidence, null, 'a normal pre-close reservation creates no evidence after closure')
  const { data: postCloseStagingObject } = await admin.storage
    .from('submission-files')
    .info(pendingNormalUpload.stagingObjectPath)
  assert.equal(postCloseStagingObject, null, 'rejected post-close upload staging bytes are removed')
  const closedAssignment = await api(`/api/assignments/${assignmentId}`, { cookie: studentCookie })
  assert.equal(closedAssignment.response.status, 200)
  assert.ok(closedAssignment.payload.data.policy)

  const closedFlow = await reserveAndComplete({
    assignmentId,
    cookie: studentCookie,
    fileBytes: secondFile,
    idempotencyKey: randomUUID(),
  })
  assert.equal(closedFlow.evidence.verificationResult, 'match')
  assert.equal(closedFlow.evidence.policyResult, 'qualifies')

  const blockedAfterClose = await api('/api/dev/simulate-sms', {
    cookie: studentCookie,
    method: 'POST',
    body: { payload: `SP1|${token}|${randomUUID().replaceAll('-', '')}|${firstHash}` },
  })
  assert.equal(blockedAfterClose.response.status, 400)

  process.stdout.write('Phase 2 local API and Storage integration flow passed.\n')
} finally {
  server.kill()
}
