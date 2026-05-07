# PlateFlow Storage and Hosting

PlateFlow uses `DATABASE_URL` when it is set. If it is not set, it falls back to a local JSON file for development.

## Current recommendation

Use Railway Hobby with Railway Postgres.

Why:

- one service for the Node app
- one managed Postgres database in the same project
- no Render-style 50 second cold start if serverless/app sleeping is disabled
- simple GitHub deploys
- usually around the Hobby minimum for a small FRC team tool

Set `DATABASE_URL` on Railway and PlateFlow will use Postgres automatically.

## Cheapest possible setup

Cloudflare Workers + D1 is probably the cheapest and fastest long-term target because the domain already lives on Cloudflare and D1 has a generous free tier. It requires porting the Node server to a Worker-compatible server, so it is not the fastest immediate move.

## Other options

1. Fly.io small Machine
   - Can run an always-on Node service for a few dollars per month.
   - More ops work than Railway.

2. Render Free + Neon Free Postgres
   - Cheapest low-effort option.
   - Data survives, but Render compute can still cold start.

3. Hetzner VPS
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
