# FRC PlateFlow for Onshape

An Onshape App Store-ready starter app for FRC teams ordering laser-cut plates from Part Studios. It logs users in with Onshape OAuth2, reads part/material data through the Onshape API, creates STEP export jobs, and collects a manufacturing order request on a Fabworks-inspired quote page.

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

For Render hosting, use [docs/render-deploy.md](docs/render-deploy.md).

For Cloudflare DNS in front of Render, use [docs/cloudflare-render-dns.md](docs/cloudflare-render-dns.md).

## Security Model

- HTTP-only, SameSite session cookies.
- OAuth `state` validation.
- Server-only Onshape access and refresh tokens.
- CSRF token required for all mutating API requests.
- Strict security headers and a conservative CSP.
- Rate limiting on auth and API routes.
- Input validation on all API request bodies.

For production, move the in-memory stores to Redis/Postgres and encrypt refresh tokens at rest.
