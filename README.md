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
