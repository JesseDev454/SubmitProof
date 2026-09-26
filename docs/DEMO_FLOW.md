# Repeatable SubmitProof demonstration

Use the API integration script to demonstrate the backend evidence lifecycle and the browser suite to demonstrate the student UI. Both use fresh local fixtures.

1. Start Docker Desktop’s Linux engine, then run `npm ci`, `npm run db:start`, and `npm run db:reset`.
2. Run `npm test` to show the protocol parser, strict deadline/grace boundaries, exact hash matching, and file-signature checks.
3. Run `npm run test:integration`. The script discovers the local Supabase URL and keys, starts Next.js, creates fresh lecturer/student fixtures, and drives the API.
4. The script creates and publishes an assignment, issues a one-time hashed fallback token, records a simulated `SP1` commitment, transfers a small PDF over a signed private Storage URL, and finalizes server-side hash verification.
5. It retries the same callback and upload completion to demonstrate idempotency, then verifies a lecturer can read evidence while unrelated users receive not-found responses.
6. It closes the assignment, shows the student can still read the existing policy/evidence and complete another already-committed fallback upload, then confirms the simulator rejects a new commitment.

7. Install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. The browser fixture creates a lecturer, an enrolled student, and an unrelated student; it signs in through the shared role-aware login, submits a normal upload, records and reloads a simulated fallback commitment, verifies matching and mismatching files, downloads through the signed file link, and confirms an unrelated student cannot read the assignment. It also forces an upload reservation error and checks that the UI reports the error without showing a receipt.

The simulator is an application-flow stand-in; it does not prove SMS carrier delivery. Database, API, and browser checks run in the pull-request workflow using a clean local Supabase stack. The local commands require Docker Desktop’s Linux engine to be available.
