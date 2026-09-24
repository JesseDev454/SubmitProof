# Repeatable Phase 2 demonstration

Use the automated local flow as the reliable backend demo while the UI screens are still being integrated.

1. Start Docker Desktop’s Linux engine, then run `npm ci`, `npm run db:start`, and `npm run db:reset`.
2. Run `npm test` to show the protocol parser, strict deadline/grace boundaries, exact hash matching, and file-signature checks.
3. Run `npm run test:integration`. The script discovers the local Supabase URL and keys, starts Next.js, creates fresh lecturer/student fixtures, and drives the API.
4. The script creates and publishes an assignment, issues a one-time hashed fallback token, records a simulated `SP1` commitment, transfers a small PDF over a signed private Storage URL, and finalizes server-side hash verification.
5. It retries the same callback and upload completion to demonstrate idempotency, then verifies a lecturer can read evidence while unrelated users receive not-found responses.
6. It closes the assignment, shows the student can still read the existing policy/evidence and complete another already-committed fallback upload, then confirms the simulator rejects a new commitment.

The simulator is an application-flow stand-in; it does not prove SMS carrier delivery. Phase 1/2 database and API checks run in the pull-request workflow using a clean local Supabase stack. Docker can be replaced for local work by allowing the workflow to run in CI, but the local integration script itself requires a running Supabase stack.
