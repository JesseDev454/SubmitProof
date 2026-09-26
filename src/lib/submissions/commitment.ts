export type CommitmentPayload = {
  token: string
  nonce: string
  sha256: string
}

export type FallbackPolicyInput = {
  fallbackEnabled: boolean
  deadlineAt: string
  gracePeriodMinutes: number
  gatewayEventAt: string | null
  storageReceivedAt: string
}

export type CommitmentEvidence = {
  id: string
  fileSha256: string
  gatewayEventAt: string | null
  deadlineAt: string
  fallbackEnabled: boolean
  gracePeriodMinutes: number
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/
const NONCE_PATTERN = /^[A-Za-z0-9_-]{8,128}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export function parseCommitmentPayload(payload: string): CommitmentPayload {
  const parts = payload.split('|')
  if (parts.length !== 4 || parts[0] !== 'SP1') {
    throw new Error('Commitment must use the SP1 protocol')
  }

  const [, token, nonce, sha256] = parts
  if (!TOKEN_PATTERN.test(token)) throw new Error('Invalid assignment token')
  if (!NONCE_PATTERN.test(nonce)) throw new Error('Invalid commitment nonce')
  if (!SHA256_PATTERN.test(sha256)) throw new Error('Invalid SHA-256 fingerprint')

  return { token, nonce, sha256 }
}

export function evaluateFallbackPolicy(input: FallbackPolicyInput): 'qualifies' | 'does_not_qualify' {
  if (!input.fallbackEnabled || !input.gatewayEventAt) return 'does_not_qualify'
  if (!Number.isInteger(input.gracePeriodMinutes) || input.gracePeriodMinutes < 0) {
    return 'does_not_qualify'
  }

  const deadline = Date.parse(input.deadlineAt)
  const gatewayTime = Date.parse(input.gatewayEventAt)
  const storageTime = Date.parse(input.storageReceivedAt)
  if (![deadline, gatewayTime, storageTime].every(Number.isFinite)) return 'does_not_qualify'

  const graceExpiry = deadline + input.gracePeriodMinutes * 60_000
  return gatewayTime < deadline && storageTime < graceExpiry
    ? 'qualifies'
    : 'does_not_qualify'
}

export function verifyAgainstCommitments(
  serverSha256: string,
  storageReceivedAt: string,
  commitments: CommitmentEvidence[],
): {
  matchedCommitmentId: string | null
  verificationResult: 'match' | 'mismatch'
  policyResult: 'qualifies' | 'does_not_qualify'
} {
  const matches = commitments.filter((commitment) => commitment.fileSha256 === serverSha256)
  const qualified = matches
    .filter((commitment) => evaluateFallbackPolicy({
      fallbackEnabled: commitment.fallbackEnabled,
      deadlineAt: commitment.deadlineAt,
      gracePeriodMinutes: commitment.gracePeriodMinutes,
      gatewayEventAt: commitment.gatewayEventAt,
      storageReceivedAt,
    }) === 'qualifies')
    .sort((left, right) => {
      const timeOrder = Date.parse(left.gatewayEventAt!) - Date.parse(right.gatewayEventAt!)
      return timeOrder || left.id.localeCompare(right.id)
    })

  const selected = qualified[0] ?? matches.sort((left, right) => left.id.localeCompare(right.id))[0]
  return {
    matchedCommitmentId: selected?.id ?? null,
    verificationResult: selected ? 'match' : 'mismatch',
    policyResult: qualified.length > 0 ? 'qualifies' : 'does_not_qualify',
  }
}

export function detectSupportedMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-') {
    return 'application/pdf'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (!text.includes('\u0000')) return 'text/plain'
  } catch {
    return null
  }
  return null
}
