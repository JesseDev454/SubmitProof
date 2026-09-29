export type PolicyExplanationInput = {
  verificationResult: string
  policyResult: string
  uploadedAt: string
  matchedCommitment: { gatewayEventAt: string | null } | null
  policy: { deadlineAt: string; gracePeriodMinutes: number } | null
}

export function explainPolicyResult(input: PolicyExplanationInput): string {
  if (input.policyResult === 'not_applicable') {
    return 'Normal online upload: no SMS commitment was used, so fallback hash and timing checks do not apply. The storage receipt still records the upload.'
  }
  if (input.policyResult === 'qualifies') {
    return 'This fallback qualified: the SMS gateway time was before the saved policy deadline, and the matching file reached storage before the grace window ended.'
  }
  if (input.verificationResult === 'mismatch') {
    return 'The uploaded file does not match a recorded SMS fingerprint. Keep the original file unchanged and check which file you selected.'
  }
  if (input.policyResult === 'does_not_qualify') {
    if (input.matchedCommitment && !input.matchedCommitment.gatewayEventAt) {
      return 'The file fingerprint matched, but the SMS gateway time was not recorded. The policy cannot prove that the commitment was sent before the deadline.'
    }
    if (input.policy && input.matchedCommitment?.gatewayEventAt) {
      const deadline = Date.parse(input.policy.deadlineAt)
      const gatewayTime = Date.parse(input.matchedCommitment.gatewayEventAt)
      if (Number.isFinite(deadline) && Number.isFinite(gatewayTime) && gatewayTime >= deadline) {
        return 'The SMS gateway time was at or after the deadline in the saved policy.'
      }
      const graceEnd = deadline + input.policy.gracePeriodMinutes * 60_000
      const uploadTime = Date.parse(input.uploadedAt)
      if (Number.isFinite(graceEnd) && Number.isFinite(uploadTime) && uploadTime >= graceEnd) {
        return 'The file reached storage at or after the end of the saved grace window.'
      }
    }
    return 'The file was received, but at least one saved fallback rule was not met. The lecturer can review the recorded evidence separately.'
  }
  return 'The file and SMS evidence are recorded separately. The stored result will appear after verification finishes.'
}
