# Project agent guidance

## Mandatory local context

- Read `codex-readme.md` before planning implementation, database, Git, release, or Railway work. It is the local operational source of truth and must be kept current when those workflows or the active work change. It is intentionally ignored by Git: if absent in a fresh clone/worktree, use this file, `docs/codex-workspace.md`, and the relevant tracked roadmap/runbook. Reconstruct local context from verified facts; missing local notes alone do not block development. Historical notes are not evidence of current branch, test, or production state.
- The canonical production data live on Railway at `/data/migration.db`. `prisma/migration.db` is the active local development database: on `dev`, keep its schema aligned with new migrations so features can be tested end to end. It may be freely mutated for local development, but its data are never production truth.
- Develop and leave changes uncommitted on `dev` until the user confirms a successful test. Commit/push to `dev` only after that confirmation. Merge, push, or deploy `main` only on explicit user request. Production releases must merge `dev` into `main` with an explicit `--no-ff` merge commit so the release boundary remains visible in Git history; do not squash or fast-forward release merges by default.

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
- `git_finalize` for the mechanical commit and push to `dev` only after the user confirms successful testing and the root agent supplies the exact approved file scope.

Do not ask the user which subagent to use when the task and these role descriptions provide enough information. If more than one specialty applies, choose the smallest sufficient set automatically. Do not delegate trivial single-file implementation edits; `git_finalize` is the explicit exception for the separate post-test commit/push phase. For cross-cutting tasks, delegate independent investigation first, then give each writing agent a disjoint file boundary. Never let multiple agents edit the same file concurrently. The root agent owns integration decisions, resolves contract changes, and runs final verification.

After implementation, automatically use `quality_security` when changes affect authentication, authorization, user data, database migrations, uploads, filesystem paths, Socket.IO concurrency, or multiple architectural layers. For low-risk localized changes, the root agent may perform final verification directly.

Use `release_railway` only when the user explicitly requests or authorizes the production release. A production release is one indivisible workflow: verify `dev`, merge it into `main` with `git merge --no-ff dev` and an explicit release message, then deploy that exact `main` state to Railway and perform post-deploy checks. Do not use a fast-forward or squash merge for the release unless the user explicitly overrides this convention. Do not merge to `main` without continuing to Railway, and do not deploy an unmerged development working tree as the production release. Database-affecting releases require a fresh verified Railway backup before migration or deploy. After a successful release and verification, fast-forward local `dev` to the deployed `main` tip and push `origin/dev` so future development starts from the exact production state; preserve any unrelated uncommitted user files while doing so.

Use `git_finalize` only for completed, verified work after explicit user test confirmation. It may stage only the exact paths approved by the root agent and push only to `origin/dev`; it must never edit implementation files, operate on `main`, rewrite history, deploy, or touch Railway or databases. The root agent remains responsible for deciding that the change is ready and defining the commit boundary.

Keep delegation depth at one. Subagents must not recursively spawn more agents unless the user explicitly requests it and the project configuration is deliberately changed.

### Plus usage budget

- Use at most two concurrent subagents and the smallest useful total number of agents. A concurrency cap alone does not reduce total usage: avoid duplicate investigations, redundant reviews, and splitting a simple task across agents.
- Generic agents default to `gpt-5.6-terra` with `medium` reasoning. Keep `frontend_ui` and routine `game_rules_data` work on Terra/medium, and `git_finalize` on Terra/low. Keep Sol/high for `backend_realtime`, `database_migrations`, `quality_security`, and `release_railway` because their assigned work involves correctness or production risks.
- Give each subagent a bounded task, relevant paths, decisions already made, and expected output. Prefer a concise handoff over inheriting the entire conversation when the task is self-contained. Reuse an existing agent for related follow-ups. Return findings and verification summaries rather than full logs; do not repeat successful checks without a new reason.
- For complex cross-class rules, persistence design, or a demonstrated unresolved issue, the root should first integrate the evidence with Sol/high. Reserve GPT-6 Astra/medium or high for exceptional reasoning tasks; it is not a routine subagent default. Preserve specialist file instructions when using a generic agent for such a task. Custom-agent model/effort settings take precedence over spawn defaults: do not assume an explicit spawn override changes a pinned specialist.
- Keep required quality/security review and Git/release authorization gates. Usage savings must come from focused work, not skipping required checks. Never buy credits or change billing settings as part of task routing.

## Safety and data

- Do not modify Railway SQLite data unless the user explicitly asks for that exact production mutation. The local development database `prisma/migration.db` may be migrated, seeded, or changed as a normal development step on `dev`; preserve production separation and never use it to overwrite Railway.
- Keep `prisma/migration.db` structurally aligned with migrations needed by the current `dev` code and use it for end-to-end local testing. A successful local test still does not prove that Railway has been migrated or that production data match local data.
- Before any production schema change, import, backfill, or risky deploy: make a fresh Railway backup with the documented backup flow, use additive/restart-safe SQL, define verification and rollback, and require an explicit production action from the user.
- Do not use `prisma db push` against Railway. Production schema SQL must be reviewed and applied through the documented controlled Railway procedure.
- Test destructive migrations or backfills only against disposable copies.
- Preserve DM/player authorization, character ownership checks, persistent volume paths, and backward compatibility with existing campaign data.
- Treat `prisma/schema.prisma` as authoritative, but verify direct SQL in `server.js` and scripts before changing tables or columns.

## Verification

- On Windows PowerShell use `npm.cmd`, `npx.cmd`, and `railway.cmd`; read/write text explicitly as UTF-8. Use Node 22.x as declared in `package.json`.
- Check `git status --short --branch` before edits and preserve existing work. Read `package.json` before selecting commands; `npm.cmd run dev` starts the Express/Vite development app, while `preview` only serves the built frontend.
- Run `npm run build` for implementation changes that can affect the shipped application.
- For TypeScript changes, run `npx.cmd tsc -p tsconfig.app.json --noEmit --pretty false` and, when Vite configuration changes, `npx.cmd tsc -p tsconfig.node.json --noEmit --pretty false`. The root `tsconfig.json` has `files: []`; plain `tsc --noEmit` does not check its referenced projects.
- Run `npx prisma validate` for Prisma schema changes.
- Run `npm.cmd run test:p1` for shared rules, server, or database changes; inspect targeted test setup and use disposable databases for destructive tests. Build and tests may write artifacts: the root runs them when the read-only reviewer cannot.
- Use targeted checks for migrations, importers, realtime flows, and authorization boundaries.
- Report any verification that could not be run and the remaining risk.
