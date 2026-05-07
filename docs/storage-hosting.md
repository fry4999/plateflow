# PlateFlow Storage and Hosting

PlateFlow uses `DATABASE_URL` when it is set. If it is not set, it falls back to a local JSON file for development.

## Cheapest recommended setup

Use Render Free for the web service and a managed Postgres database for durable data.

Good first choice:

- Neon Free Postgres
- Render Free web service
- Render env var: `DATABASE_URL=<your Neon pooled connection string>`

This avoids Render's 50 second cold start only for storage, not for compute. Your data survives Render sleeping, redeploying, or restarting.

## If cold starts are unacceptable

The embedded Onshape panel should feel immediate. If Render's free cold starts get in the way, these are better options:

1. Cloudflare Workers + D1
   - Usually the cheapest fast path.
   - No traditional server sleep.
   - Great fit because the domain is already on Cloudflare.
   - Requires porting the Node server to a Worker/Hono-style app.

2. Fly.io small Machine
   - Can run an always-on Node service for a few dollars per month.
   - More ops work than Render.

3. Railway Hobby
   - Simpler than Fly, but starts around $5/month.

4. Hetzner VPS
   - Very cheap for always-on compute.
   - More server maintenance.

## Why not Render persistent disk?

Render persistent disks require a paid web service. That means paying for compute plus disk just to persist a small JSON file. For PlateFlow, a managed database is cleaner and more portable.

## Long-term production target

Postgres should become the source of truth for:

- teams
- users and roles
- sync batches
- catalog parts
- raw stock
- robot requirements
- reservations
- procurement orders
- fabrication jobs
- audit logs
