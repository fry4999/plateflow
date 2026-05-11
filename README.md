# PlateFlow for Onshape

An Onshape App Store-ready FRC build-ops platform. PlateFlow syncs custom parts from Part Studios into a fabrication pipeline, syncs purchased/COTS items from Assembly BOMs into a procurement pipeline, and tracks shared inventory, raw material, robot readiness, and audit history.

Procurement matching uses the FRC Tools Orders vendor search API by default. PlateFlow caches each part-number lookup for 12 hours so dashboard loads do not call vendor/search APIs repeatedly.

## Run Locally

1. Copy `.env.example` to `.env`.
2. Fill in `ONSHAPE_CLIENT_ID`, `ONSHAPE_CLIENT_SECRET`, and a long `SESSION_SECRET`.
3. In Onshape Developer Portal, set the redirect URL to:

   `http://localhost:4321/auth/onshape/callback`

4. Start the server:

   ```sh
   node server.mjs
   ```

5. Open `http://localhost:4321`.

## Run Inside Onshape

Register an extension in the Onshape Developer Portal that points to:

`https://your-domain.example/onshape?embedded=1&documentId={$documentId}&workspaceOrVersion={$workspaceOrVersion}&workspaceOrVersionId={$workspaceOrVersionId}&elementId={$elementId}&configuration={$configuration}&server={$server}`

For a full-tab app, use the Element tab location and action URL:

`https://your-domain.example/onshape?embedded=1`

For a right-panel app inside a Part Studio, use Element right panel, context `Part Studio`, and the parameterized URL above.

## Onshape App Store Setup

Use the Developer Portal to create an OAuth app. Public App Store apps must authenticate with OAuth2, and Onshape REST API calls should run from your server, not directly from browser JavaScript.

Recommended permissions:

- Read documents and metadata.
- Export/translation permissions needed for STEP generation.
- Write document only if you use `storeInDocument=true` for exports.

Set the app OAuth URL to `/auth/onshape`, and the redirect URL to `/auth/onshape/callback` on your production domain.

See [docs/onshape-app-store-checklist.md](docs/onshape-app-store-checklist.md) for the launch notes.

For the Teknik Engineering domain, use [docs/teknik-engineering-onshape-setup.md](docs/teknik-engineering-onshape-setup.md).

For Railway hosting, use [docs/railway-deploy.md](docs/railway-deploy.md).

For storage and hosting tradeoffs, use [docs/storage-hosting.md](docs/storage-hosting.md).

For future Project chats and agent handoffs, read [AGENTS.md](AGENTS.md) and [docs/project-brief.md](docs/project-brief.md).

## Security Model

- HTTP-only, SameSite session cookies.
- OAuth `state` validation.
- Server-only Onshape access and refresh tokens.
- CSRF token required for all mutating API requests.
- Strict security headers and a conservative CSP.
- Rate limiting on auth and API routes.
- Input validation on all API request bodies.
- Durable Postgres storage when `DATABASE_URL` is configured.

For production, use Railway Postgres or another managed Postgres database and rotate any secret that was ever pasted outside the hosting provider's secret manager.
