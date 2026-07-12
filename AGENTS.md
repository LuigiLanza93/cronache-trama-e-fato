# Project agent guidance

## Mandatory local context

- Read `codex-readme.md` before planning implementation, database, Git, release, or Railway work. It is the local operational source of truth and must be kept current when those workflows or the active work change.
- The canonical production data live on Railway at `/data/migration.db`. `prisma/migration.db` is the active local development database: on `dev`, keep its schema aligned with new migrations so features can be tested end to end. It may be freely mutated for local development, but its data are never production truth.
- Develop and leave changes uncommitted on `dev` until the user confirms a successful test. Commit/push to `dev` only after that confirmation. Merge, push, or deploy `main` only on explicit user request.

## Project map

- Frontend: React 18, TypeScript, Vite, Radix/shadcn components under `src/`.
- Backend and realtime: Express and Socket.IO in `server.js`.
- Persistence: SQLite at runtime, with `prisma/schema.prisma` as the schema source of truth and migrations under `prisma/migrations/`.
- Domain data and rules: character calculations in `src/lib/`, reusable rules in `shared/`, structured content in `src/data/`, and maintenance scripts in `scripts/`.
- Historical JSON under `src/data/JSON_LEGACY/` is normally reference/import input, not the active runtime store.

## Delegation

The user should only need to describe the desired outcome. Automatically decide whether delegation is useful, select the appropriate project subagents from their descriptions, and orchestrate them without requiring the user to name an agent.

Use project subagents for substantial work when their specialty materially improves speed or correctness:

- `frontend_ui` for screens, components, styling, accessibility, and client state.
- `backend_realtime` for Express routes, auth, Socket.IO, and server-side persistence behavior.
- `database_migrations` for Prisma, SQLite, migrations, imports, and backfills.
- `game_rules_data` for RPG rules, derived statistics, items, spells, monsters, and structured content.
- `release_railway` for the controlled dev-to-main production release: preflight, Railway backup, migration/deploy sequencing, health checks, smoke tests, and rollback readiness.
- `quality_security` for a read-only final review of risky or cross-cutting changes.

Do not ask the user which subagent to use when the task and these role descriptions provide enough information. If more than one specialty applies, choose the smallest sufficient set automatically. Do not delegate trivial single-file edits. For cross-cutting tasks, delegate independent investigation first, then give each writing agent a disjoint file boundary. Never let multiple agents edit the same file concurrently. The root agent owns integration decisions, resolves contract changes, and runs final verification.

After implementation, automatically use `quality_security` when changes affect authentication, authorization, user data, database migrations, uploads, filesystem paths, Socket.IO concurrency, or multiple architectural layers. For low-risk localized changes, the root agent may perform final verification directly.

Use `release_railway` only when the user explicitly requests or authorizes the production release. A production release is one indivisible workflow: verify and merge `dev` into `main`, then deploy that exact `main` state to Railway and perform post-deploy checks. Do not merge to `main` without continuing to Railway, and do not deploy an unmerged development working tree as the production release. Database-affecting releases require a fresh verified Railway backup before migration or deploy.

Keep delegation depth at one. Subagents must not recursively spawn more agents unless the user explicitly requests it and the project configuration is deliberately changed.

## Safety and data

- Do not modify Railway SQLite data unless the user explicitly asks for that exact production mutation. The local development database `prisma/migration.db` may be migrated, seeded, or changed as a normal development step on `dev`; preserve production separation and never use it to overwrite Railway.
- Keep `prisma/migration.db` structurally aligned with migrations needed by the current `dev` code and use it for end-to-end local testing. A successful local test still does not prove that Railway has been migrated or that production data match local data.
- Before any production schema change, import, backfill, or risky deploy: make a fresh Railway backup with the documented backup flow, use additive/restart-safe SQL, define verification and rollback, and require an explicit production action from the user.
- Do not use `prisma db push` against Railway. Production schema SQL must be reviewed and applied through the documented controlled Railway procedure.
- Test destructive migrations or backfills only against disposable copies.
- Preserve DM/player authorization, character ownership checks, persistent volume paths, and backward compatibility with existing campaign data.
- Treat `prisma/schema.prisma` as authoritative, but verify direct SQL in `server.js` and scripts before changing tables or columns.

## Verification

- Run `npm run build` for implementation changes that can affect the shipped application.
- Run `npx prisma validate` for Prisma schema changes.
- Use targeted checks for migrations, importers, realtime flows, and authorization boundaries.
- Report any verification that could not be run and the remaining risk.
