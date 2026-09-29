# SubmitProof demo and defense guide

## One-minute explanation

SubmitProof adds a proof layer to an existing assignment workflow. A student normally uploads a file over the internet. If data connectivity fails, a prepared student can send an SMS containing a one-time assignment token and the SHA-256 fingerprint of the file. The SMS does not contain the file. When internet access returns, the student uploads the unchanged file. The server hashes the stored bytes and compares them with the recorded fingerprint. The lecturer sees the file, timing evidence, policy result, and a separate human review decision.

The fallback is an SMS path for the commitment, not a fully offline website. The student must sign in and obtain a token while connected, and must have cellular SMS service. Uploading the file later requires internet access.

## What to demonstrate

1. **Online upload:** Publish an assignment in a course with an enrolled student. Have the student upload a PDF normally. Open the receipt. `Workflow: Complete` and a storage receipt confirm that the server received a file. `Verification: Not applicable` and `Policy: Not applicable` mean no SMS commitment was used.
2. **SMS fallback:** Use another assignment with fallback enabled, a future deadline, and a positive grace period. On the student screen, select the original file, request a token while online, and copy the generated `SP1` message. Send it from the registered number through Africa's Talking Sandbox simulator to the configured shortcode. Wait for SubmitProof to show a recorded commitment with source `africastalking`. The Africa's Talking Inbox and SubmitProof confirmation together demonstrate the Sandbox callback path.
3. **File match:** Upload the same original bytes. Show `Verification: Match`, the server-computed SHA-256, and the evidence history. Changing or resaving the file changes its fingerprint and produces a mismatch.
4. **Policy and review:** Show the policy result separately. Automatic fallback qualification requires a trusted gateway time before the deadline and a storage receipt before the deadline plus grace. A `0` minute grace period gives no after-deadline upload window. If `Gateway: Not recorded`, the app cannot automatically qualify the commitment even if the file matches. The lecturer can make an auditable human decision, which does not rewrite verification or policy evidence.

Do not describe the Africa's Talking Sandbox simulator as a real handset or carrier delivery test. A live handset test needs an approved live shortcode and callback configuration.

## How to read the three results

| Result | Meaning |
|---|---|
| Workflow `Complete` | A file upload was finalized. |
| Verification `Match` | The uploaded bytes have the same SHA-256 fingerprint as a recorded SMS commitment. |
| Verification `Not applicable` | This was a normal upload without an SMS fingerprint to compare. |
| Policy `Qualifies` | The saved fallback deadline and grace checks passed. |
| Policy `Does not qualify` | At least one fallback rule failed or trusted gateway time is unavailable. Check the receipt explanation and timestamps. |
| Policy `Not applicable` | No fallback policy check was needed for the normal upload. |

## Questions judges may ask

**Can a student claim any file was sent before the deadline?** The SMS commits only to a SHA-256 fingerprint. The server later hashes the actual uploaded bytes and requires an exact match. The token is tied to the assignment, student, and registered phone snapshot. The recorded provider callback and audit trail show when evidence entered the system.

**Can a delayed SMS still count?** Automatic qualification uses the trusted gateway timestamp and the saved assignment policy. A missing gateway timestamp cannot establish pre-deadline proof. A delayed callback can still carry a qualifying gateway time if the provider supplies one with an unambiguous timezone.

**Does the file upload work without internet?** No. SMS can carry the compact commitment while mobile data is unavailable; the full file is uploaded once internet returns.

**What has been proved so far?** The Sandbox Inbox and SubmitProof confirmation prove the simulator-to-webhook path. A matching receipt proves server-side file hashing and comparison. If the receipt says `Gateway: Not recorded`, automatic policy qualification has not been demonstrated. Resolve timestamp capture and repeat the test before claiming that part of the flow works end to end.
