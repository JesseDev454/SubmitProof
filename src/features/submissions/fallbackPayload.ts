export function buildFallbackPayload(token: string, nonce: string, sha256: string): string {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new Error('Fallback token is invalid.')
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(nonce)) {
    throw new Error('Commitment nonce is invalid.')
  }
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('Fingerprint must be a lowercase SHA-256 hash.')
  }
  return `SP1|${token}|${nonce}|${sha256}`
}

export function createCommitmentNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
