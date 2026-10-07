# Project guidance

## Context and ownership

- Work on `dev`. Before edits, check `git status --short --branch` and preserve
  existing work. Read `package.json` before choosing commands.
- Read the current-state and active-work sections of `codex-readme.md`; consult
  its procedures only when relevant. Keep active notes current. This ignored
  file is context, not proof of branch, tests or production state. If absent,
  use `docs/codex-workspace.md` and the relevant tracked roadmap/runbook.
- Frontend: `src/`; Express/Socket.IO: `server.js`; rules: `src/lib/` and
  `shared/`; schema/migrations: `prisma/`; maintenance: `scripts/`.
  `src/data/JSON_LEGACY/` is normally reference/import input.
- Preserve DM/player authorization, character ownership, persisted identifiers
  and compatibility with existing campaign data. Use dedicated tables/fields
  and explicit APIs for new persistent features; `Character.data` remains legacy.

## Data and production

- Railway `/data/migration.db` is canonical production. Local
  `prisma/migration.db` is mutable development data: keep its schema aligned
  with `dev` for end-to-end testing; never use it to overwrite Railway.
- `prisma/schema.prisma` defines the intended schema. Check dependent direct
  SQL in `server.js` and scripts before schema changes. Prefer additive,
  restart-safe migrations; test destructive operations on disposable copies.
- Production schema/data changes require explicit authorization for their
  scope, a fresh verified external backup, reviewed SQL, verification and
  rollback procedures. Never use `prisma db push` on Railway. Restore,
  destructive changes and unrelated production mutations require separate
  explicit authorization.
- Risky deploys also require a fresh verified backup appropriate to the
  affected persistence: changes to writers, serialization, imports, volume
  bootstrap or persistent files count even without a schema change.

## Git and releases

- Leave work uncommitted until the user confirms successful testing. Then
  finalize only the agreed file scope on `dev` and push to `origin/dev`.
- Merge/push/deploy `main` only on explicit production-release request.
  That request covers the planned release steps without repeated confirmations.
- Release workflow: preflight and required backup; merge `dev` into `main`
  with `git merge --no-ff dev` and an explicit release message; deploy that
  exact committed state to Railway; verify health, affected DM/player flows
  and migration integrity. After success, fast-forward local `dev` to the
  deployed `main` tip and push `origin/dev`, preserving unrelated work.
- Unless explicitly overridden, do not squash or fast-forward release merges.
  If a step fails or the deployment outcome is ambiguous, report the incomplete
  release and investigate before retrying. Do not bypass a failed safety check.

## Delegation

- Use the smallest useful set of project specialists for substantial work;
  handle trivial edits directly. Choose roles from their descriptions.
- At most two concurrent subagents; depth one. Give bounded tasks, relevant
  context and disjoint write ownership. No concurrent edits to the same file.
  Investigate uncertain contracts before assigning implementation boundaries.
- Root owns integration and final verification. Agents return concise findings
  and relevant checks; avoid duplicate exploration or unchanged repeated checks.
- Use read-only `quality_security` after changes involving auth, user data,
  migrations, uploads, paths, realtime concurrency or architectural layers.
- Use `git_finalize` only after positive user test confirmation, with exact
  paths. Use `release_railway` only for an explicitly authorized release.
- Model/reasoning choices belong in TOML, not duplicated here. Escalate for a
  demonstrated difficulty; do not assume a larger model saves time or usage.

## Verification

- Use Node 22.x, UTF-8 and `npm.cmd`, `npx.cmd`, `railway.cmd` in PowerShell.
  `npm.cmd run dev` runs Express/Vite; `preview` serves only the built frontend.
- Root runs final checks after integration:
  - Shipped application changes: `npm.cmd run build`.
  - App TypeScript: `npx.cmd tsc -p tsconfig.app.json --noEmit --pretty false`.
  - Vite/config TypeScript: `npx.cmd tsc -p tsconfig.node.json --noEmit --pretty false`.
  - Prisma schema: `npx.cmd prisma validate`.
  - Shared rules/server/database: `npm.cmd run test:p1` plus relevant checks
    for migrations, imports, realtime and authorization.
  - Changed tracked text: `git diff --check`.
- Plain root `tsc --noEmit` does not check the referenced projects. Reviewers
  remain read-only; root runs checks requiring build or temporary DB artifacts.
- Report unrun checks and residual risks. Distinguish automated verification,
  user testing and verified production state.
