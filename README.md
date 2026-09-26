See /docs/PRD.md for the full product spec.

# SubmitProof

## Local database development

The database is defined by versioned SQL migrations in `supabase/migrations`. Run the local Supabase stack with [Docker Desktop](https://docs.docker.com/desktop/) running and its Linux engine available.

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:lint
npm run db:types:check
npm run lint
npm run typecheck
```

`npm run db:types` regenerates `src/types/database.types.ts` after a schema change. `npm run db:stop` stops the local stack when you are done. Local credentials and Supabase runtime state are not committed.

## Phase 2 verification

```sh
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run db:uploads:cleanup
```

The integration script creates temporary local users and drives the authenticated assignment, simulated commitment, private upload, verification, and lecturer review APIs. The browser suite exercises the student submission flow end to end. Both suites require the local Supabase stack and refuse to use a non-local Supabase endpoint. The simulator is for local/test environments only; live SMS transport is not enabled. See [the API contract](docs/API.md), [architecture notes](docs/ARCHITECTURE.md), and [demo steps](docs/DEMO_FLOW.md).
