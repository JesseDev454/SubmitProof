# SubmitProof — Product Requirements Document (PRD)

**Project:** SubmitProof  
**Hackathon:** StacStart Borderless Bytes 2026  
**Track:** Access & Inclusion — Education  
**Team:** Goodluck Jesse Kassa + Femi  
**Document status:** Build-week source of truth  
**Version:** 1.0  

---

## 1. Product Summary

SubmitProof is a **submission reliability layer for unreliable connectivity**.

It does **not** try to replace an LMS. Instead, it adds a fallback proof mechanism for deadline-based assignment submission when a student has completed their work but cannot complete the full upload because of poor connectivity.

When normal upload fails, SubmitProof creates a local cryptographic fingerprint of the exact file, sends a tiny commitment over a low-bandwidth fallback channel such as SMS, records a trusted gateway-side timestamp, and later verifies that the uploaded file matches the pre-deadline commitment.

The system does **not** independently decide that a submission is “on time.” It proves facts about the commitment and the later file, while the lecturer’s preconfigured fallback policy determines whether the submission qualifies.

### One-line pitch
> **SubmitProof lets students create verifiable proof of the exact assignment file they had ready before a deadline when poor connectivity prevents the full upload.**

### Product positioning
> **Not another LMS. A reliability layer that existing LMSs and university portals could integrate.**

---

## 2. Problem Statement

Existing assignment systems generally provide strong evidence **after a submission succeeds**. When an upload fails close to a deadline, students may be left with weak evidence such as screenshots, emails, or personal explanations.

This creates a fairness problem in environments where connectivity is unreliable:

- a student may finish their work before the deadline;
- the full file may fail to reach the submission system;
- the system has no trustworthy record of the exact file that existed before the deadline;
- the lecturer must later decide based on weak evidence.

### Working Point of View statement
> **A student submitting coursework over unreliable connectivity needs a lightweight way to create trustworthy evidence of the exact file they had ready before the deadline, because current submission systems usually provide strong proof only after the upload succeeds.**

### How Might We
> **How might we let a student create trustworthy evidence of the exact work they had ready before a deadline without requiring the entire file to successfully upload?**

---

## 3. Design Principles

1. **Human first** — solve the student/lecturer evidence problem, not a technology problem.
2. **Proof before features** — the core commitment + later verification flow matters more than dashboards.
3. **Server/gateway evidence over device claims** — never trust the student’s local clock as authoritative.
4. **Explainable verification** — every status must be understandable to students and lecturers.
5. **Policy before dispute** — lecturers define fallback rules before submissions happen.
6. **Auditability** — commitments, uploads, retries, and policy changes must leave a visible trail.
7. **Minimal data over SMS** — never send assignment contents through SMS.
8. **Graceful failure** — retries, duplicate callbacks, and unavailable providers must not corrupt evidence.
9. **LMS-compatible thinking** — design the hackathon app as a standalone demo, but architect it as a future integration layer.

---

## 4. Target Users

### 4.1 Student
Primary user who needs to submit coursework under potentially unreliable connectivity.

**Needs:**
- know whether their submission is protected;
- create fallback proof quickly;
- later upload the exact file;
- understand whether the file matched;
- access a clear receipt/audit record.

### 4.2 Lecturer
Creates assignments and defines fallback policy.

**Needs:**
- configure deadline and fallback rules;
- see normal submissions and fallback commitments separately;
- inspect commitment/upload timestamps;
- inspect hash match results;
- know whether a submission qualifies under the policy they set;
- review an audit trail rather than rely on student claims.

### 4.3 Future: Institution Admin
**Not part of hackathon MVP.**

Potential responsibilities:
- manage institutions, lecturers, students and courses;
- define institution-wide policies;
- configure SMS providers;
- inspect institution-level audit records.

---

## 5. Roles and Permissions

### Student permissions
- view enrolled assignments;
- view assignment fallback policy;
- select a file;
- generate local file fingerprint;
- attempt normal upload;
- generate fallback commitment;
- send fallback commitment via supported channel;
- upload the actual file later;
- view verification result;
- view/download receipt.

### Lecturer permissions
- create assignments;
- set deadline;
- set file constraints;
- enable/disable fallback before commitments exist;
- configure fallback grace period;
- view assignment submission overview;
- inspect individual submission details;
- view fallback qualification result;
- change permitted assignment settings with audit logging;
- close/archive assignment.

---

## 6. Core MVP User Flow

### 6.1 Lecturer flow
1. Lecturer signs in.
2. Lecturer creates an assignment.
3. Lecturer configures:
   - title;
   - course;
   - description;
   - deadline;
   - allowed file types;
   - maximum file size;
   - connectivity fallback enabled/disabled;
   - grace period for later full upload.
4. Lecturer publishes assignment.
5. Students can see the assignment and fallback rules.

### 6.2 Student normal submission flow
1. Student opens assignment.
2. Student selects finished file.
3. Browser computes SHA-256 locally.
4. Student attempts normal upload.
5. If upload succeeds:
   - server stores file;
   - submission status becomes `SUBMITTED_NORMAL`;
   - receipt is generated;
   - fallback flow is not required.

### 6.3 Student fallback flow
1. Student selects file.
2. Client computes file hash locally.
3. Normal upload fails or student chooses fallback because connection is unstable.
4. SubmitProof generates a compact commitment payload containing opaque identifiers, nonce, and file fingerprint.
5. Student sends the commitment using the configured SMS transport.
6. SMS provider sends the inbound event to the SubmitProof webhook.
7. Backend stores:
   - provider message ID;
   - provider/gateway event timestamp when available;
   - sender number;
   - assignment token;
   - nonce;
   - committed file hash;
   - raw provider event metadata;
   - processing timestamp.
8. Backend validates the commitment.
9. Student sees **Pre-deadline commitment recorded** when confirmation reaches the app.
10. Student retains the original file.

### 6.4 Later upload + verification flow
1. Connectivity returns.
2. Student opens pending fallback submission.
3. Student uploads the original file.
4. Backend computes SHA-256 of uploaded file.
5. Backend compares uploaded hash with stored commitment hash.
6. Policy engine evaluates:
   - was commitment recorded before deadline?;
   - does uploaded file hash match?;
   - was full upload completed within allowed grace period?;
   - does commitment belong to the correct student/assignment?;
7. Result is shown to lecturer and student.

### 6.5 Qualification result
SubmitProof should use factual statuses such as:

- **Verified pre-deadline commitment**
- **File match confirmed**
- **Uploaded within grace period**
- **Qualifies under fallback policy**

Do **not** show “on time” as a universal system judgment.

---

## 7. MVP Scope

### Must Have
- student and lecturer authentication;
- lecturer assignment creation;
- fallback policy configuration;
- student assignment view;
- client-side SHA-256 hashing;
- normal upload attempt;
- fallback commitment generation;
- inbound SMS webhook integration;
- commitment persistence;
- gateway/provider timestamp persistence;
- later file upload;
- backend hash verification;
- fallback policy evaluation;
- lecturer submission review;
- audit trail;
- submission receipt;
- deployed working application.

### Should Have
- dashboard summaries;
- clear loading/error/success states;
- responsive mobile layout;
- Vercel preview deployments;
- SMS sandbox support;
- real shared SMS code if available in time;
- file storage integration;
- downloadable PDF-style receipt or printable receipt page.

### Could Have
- notification emails;
- push notifications;
- institution branding;
- course roster import;
- richer analytics;
- LMS integration demo adapter.

### Explicitly Out of Scope
- full LMS replacement;
- grading engine;
- plagiarism detection;
- attendance;
- course registration;
- AI tutor;
- chat;
- video learning;
- blockchain;
- custom ML model;
- dedicated telecom shortcode provisioning;
- institution admin portal.

---

## 8. Screens

### Student screens
1. Student Login / Access
2. Student Dashboard
3. Assignment Details
4. Submit Assignment
5. Connectivity Fallback
6. Fallback Confirmation
7. Resume Upload / Verification
8. Submission Receipt / Audit

### Lecturer screens
1. Lecturer Dashboard
2. Create Assignment
3. Assignment Details / Submission Overview
4. Student Submission Details
5. Fallback Review
6. Assignment Settings

### Shared screens
1. Landing Page
2. 404 / Error State
3. Profile / Account

### Demo-critical screens
1. Lecturer Create Assignment
2. Student Assignment Details
3. Student Submit Assignment
4. Student Connectivity Fallback
5. Student Resume Upload / Verification
6. Lecturer Student Submission Details / Fallback Review

---

## 9. Submission State Model

Recommended lifecycle:

```text
DRAFT
  ↓
READY_TO_SUBMIT
  ↓
NORMAL_UPLOAD_IN_PROGRESS
  ├──→ SUBMITTED_NORMAL
  └──→ NORMAL_UPLOAD_FAILED
          ↓
FALLBACK_PROOF_GENERATED
          ↓
FALLBACK_COMMITMENT_PENDING
          ↓
FALLBACK_COMMITTED
          ↓
AWAITING_FULL_UPLOAD
          ↓
FULL_UPLOAD_RECEIVED
          ↓
VERIFYING
          ├──→ VERIFIED_MATCH
          ├──→ HASH_MISMATCH
          ├──→ GRACE_PERIOD_EXPIRED
          └──→ INVALID_COMMITMENT
```

Separate **verification** from **policy qualification**:

```text
VERIFIED_MATCH
  + commitment before deadline
  + upload inside grace period
  = QUALIFIES_UNDER_FALLBACK_POLICY
```

---

## 10. Fallback Policy Model

Each assignment may define:

- `fallback_enabled`
- `deadline_at`
- `grace_period_minutes`
- `allowed_file_types`
- `max_file_size_bytes`
- `commitment_required_before_deadline = true`
- `exact_hash_match_required = true`

### Policy rule
A fallback submission qualifies only when:

1. fallback was enabled for the assignment;
2. valid commitment was recorded before the deadline;
3. later uploaded file matches one of that student’s valid commitments;
4. full file upload happens before the grace-period expiry;
5. submission has not been invalidated by assignment closure or another explicit rule.

### Important fairness rule
If commitments already exist, material fallback policy changes must:
- be visible;
- be audit logged;
- not silently rewrite historical evidence.

---

## 11. SMS Commitment Design

### Purpose
Transmit only enough data to prove the file fingerprint and associate it with the correct student/assignment.

### Example conceptual payload
```text
SP1|<assignment_token>|<nonce>|<file_hash>
```

### Do not include
- student name;
- matric number in plain text;
- assignment description;
- file contents;
- email;
- any unnecessary personal data.

### Required server checks
- valid protocol version;
- assignment token exists;
- fallback enabled;
- sender is bound to expected student or valid authenticated fallback identity;
- nonce format valid;
- hash format valid;
- provider message ID has not already been processed;
- commitment is stored idempotently.

### Timestamps to store
- `gateway_event_at` — provider supplied event timestamp when available;
- `webhook_received_at` — when our endpoint received callback;
- `processed_at` — when application logic persisted/processed it.

**Important:** Do not rely solely on the student device clock or server callback-processing time.

---

## 12. Hashing and File Verification

### Client-side
- SHA-256 using Web Crypto API;
- local hashing before fallback proof is generated;
- show user when fingerprint is ready;
- never claim the hash proves authorship.

### Server-side
- compute SHA-256 after later upload;
- compare with all valid commitments for that student/assignment;
- exact equality required for match;
- preserve all commitments instead of overwriting previous ones.

### Hackathon file-size target
Recommended MVP limit: **25–50 MB**.

Reason: browser-native digest APIs are suitable for ordinary documents, but the MVP should not optimize for massive video submissions.

---

## 13. Audit Trail Requirements

Every meaningful action should create an immutable-style audit event.

Example event types:
- `ASSIGNMENT_CREATED`
- `ASSIGNMENT_PUBLISHED`
- `FALLBACK_POLICY_CHANGED`
- `FILE_SELECTED`
- `LOCAL_HASH_GENERATED`
- `NORMAL_UPLOAD_STARTED`
- `NORMAL_UPLOAD_FAILED`
- `FALLBACK_PROOF_GENERATED`
- `SMS_COMMITMENT_RECEIVED`
- `DUPLICATE_COMMITMENT_RECEIVED`
- `FULL_FILE_UPLOADED`
- `HASH_VERIFICATION_PASSED`
- `HASH_VERIFICATION_FAILED`
- `FALLBACK_POLICY_PASSED`
- `FALLBACK_POLICY_FAILED`
- `ASSIGNMENT_CLOSED`

Each event should ideally include:
- actor;
- entity ID;
- event type;
- event timestamp;
- metadata JSON;
- source.

---

## 14. Core Data Model

### `profiles`
- `id`
- `role` (`student`, `lecturer`)
- `full_name`
- `email`
- `phone_number`
- `department`
- `created_at`

### `courses`
- `id`
- `code`
- `title`
- `lecturer_id`
- `created_at`

### `enrollments`
- `id`
- `course_id`
- `student_id`
- `created_at`

### `assignments`
- `id`
- `course_id`
- `title`
- `description`
- `deadline_at`
- `fallback_enabled`
- `grace_period_minutes`
- `max_file_size_bytes`
- `allowed_file_types`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### `commitments`
- `id`
- `assignment_id`
- `student_id`
- `provider_message_id`
- `sender_phone`
- `assignment_token`
- `nonce`
- `file_hash`
- `gateway_event_at`
- `webhook_received_at`
- `processed_at`
- `status`
- `provider_metadata_json`

### `submissions`
- `id`
- `assignment_id`
- `student_id`
- `submission_method` (`normal`, `fallback`)
- `status`
- `original_file_name`
- `storage_path`
- `uploaded_file_hash`
- `uploaded_at`
- `matched_commitment_id`
- `verification_result`
- `policy_result`
- `created_at`
- `updated_at`

### `audit_events`
- `id`
- `actor_id`
- `assignment_id`
- `submission_id`
- `commitment_id`
- `event_type`
- `event_at`
- `source`
- `metadata_json`

---

## 15. API / Route Requirements

Suggested Next.js route handlers:

```text
POST   /api/assignments
GET    /api/assignments/:id
PATCH  /api/assignments/:id
POST   /api/assignments/:id/publish

POST   /api/submissions/normal
POST   /api/submissions/fallback/init
POST   /api/submissions/:id/upload
GET    /api/submissions/:id
GET    /api/submissions/:id/audit

POST   /api/webhooks/africastalking

POST   /api/verification/:submissionId
GET    /api/assignments/:id/submissions
GET    /api/assignments/:id/fallback-review/:submissionId
```

Exact route naming can change, but the responsibilities should remain clear.

---

## 16. Technical Architecture

### Recommended stack
- **Framework:** Next.js + TypeScript
- **Router:** App Router
- **Backend:** Next.js Route Handlers
- **Styling:** Tailwind CSS
- **Validation:** Zod
- **Database:** PostgreSQL
- **Auth:** Supabase Auth or equivalent
- **Storage:** Supabase Storage or equivalent object storage
- **Client hashing:** Web Crypto API
- **SMS:** Africa’s Talking two-way SMS/webhook flow
- **Deployment:** Vercel

### Architecture principle
Use one deployable Next.js application for hackathon speed. Avoid splitting frontend/backend into separate services unless forced by a specific integration.

### Important implementation note
A single Next.js codebase is **not a monorepo**. Keep one repository and one app unless a real need for multiple packages/apps appears.

---

## 17. Suggested Repository Structure

```text
submitproof/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── student/
│   │   ├── lecturer/
│   │   └── api/
│   │       ├── assignments/
│   │       ├── submissions/
│   │       ├── verification/
│   │       └── webhooks/
│   │           └── africastalking/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── student/
│   │   └── lecturer/
│   │
│   ├── features/
│   │   ├── assignments/
│   │   ├── submissions/
│   │   ├── fallback/
│   │   └── verification/
│   │
│   ├── lib/
│   │   ├── db/
│   │   ├── auth/
│   │   ├── hashing/
│   │   ├── sms/
│   │   └── validation/
│   │
│   ├── types/
│   └── utils/
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DEMO_FLOW.md
│
├── public/
├── README.md
└── package.json
```

---

## 18. Git Workflow

### Branch model
```text
main
├── feat/student-submission-flow
├── feat/lecturer-assignment-flow
├── feat/sms-webhook
├── feat/hash-verification
├── feat/audit-trail
└── fix/<issue-name>
```

### Rules
- no direct feature work on `main`;
- `main` should remain deployable;
- use short-lived feature branches;
- open PR for meaningful changes;
- teammate reviews before merge where practical;
- delete merged branches;
- pull latest `main` before starting dependent work;
- prefer small PRs over giant multi-feature PRs.

---

## 19. Team Ownership

### Goodluck
Primary ownership:
- database/schema;
- assignment/submission APIs;
- commitment model;
- SMS webhook;
- SHA-256 verification backend;
- audit events;
- policy engine;
- deployment/backend debugging.

### Femi
Primary ownership:
- app shell/design system;
- student screens;
- lecturer screens;
- forms;
- client-side state;
- API integration;
- responsive behavior;
- loading/error/success states;
- demo UI polish.

### Shared ownership
- fallback flow;
- end-to-end integration;
- testing;
- demo script;
- PR review.

---

## 20. Error and Edge Cases

The MVP must handle at least:

### Connectivity
- normal upload times out;
- connection drops mid-upload;
- student triggers fallback after upload failure;
- connectivity returns before SMS is sent.

### SMS
- callback arrives twice;
- callback arrives after retry;
- invalid token;
- invalid hash;
- unknown sender;
- SMS provider unavailable;
- gateway timestamp unavailable;
- commitment arrives after deadline.

### Files
- uploaded file differs from committed file;
- file too large;
- unsupported extension;
- student sends multiple pre-deadline commitments;
- later upload matches one of several valid commitments.

### Policy
- fallback disabled;
- grace period expired;
- assignment closed;
- lecturer changes policy after commitments exist;
- commitment exists but file never arrives.

### Security
- replayed SMS;
- duplicate webhook;
- tampered assignment token;
- user attempts to access another student’s submission;
- untrusted metadata rendered in UI.

---

## 21. Security and Privacy Requirements

- never trust client-provided time as authoritative;
- validate all API inputs;
- protect webhook endpoint against malformed data;
- make webhook processing idempotent;
- use authorization checks for lecturer/student routes;
- avoid exposing private SMS metadata publicly;
- do not include file content in SMS;
- minimize personal data in commitment payload;
- secure uploaded file access;
- do not expose service-role/database secrets to browser;
- log policy changes;
- do not describe users as fraudulent based only on system mismatch;
- retain only the provider metadata needed for audit/debugging.

---

## 22. User Validation Plan

Before or during early build:

### Students
Target: at least 5 real students.

Ask about the **last real incident**, not hypotheticals:
- last time they submitted near a deadline;
- whether upload ever froze/failed/completed late;
- what they did;
- what evidence they had;
- what lecturer accepted;
- most frustrating part;
- reaction to a lightweight fallback proof step.

### Lecturers
Target: at least 1–3 lecturers.

Ask:
- how they handle network-related late submission claims;
- what evidence students currently provide;
- what evidence they trust;
- whether a preconfigured fallback policy would be useful;
- how they would want evidence displayed.

### Required artifact
Create a short document summarizing:
- participants;
- recurring pain points;
- contradictions;
- changes made to the product because of interviews.

Do not invent validation numbers.

---

## 23. Demo Flow

The final demo should prioritize one complete transformation.

### Recommended demo
1. Lecturer creates assignment.
2. Lecturer enables connectivity fallback and defines grace period.
3. Student opens assignment.
4. Student selects file.
5. SHA-256 fingerprint is generated locally.
6. Simulate/trigger normal upload failure.
7. Student generates fallback proof.
8. SMS commitment reaches provider/webhook.
9. Lecturer/backend records commitment timestamp.
10. Deadline passes in demo scenario.
11. Connectivity returns.
12. Student uploads same file.
13. Backend computes uploaded hash.
14. Hashes match.
15. Policy engine checks deadline + grace period.
16. Lecturer sees:
   - Verified pre-deadline commitment;
   - File match confirmed;
   - Uploaded within grace period;
   - Qualifies under fallback policy.
17. Optional: upload modified file to show hash mismatch.

### Demo principle
Do not lead with dashboards or architecture. Lead with the failure and the proof.

---

## 24. Success Metrics for the Hackathon MVP

### Technical success
- end-to-end flow works in deployed environment;
- client hash matches server hash for unchanged file;
- modified file reliably fails verification;
- SMS/sandbox callback is persisted correctly;
- duplicate webhook does not create duplicate commitments;
- policy result is deterministic;
- audit trail shows the full sequence.

### Product success
- a student can understand fallback without explanation;
- a lecturer can understand why a submission qualifies;
- fallback status is not confused with “normal upload completed”;
- UI clearly distinguishes evidence from policy decision.

### Demo success
A judge should understand the core value within roughly 30–60 seconds.

---

## 25. Definition of Done

SubmitProof MVP is done when:

- [ ] lecturer can create and publish an assignment;
- [ ] fallback can be enabled with a grace period;
- [ ] student can view assignment and rules;
- [ ] student can select a file;
- [ ] client can generate SHA-256 fingerprint;
- [ ] normal upload path exists;
- [ ] failed upload can enter fallback path;
- [ ] compact fallback commitment can be generated;
- [ ] SMS/sandbox webhook can receive commitment;
- [ ] provider message ID and timestamp data are stored;
- [ ] duplicate callbacks are idempotent;
- [ ] student can later upload the file;
- [ ] backend computes uploaded file hash;
- [ ] file match/mismatch is shown correctly;
- [ ] fallback policy is evaluated;
- [ ] lecturer can inspect submission evidence;
- [ ] audit trail is visible;
- [ ] receipt is available;
- [ ] core flow is deployed;
- [ ] README explains architecture and limitations;
- [ ] demo is rehearsed;
- [ ] backup demo recording exists.

---

## 26. Open Questions / Risks

1. **SMS provider timestamp semantics**  
   Confirm exactly what provider timestamp represents before describing it as a trusted ingress timestamp.

2. **Production Nigerian inbound SMS availability**  
   Build against the real webhook contract, but keep provider sandbox as guaranteed demo fallback.

3. **Database/storage provider**  
   Supabase is the preferred simple stack if the team has an available project. If account/project limits block deployment, switch to an equivalent hosted PostgreSQL + object storage setup without changing product architecture.

4. **Student/lecturer validation**  
   User interviews may reveal the failure mode is rarer or handled differently than expected. Adjust copy/flow if evidence contradicts assumptions.

5. **Institutional acceptance**  
   SubmitProof provides evidence; institutional policy determines whether that evidence is sufficient. The product must not overclaim.

6. **SMS delivery delay**  
   A message delayed by the carrier until after the deadline cannot be treated as pre-deadline proof merely because the student claims they pressed Send earlier.

---

## 27. Post-Hackathon Direction

If validated, evolve SubmitProof into an integration layer rather than a full LMS.

Potential integrations:
- Moodle plugin;
- Canvas integration;
- university portal SDK/API;
- LMS webhook adapter;
- institution-wide fallback policy engine.

Potential future features:
- multiple fallback transports;
- institution policy templates;
- stronger attestation mechanisms;
- analytics for failed uploads/connectivity incidents;
- configurable retention and privacy controls;
- administrator console;
- institutional SSO.

---

## 28. Product Statement to Keep the Team Aligned

> **SubmitProof does not prove that a student “submitted on time.” It proves that a specific file was committed at a recorded time, verifies whether the later uploaded file is identical, and evaluates that evidence against a fallback policy defined in advance.**

If a feature does not strengthen that workflow during Build Week, it is probably not MVP.
