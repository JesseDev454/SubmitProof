# SubmitProof API (Phase 2)

All routes return `{ "data": ... }` on success and `{ "error": { "code": "...", "message": "..." } }` on failure. Protected routes require a valid Supabase Auth cookie. Roles come from `profiles`; caller-supplied actor IDs and signup metadata are never authorization inputs. Mutating browser requests must have the same Origin as the application.

Unauthenticated requests return `401`; inaccessible resources return `404`; invalid bodies return `400`; role violations return `403`; lifecycle conflicts return `409`. Responses do not expose database messages or service credentials.

## Assignments

| Method and path | Role | Behavior |
|---|---|---|
| `GET /api/assignments` | Student or lecturer | Lists assignments allowed by RLS with their current readable policy |
| `POST /api/assignments` | Lecturer | Creates a draft, first policy version, and audit event atomically |
| `GET /api/assignments/:id` | Student or lecturer | Reads an authorized assignment and policy |
| `PATCH /api/assignments/:id` | Lecturer | Edits a draft; material policy edits append an immutable version |
| `POST /api/assignments/:id/publish` | Lecturer | Publishes a valid draft and locks its policy |
| `POST /api/assignments/:id/close` | Lecturer | Closes a published assignment |
| `GET /api/assignments/:id/submissions` | Lecturer | Lists submissions, commitments, and upload results for the owned assignment |
| `GET /api/assignments/:id/my-submission` | Enrolled student | Returns `{ "data": null }` before a submission exists; otherwise returns the student's submission, commitments, uploads, and readable policy snapshots. Token hashes, raw tokens, and storage object paths are omitted. |
| `POST /api/assignments/:id/archive` | Owning lecturer | Archives a closed assignment and appends an audit event; repeated calls are idempotent |

`GET /api/assignments?archived=true` lists archived assignments for the caller. `?archived=false` lists unarchived assignments. With no `archived` filter, the prior unfiltered behavior is retained.

Create an assignment with:

```json
{
  "courseId": "<course UUID>",
  "title": "Field report",
  "description": "Optional instructions",
  "policy": {
    "deadlineAt": "2026-10-01T12:00:00Z",
    "fallbackEnabled": true,
    "gracePeriodMinutes": 30,
    "allowedMimeTypes": ["application/pdf"],
    "maxFileSizeBytes": 10485760
  }
}
```

Supported detected file types are PDF, PNG, JPEG, and UTF-8 text. The server compares the detected type with the declared type and the published assignment policy.

## Commitments

`POST /api/assignments/:id/fallback-token` accepts `{ "rotate": false }`. It returns the opaque token once; only the token hash and registered-phone snapshot are stored. Set `rotate` to `true` only when intentionally revoking and replacing an active token.

If an active token already exists, requesting another with `rotate: false` returns `409` with code `token_rotation_required`. The student UI must ask the student to explicitly rotate; rotation revokes the earlier token. The raw token is never placed in a URL.

The student builds the SMS payload as `SP1|<token>|<nonce>|<lowercase-sha256>`. Nonces use 8–128 URL-safe characters; the fingerprint is exactly 64 lowercase hexadecimal characters. Keep the raw token out of application logs.

`POST /api/dev/simulate-sms` accepts `{ "payload": "SP1|..." }` and is available only when `ENABLE_SIMULATED_SMS=true` outside production. It uses the signed-in student’s registered phone and server time, then calls the same provider-independent processor as a future gateway adapter. Simulated evidence is marked `provider: "simulated"`; it does not demonstrate carrier delivery.

### Africa's Talking inbound SMS callback

`POST /api/webhooks/africastalking?key=<AFRICASTALKING_CALLBACK_SECRET>` accepts Africa's Talking's `application/x-www-form-urlencoded` incoming SMS callback (`from`, `to`, `text`, `date`, and `id`). Configure `AFRICASTALKING_CALLBACK_SECRET` as a random secret of at least 32 characters and `AFRICASTALKING_SHORTCODE` to the shortcode assigned to the app. The handler compares the secret in constant time, checks the destination shortcode and sender phone, and accepts only the `SP1|<token>|<nonce>|<lowercase-sha256>` message format. It stores a hash of the token, never the raw token or SMS body.

The route acknowledges recorded acceptances, rejections, and duplicate deliveries with HTTP 200 so invalid messages are not retried indefinitely. Database processing failures return HTTP 503 so Africa's Talking can retry. The provider message ID makes retries idempotent; callback events remain in the webhook audit table. Only an ISO 8601 callback `date` with an explicit timezone is used as gateway time. Missing or timezone-ambiguous dates are retained as no trusted gateway timestamp and cannot establish pre-deadline proof.

To connect a hosted environment, add `AFRICASTALKING_SHORTCODE`, `AFRICASTALKING_CALLBACK_SECRET`, `NEXT_PUBLIC_FALLBACK_SMS_NUMBER`, and `NEXT_PUBLIC_AFRICASTALKING_SMS_ENABLED=true` to the Vercel Production environment. Set the enabled flag only after the callback is configured. Deploy, then set the SMS inbox callback URL in the Africa's Talking app to `https://<your-domain>/api/webhooks/africastalking?key=<same-secret>`. The student fallback screen will show the shortcode, offer the phone's SMS composer, and let the student check for the server's confirmation. Use the app's Sandbox callback/simulator for test traffic; sandbox shortcode messages are not carrier delivery to a handset. Keep the callback URL private because its query parameter is the callback credential. Apply all committed Supabase migrations before enabling the callback.

## Upload and verification

`POST /api/assignments/:id/uploads` accepts:

```json
{
  "kind": "fallback",
  "mimeType": "application/pdf",
  "fileSizeBytes": 348129,
  "idempotencyKey": "<unique key reused only for this request retry>"
}
```

The response includes a reservation ID, a staging object path, and a signed upload URL. Upload the selected bytes directly to that signed URL with `upsert: false`; do not send file bytes to a Next.js route. `POST /api/uploads/:id/complete` reads the staged object server-side, checks its actual size and signature, hashes the bytes, and stores the immutable final object under `assignment_id/student_id/submission_id/upload_id`.

The completion result keeps `verificationResult` (`match`, `mismatch`, or `not_applicable`) separate from `policyResult` (`qualifies`, `does_not_qualify`, or `not_applicable`). Storage object creation time is used for the upload receipt time; finalization time is also recorded. Both deadline and grace comparisons are strict: an event exactly at the boundary does not qualify.

| Method and path | Role | Behavior |
|---|---|---|
| `GET /api/submissions/:id` | Student or owning lecturer | Reads the authorized submission and evidence |
| `GET /api/submissions/:id/audit` | Student or owning lecturer | Reads the related audit events |
| `GET /api/uploads/:id/download` | Student who owns the upload or owning lecturer | Returns a 60-second signed download URL for finalized evidence only |
| `POST /api/submissions/:id/review` | Owning lecturer | Appends a separate `accepted` or `flagged` human decision and audit event. Accepting an upload that does not qualify under policy requires a reason; a flagged item can later be accepted. Stored verification and policy results are unchanged. |

`GET /api/profile/notifications` reads the signed-in user's preferences; `PATCH /api/profile/notifications` updates that user's four email preferences. `PATCH /api/profile` updates only the signed-in user's name, department, and E.164 phone. Password changes use Supabase Auth directly in the shared profile form.

`GET /api/cron/notifications` requires `Authorization: Bearer $CRON_SECRET`. It transactionally enqueues opted-in reminders for enrolled students with no finalized upload when the published assignment deadline is within 24 hours, then drains a bounded batch of the email outbox. Provider failures remain retryable. Configure the daily schedule in `vercel.json`; set `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `NEXT_PUBLIC_APP_URL` in deployment settings. `EMAIL_ADAPTER=fake` is permitted only outside production.

The controlled real-provider smoke test reads `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_TEST_RECIPIENT` from the environment and sends only to that designated mailbox:

```sh
npm run email:smoke
```

Closing an assignment prevents new tokens and commitments. Students with existing submissions can still read their evidence and current policy. Existing fallback commitments can receive an upload reservation and be evaluated against their original policy/grace window.

## Local verification

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:lint
npm run db:types:check
npm run lint
npm run typecheck
npm run build
npm test
npm run test:integration
npm run test:e2e
```

The integration script reads local credentials from `supabase status`, starts a Next.js development server, creates isolated test users/course/enrollment fixtures, exercises the protected APIs and signed Storage upload, then stops the server. It refuses to run against a non-local Supabase URL. `npm run db:uploads:cleanup` is a dry run; add `--apply` to remove expired or finalized staging objects after signed upload links have expired.

The browser test suite exercises both role-aware sign-in flows, normal and simulated fallback submission, confirmation after reload, matching and mismatching uploads, receipt and signed file access, and unrelated-student denial. The lecturer flow covers publish failure with a retained draft, successful publication, human review without rewriting evidence results, close/archive, archived listing, and persisted profile preferences. The suite needs the local Supabase stack and Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```
