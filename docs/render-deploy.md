# Deploy PlateFlow on Render

This app can run as a Render free web service.

## 1. Push to GitHub

Create a GitHub repo and push this folder.

## 2. Create the Render Service

Option A, Blueprint:

- Render dashboard -> New -> Blueprint
- Connect the GitHub repo
- Render reads `render.yaml`
- Fill the secret environment variables when prompted

Option B, manual web service:

- Render dashboard -> New -> Web Service
- Connect the GitHub repo
- Runtime: Node
- Plan: Free
- Build command: `npm install`
- Start command: `node server.mjs`
- Health check path: `/api/session`

## 3. Environment Variables

Set these in Render:

```env
APP_BASE_URL=https://plateflow.org
NODE_ENV=production
TRUST_PROXY=true
SESSION_SECRET=<generate a long random value>
ONSHAPE_CLIENT_ID=<from Onshape Developer Portal>
ONSHAPE_CLIENT_SECRET=<from Onshape Developer Portal>
ONSHAPE_OAUTH_BASE=https://oauth.onshape.com
ONSHAPE_API_BASE=https://cad.onshape.com
ONSHAPE_OAUTH_SCOPE=
```

## 4. Custom Domain

In Render:

- Open the `plateflow` service
- Go to Settings -> Custom Domains
- Add `plateflow.org`

Render will show the DNS records to create. Usually:

- `plateflow` uses a `CNAME` to your Render hostname.

Wait for Render to issue the HTTPS certificate before using the domain in Onshape.

## 5. Onshape URLs

After HTTPS works, configure Onshape with:

OAuth redirect URL:

`https://plateflow.org/auth/onshape/callback`

Element right-panel action URL:

```text
https://plateflow.org/onshape?embedded=1&documentId={$documentId}&workspaceOrVersion={$workspaceOrVersion}&workspaceOrVersionId={$workspaceOrVersionId}&elementId={$elementId}&configuration={$configuration}&server={$server}
```

## 6. Smoke Test

Open:

`https://plateflow.org/api/session`

You should see JSON with `configured: true` after adding Onshape credentials.
