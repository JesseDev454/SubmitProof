export type UploadKind = 'normal' | 'fallback'

type ReservationResponse = {
  reservationId: string
  stagingObjectPath: string
  signedUploadUrl: string | null
  status?: string
}

export type FinalizedUpload = {
  uploadId: string
  verificationResult: 'pending' | 'match' | 'mismatch' | 'not_applicable'
  policyResult: 'pending' | 'qualifies' | 'does_not_qualify' | 'not_applicable'
  matchedCommitmentId?: string | null
  idempotent?: boolean
}

type ApiEnvelope<T> = { data: T } | { error: { message?: string } }

type UploadSubmissionOptions = {
  assignmentId: string
  file: File
  kind: UploadKind
  idempotencyKey: string
  fetcher?: typeof fetch
  transfer: (path: string, token: string, file: File) => Promise<{ error: Error | null }>
  onStage?: (stage: 'reserving' | 'transferring' | 'verifying') => void
}

const memoryIdempotencyKeys = new Map<string, string>()

export function getUploadIdempotencyKey(
  assignmentId: string,
  kind: UploadKind,
  fileHash: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = undefined,
  createKey: () => string = () => crypto.randomUUID(),
): string {
  const storageKey = `submitproof:upload:${assignmentId}:${kind}:${fileHash}`
  if (!storage) {
    try {
      storage = window.sessionStorage
    } catch {
      return getMemoryIdempotencyKey(storageKey, createKey)
    }
  }

  try {
    const existing = storage.getItem(storageKey)
    if (existing) return existing

    const key = createKey()
    storage.setItem(storageKey, key)
    return key
  } catch {
    return getMemoryIdempotencyKey(storageKey, createKey)
  }
}

function getMemoryIdempotencyKey(storageKey: string, createKey: () => string): string {
  const existing = memoryIdempotencyKeys.get(storageKey)
  if (existing) return existing
  const key = createKey()
  memoryIdempotencyKeys.set(storageKey, key)
  return key
}

export async function uploadSubmission({
  assignmentId,
  file,
  kind,
  idempotencyKey,
  fetcher = fetch,
  transfer,
  onStage,
}: UploadSubmissionOptions): Promise<FinalizedUpload> {
  onStage?.('reserving')
  const reservationResponse = await fetcher(`/api/assignments/${assignmentId}/uploads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      mimeType: file.type,
      fileSizeBytes: file.size,
      idempotencyKey,
    }),
  })
  const reservationPayload = await readEnvelope<ReservationResponse>(reservationResponse)
  const reservation = reservationPayload.data

  if (reservation.signedUploadUrl) {
    const signedUrl = new URL(reservation.signedUploadUrl, 'http://localhost')
    const token = signedUrl.searchParams.get('token')
    if (!token) throw new Error('The secure upload link is invalid. Request a new upload reservation.')

    onStage?.('transferring')
    const { error } = await transfer(reservation.stagingObjectPath, token, file)
    if (error) throw error
  } else if (reservation.status !== 'finalized') {
    throw new Error('The secure upload link is unavailable. Retry with the same upload request.')
  }

  onStage?.('verifying')
  const completionResponse = await fetcher(`/api/uploads/${reservation.reservationId}/complete`, {
    method: 'POST',
  })
  const completionPayload = await readEnvelope<FinalizedUpload>(completionResponse)
  return completionPayload.data
}

async function readEnvelope<T>(response: Response): Promise<{ data: T }> {
  let payload: ApiEnvelope<T>
  try {
    payload = await response.json() as ApiEnvelope<T>
  } catch {
    throw new Error('The server returned an unreadable response.')
  }

  if (!response.ok || !('data' in payload)) {
    throw new Error(('error' in payload && payload.error.message) || `The request failed (${response.status}).`)
  }
  return payload
}
