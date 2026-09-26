# Phase 2 architecture

SubmitProof is a single Next.js application backed by Supabase. Route Handlers authenticate the cookie session with Supabase Auth, read the current role from the caller’s RLS-protected profile row, validate request bodies with Zod, and return a stable JSON envelope. Server-only services hold privileged database and Storage clients. The service-role key never reaches a browser bundle.

## Writes and evidence

Multi-row assignment, token, callback, upload reservation, and finalization operations run through narrowly granted Postgres functions with fixed search paths. Those functions receive the verified profile ID from the route, check the current role and ownership/enrollment again, and write the related audit record in the same transaction. Authenticated users retain RLS-protected reads; clients cannot write evidence tables or private bucket objects directly.

Assignments begin as drafts. Creating or editing a draft writes immutable policy versions. Publishing freezes the policy; closing blocks new fallback tokens and commitments while preserving the policy and evidence for students who already have a submission.

## Commitment adapter

The provider-independent commitment processor parses the `SP1` message, hashes the opaque token, checks the sender against its registered-phone snapshot, and persists accepted, duplicate, or rejected callback outcomes. The simulated adapter uses the authenticated student’s stored phone and server time. It is enabled only in local/test environments and always records `provider: simulated`. The real SMS provider transport is a later adapter; no production endpoint pretends to be a gateway.

## Upload lifecycle

1. A student reserves an upload; the database creates the logical submission if necessary and stores a two-hour staging reservation.
2. The server returns a non-upserting signed upload URL. The browser transfers bytes directly to the private `submission-files` bucket.
3. The completion route reads Storage metadata and bytes, checks the actual size and file signature, computes SHA-256 on the server, and copies those exact bytes to the server-only final path.
4. A locked Postgres function finalizes the reservation once, compares the server hash against all applicable commitments, chooses a qualifying exact match when one exists, and records separate verification and policy results.
5. Staging files are removed after success. The retryable cleanup script handles old reservations and staging remnants after signed URLs expire.

The verified storage object creation time is the upload receipt evidence; route arrival or finalization time cannot make an upload that arrived late appear timely. Commitments without a provider event time are retained but cannot establish pre-deadline eligibility.

## Boundaries

- Courses and enrollments are provisioned fixtures in this phase; course administration is not implemented.
- Supabase Auth supplies identities; profile roles are trusted only after a server-side profile lookup.
- File signatures currently support PDF, PNG, JPEG, and UTF-8 text.
- No Africa’s Talking credentials, live SMS endpoint, UI integration, or hosted deployment is part of this phase.
- Supabase’s signed upload URL has a fixed two-hour validity. The database reservation uses the same expiry and finalization validates the Storage creation timestamp.
