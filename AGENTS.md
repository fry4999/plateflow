# PlateFlow Agent Handoff

This repo is the working PlateFlow app for FRC build operations. Future Codex chats should read this file first, then `README.md`, `docs/project-brief.md`, `server.mjs`, `public/app.js`, `public/index.html`, and `public/styles.css`.

## What PlateFlow Is

PlateFlow connects Onshape CAD to an FRC team inventory, manufacturing, procurement, and project readiness workflow.

It has two user-facing surfaces:

- Browser dashboard: inventory, projects, procurement, manufacturing, settings, admin.
- Embedded Onshape panel: lightweight import/sync tool inside Onshape.

It is one shared backend and two interfaces, not two unrelated apps.

## Current Stack

- Single Node.js ESM server in `server.mjs`.
- Static frontend files in `public/`.
- No frontend build step.
- Postgres is used when `DATABASE_URL` is configured.
- File storage fallback exists, but production should use Postgres.
- Railway is the current preferred deployment target.
- Production domain has been `https://plateflow.teknik-engineering.com`.

Run locally:

```sh
node server.mjs
```

Check syntax:

```sh
node --check server.mjs
node --check public/app.js
git diff --check
```

## Product Rules That Matter

1. Part Studio imports are custom/manufacturing parts.
2. Assembly BOM imports are COTS/procurement parts.
3. Do not build one generic parts import flow.
4. Keep Onshape API calls server-side. Browser code must not call Onshape directly.
5. Avoid unnecessary Onshape API use. Cache and reuse data where possible.
6. Keep UI fast and optimistic where safe. This app is used live by many students at once.
7. Use real synced/imported data only. Do not add fake procurement or inventory rows.
8. Roles are only `admin` and `student`.
9. Students can use the workspace. Only admins can view Settings and Admin.

## Current Domain Concepts

- Project: either a robot or standalone project/assembly.
- Sub-assembly: document-level assembly/source inside a project.
- Inventory: global team catalog and stock state.
- Procurement: COTS vendor ordering workspace.
- Manufacturing: custom/fabrication kanban per sub-assembly.
- Requirements: project/sub-assembly needs for COTS and custom parts.
- Reservations: inventory committed to a requirement.

## Important Current Behavior

- Inventory list uses one `Vendor/Machine` column:
  - COTS rows show/edit vendor.
  - Custom rows show/edit machine/process.
- Project add and delete are optimistic.
- Procurement delete/status/quantity work should stay responsive.
- Success notifications fade after 2 seconds.
- Error/notification bar is dismissible.
- Shaft stock has special behavior:
  - Individual shafts can remain manufacturing/cut items.
  - Procurement should roll shaft stock into WCP stock lengths instead of listing each shaft.
  - Be careful with pack/stock quantities to avoid multiplying order counts incorrectly.
- McMaster pack quantities should mean needed count vs order quantity, not "18 orders of a 50-pack" unless actually required.

## Deployment Notes

Railway should have at minimum:

- `APP_BASE_URL=https://plateflow.teknik-engineering.com`
- `NODE_ENV=production`
- `SESSION_SECRET=<long random secret>`
- `TRUST_PROXY=true`
- `DATABASE_URL=<Railway Postgres public or reachable internal URL>`
- `ONSHAPE_CLIENT_ID=<Onshape OAuth client id>`
- `ONSHAPE_CLIENT_SECRET=<Onshape OAuth secret>`
- `ONSHAPE_API_BASE=https://cad.onshape.com`
- `ONSHAPE_OAUTH_BASE=https://oauth.onshape.com`

If `/api/session` reports file storage while `DATABASE_URL` is configured, fix the database URL before debugging app data.

## Security Notes

- Do not commit secrets.
- Do not expose Onshape tokens in frontend code.
- Mutating API routes use CSRF.
- Keep tenant/team isolation in mind for any future public SaaS work.
- Before public release, token encryption and true multi-team tenancy are required.

## When Editing

- Use existing patterns in `server.mjs` and `public/app.js`.
- Keep UI operational and low-clutter.
- Prefer tables, filters, inline actions, and fast feedback.
- Avoid adding decorative landing-page content. This is an internal team tool.
- Use `apply_patch` for manual edits.
- Run the syntax checks above before committing.
- Commit and push when a user asks for implementation unless they explicitly say not to.

