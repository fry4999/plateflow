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

## First 10 Minutes In A New PlateFlow Chat

Use this checklist before making changes:

1. Run `git status --short` and protect any existing user edits.
2. Read this file, `README.md`, and `docs/project-brief.md`.
3. Skim the current code areas you will touch. Most product behavior is in `server.mjs`, `public/app.js`, and `public/styles.css`.
4. Check whether the user is talking about the browser dashboard or the embedded Onshape panel. They are intentionally different surfaces.
5. Preserve the core ingestion split:
   - Part Studio means custom/manufacturing.
   - Assembly BOM means COTS/procurement.
6. Keep optimistic UI patterns if a user complains that something feels slow.
7. Do not add Onshape API calls casually. API allocation is a real team constraint.
8. If touching auth, roles, or storage, verify `/api/session` behavior and make sure Postgres is still being used in production.
9. If touching procurement, keep vendor data real or clearly marked as review. Do not invent prices or links.
10. After implementation, run `node --check server.mjs`, `node --check public/app.js`, and `git diff --check`.

## Repository Map

- `server.mjs`: single Node HTTP server, API router, auth, sessions, CSRF, storage adapters, Onshape API proxy, procurement matching, manufacturing, project logic.
- `public/index.html`: static shell.
- `public/app.js`: browser dashboard and embedded Onshape panel rendering/state/actions.
- `public/styles.css`: all visual styling, responsive behavior, embedded panel fixes, dark/light modes.
- `public/plateflow-logo.png`: current app logo asset.
- `public/plateflow-embed-card.png`: current social/embed preview image asset.
- `docs/project-brief.md`: detailed product and engineering handoff. Update it when product architecture or workflow changes.
- `docs/railway-deploy.md`: Railway deployment notes.
- `docs/onshape-app-store-checklist.md`: Onshape developer/app store setup notes.
- `.env.example` and `.env.production.example`: expected local/production environment variable examples.

## Current API Route Groups

The server is a hand-rolled router. Route names matter because frontend calls use these literal paths.

- Session/auth: `/api/session`, `/api/events`, `/auth/plateflow/register`, `/auth/plateflow/login`, `/auth/plateflow/logout`, `/auth/onshape`, `/auth/onshape/callback`, `/auth/logout`.
- Dashboard/inventory: `/api/dashboard`, `/api/inventory`, `/api/inventory/items`, `/api/inventory/items/bulk-delete`, `/api/inventory/items/:itemKey`.
- Projects: `/api/robots`, `/api/robots/:robotId`, `/api/robots/:robotId/requirements`, `/api/robots/:robotId/requirements/:requirementId`, `/api/robots/:robotId/subassemblies/:subassemblyId`.
- Manufacturing: `/api/fabrication/jobs/:jobId`.
- Procurement: `/api/procurement/refresh`, `/api/procurement/lines`, `/api/procurement/lines/transfer-manufacturing`, `/api/procurement/orders/:orderId`.
- Onshape: `/api/onshape/import`, `/api/onshape/import-cots`, `/api/onshape/export-step`, `/api/downloads/:id`.
- Admin/settings: `/api/settings`, `/api/admin/users`, `/api/admin/invites`, `/api/admin/clear-catalog`, `/api/admin/remove-placeholder-cots`, `/api/audit-log`.

## Current Frontend Render Anchors

When looking for UI behavior, these functions are common starting points in `public/app.js`:

- App bootstrap/session: `init`, `refreshSession`, `renderAuth`, `renderAppAccess`, `api`.
- Onshape panel: `onImport`, `renderParts`, `renderCustomConfigurator`, `submitCurrentParts`, `submitConfiguredParts`, `submitCotsParts`.
- Dashboard shell: `loadDashboard`, `renderDashboardChrome`, `renderActiveDashboardPage`.
- Overview: `renderOverview`.
- Inventory: `renderInventory`, `renderInventoryTable`, `onInventoryAction`, `saveInventoryRow`, `onInventoryBulkDelete`.
- Projects/checklists: `renderRobots`, `renderRobotWorkspace`, `renderSubassemblyCard`, `renderSubassemblyChecklist`, `updateRequirementReservation`.
- Manufacturing: `renderFabrication`, `renderFabricationCard`, `onFabricationJobChange`, `flushFabricationStatusSync`.
- Procurement: `renderProcurement`, `renderVendorBucket`, `renderProcurementLine`, `onProcurementLineAction`, `updateProcurementLineQuantity`, `deleteProcurementLines`, `transferProcurementToManufacturing`.
- Settings/admin: `renderSettings`, `onSettingsSave`, `renderAdminUsers`, `onAdminUserAction`.

## High-Risk Product Traps

- Do not show custom parts as normal procurement unless the user is intentionally moving a bad line. Custom parts belong in manufacturing.
- Shaft stock is special. Individual shaft cut lengths can be manufacturing tasks, but procurement should roll stock into 36 inch WCP shaft lengths when possible.
- McMaster pack quantities are not the same as needed quantities. A needed quantity of 18 from a pack of 50 usually means one pack order.
- The embedded Onshape panel is narrow. Any dashboard navigation, wide table, or horizontal scrolling in that panel is a bug.
- The login/home transition should not flash the login card for an already authenticated user.
- Settings and Admin are admin-only. Students should be able to do normal build work but not global configuration or user management.
