# PlateFlow Project Brief

PlateFlow is an FRC inventory and build-operations platform that connects Onshape CAD to team inventory, COTS procurement, custom part manufacturing, and project readiness tracking.

This document exists so a future Project chat or coding agent can continue the work without reading the entire original conversation.

## Product Goal

Build a fast, low-clutter operations tool for an FRC team. The app should help students and mentors answer:

- What parts does this robot or project need?
- Which custom parts need to be made?
- Which COTS parts need to be ordered?
- What has arrived?
- What is already on hand?
- What is reserved for a specific sub-assembly?
- Which sub-assemblies are ready?

The app should feel more like a small ERP/build-ops tool than a flashy dashboard.

## Surfaces

### Browser Dashboard

The main app used outside Onshape.

Primary sections:

- Overview
- Inventory
- Projects
- Procurement
- Settings
- Admin

Manufacturing is reached from project/sub-assembly context rather than being the main global workflow.

### Embedded Onshape App

A narrow right-panel app inside Onshape. It should stay focused on sync/import tasks.

Expected behavior:

- In Part Studio mode, import selected custom parts into manufacturing.
- In Assembly mode, import selected BOM/COTS rows into procurement.
- Let users choose the target project/sub-assembly.
- Give visible confirmation when imports succeed.
- Avoid side scrolling and large dashboard UI in the embedded panel.

### Shared Backend

The backend owns:

- Auth
- Sessions
- CSRF
- Onshape OAuth and API calls
- Inventory data
- Project requirements
- Procurement matching
- Manufacturing cards
- Settings
- Audit/admin data

The browser frontend should never call Onshape directly.

## Current Tech Stack

- Node.js ESM HTTP server: `server.mjs`
- Static frontend: `public/index.html`, `public/app.js`, `public/styles.css`
- Postgres via `pg` when `DATABASE_URL` exists
- File storage fallback for local/dev only
- Railway deployment
- Cloudflare DNS/custom domain
- Onshape OAuth app and Onshape embedded extension

There is no bundler/build step. Railway starts the app with:

```sh
node server.mjs
```

## Core Architecture Rule

Do not merge the two Onshape ingestion flows.

Keep these separate:

- Part Studio -> custom/manufacturing pipeline
- Assembly BOM -> COTS/procurement pipeline

They only meet after normalization in shared inventory, project requirements, and reservations.

## Roles

The app currently has only two roles:

- `admin`
- `student`

Admin can:

- Use the workspace
- View and edit Settings
- View and manage Admin/users
- Invite users
- Clear catalog/admin maintenance

Student can:

- Use inventory
- Use projects
- Use procurement
- Use manufacturing
- Import from Onshape
- Reserve/check off requirements

Student cannot:

- View Settings
- View Admin
- Manage users
- Change global configuration

Older roles such as mentor, purchaser, fabricator, and read_only should be treated as student if found in old data.

## Current Product Shape

### Overview

Shows high-level inventory/project state and selected project/sub-assembly progress.

Desired:

- More useful selected project summary.
- Show sub-assemblies with COTS ordered/reserved progress.
- Keep it operational, not decorative.

### Inventory

Global catalog of COTS and custom parts.

Important current behavior:

- One `Vendor/Machine` column:
  - COTS rows use vendor.
  - Custom rows use machine/process.
- Reserved is derived from project reservations and should not be directly editable.
- Needed hover should show which project/sub-assembly needs the part.
- Rows should be editable enough to correct imported data.
- Deleting and edits should feel fast/optimistic.

### Projects

Projects can be robots or standalone projects/assemblies.

Each project has sub-assemblies. A sub-assembly is generally based on the Onshape document/source being imported.

Desired project flow:

1. Create/select project.
2. Import Assembly BOM or Part Studio from Onshape to that project.
3. Dashboard creates/updates the sub-assembly.
4. Open that sub-assembly to view needed parts.
5. Reserve inventory as items are made/arrive.

### Manufacturing

Custom/manufacturing work is per sub-assembly.

Important behavior:

- Cards should be thin enough to scan.
- Drag/drop status changes should feel instant.
- Cards should show and allow editing process/machine.
- Custom parts can be moved from procurement when misclassified.
- Shafts may appear both as manufacturing cut tasks and as rolled-up stock procurement.

### Procurement

COTS ordering workspace grouped by vendor.

Supported/target vendors:

- REV
- The Thrifty Bot / TTB
- WCP
- AndyMark
- McMaster-Carr
- V-Belt Guys

Do not include CTRE as a vendor target unless the user asks later.

Important behavior:

- Cards/rows should stay compact and readable.
- Vendor view should be flat and easy to scan.
- Quantity edits must be accessible and obvious.
- Bought/Arrived should be fast and optimistic.
- "Arrived" should add stock to inventory.
- Entire vendor can be marked bought/arrived.
- Deleting should feel instant.

Vendor/link matching:

- WCP links often work by SKU URL, like `https://wcproducts.com/products/wcp-0252`.
- REV has similar predictable SKU/link behavior.
- McMaster packs must be treated carefully: if 18 fasteners are needed and the SKU is a pack of 50, order quantity should be 1 pack, not 18 packs.
- V-Belt Guys belt part numbers can be generated from tooth count/pitch/width.

### Settings

Admin-only global configuration.

Current/desired settings include:

- Part number format.
- Materials.
- Stock types.
- Machines/processes.
- Material-to-machine routing rules.
- Word/phrase auto-routing rules.

Settings should be intuitive, labeled, and have hover/help text. Avoid raw text-only config when a structured UI is possible.

## Onshape Integration Notes

Onshape API calls are expensive and rate-limited. Minimize them.

Important:

- Do not fetch previews repeatedly.
- Avoid individual part preview calls.
- Cache context/material/part data where possible.
- Prefer a single load and local edits inside the Onshape panel.
- Part Studio import should not require multiple reloads.
- Assembly BOM import should not hallucinate data. Use only BOM rows from the active assembly.

Embedded extension URL pattern:

```text
https://plateflow.teknik-engineering.com/onshape?embedded=1&documentId={$documentId}&workspaceOrVersion={$workspaceOrVersion}&workspaceOrVersionId={$workspaceOrVersionId}&elementId={$elementId}&configuration={$configuration}&server={$server}
```

OAuth:

- OAuth URL: `/auth/onshape`
- Callback URL: `/auth/onshape/callback`

## Part Numbering

Configured pattern example:

```text
4999-26-P-1001-DT
```

Meaning:

- `4999`: team/prefix
- `26`: season/year
- `P`: part
- `A`: assembly
- `1001`: block/sequence
- `DT`: subsystem acronym

Example:

- Drivetrain assembly: `4999-26-A-1000-DT`
- Drivetrain part: `4999-26-P-1001-DT`

Custom parts without a part number should receive generated part numbers. COTS parts without a SKU should not get fake custom part numbers.

## Current Deployment

Primary domain:

```text
https://plateflow.teknik-engineering.com
```

Railway is used for deployment. Required production settings include:

```text
APP_BASE_URL=https://plateflow.teknik-engineering.com
NODE_ENV=production
TRUST_PROXY=true
SESSION_SECRET=<secret>
DATABASE_URL=<Postgres URL>
ONSHAPE_CLIENT_ID=<secret>
ONSHAPE_CLIENT_SECRET=<secret>
ONSHAPE_API_BASE=https://cad.onshape.com
ONSHAPE_OAUTH_BASE=https://oauth.onshape.com
```

If `/api/session` says storage is file and not Postgres, fix `DATABASE_URL`. The app will not reliably persist shared data without Postgres.

## Public SaaS Roadmap

If PlateFlow becomes public for other FRC teams, the biggest required changes are:

1. Multi-tenancy with `team_id` on every team-owned record.
2. Team creation/join invite flow.
3. Strong per-team authorization checks on every API route.
4. Encrypted Onshape refresh tokens at rest.
5. Object storage for generated files/artifacts.
6. Background queue for expensive Onshape/vendor work.
7. Email/password reset/invites.
8. Privacy policy and terms.
9. Onshape App Store launch/review.

Do not publish broadly before true tenant isolation exists.

## Recent Fixes Before This Brief

Recent commits included:

- Faster optimistic project creation.
- Backward-compatible project create response.
- Dismissible notification bar.
- Optimistic project deletion.
- Simplified roles to admin/student.
- Inventory `Vendor/Machine` column.
- Shaft stock rollup fixes.
- Selected social embed card asset.

## Known Areas To Improve

- Continue optimizing project/sub-assembly delete and manufacturing card moves.
- Keep reducing Onshape API calls.
- Improve COTS/custom classification accuracy.
- Make procurement more reliable without hallucinated vendor matches.
- Improve pack quantity logic for McMaster and similar vendors.
- Make subsystem checklists the central workflow for builders/manufacturers.
- If public launch is desired, design multi-tenant data model before adding more features.

## Good Verification Checklist

Before pushing changes:

```sh
node --check server.mjs
node --check public/app.js
git diff --check
```

Manual test areas:

- Login as admin and student.
- Student cannot see Settings/Admin.
- Add/delete project feels instant.
- Inventory row edit persists.
- Onshape right panel does not side-scroll.
- COTS BOM import goes to procurement.
- Part Studio import goes to manufacturing.
- Procurement arrived increases inventory.
- Realtime updates do not reload the whole page.

