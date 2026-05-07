# Deploy PlateFlow on Railway

Railway is the current recommended host for PlateFlow if Render cold starts are getting in the way.

## 1. Create the Railway project

1. Go to Railway and create a new project.
2. Choose **Deploy from GitHub repo**.
3. Select `fry4999/plateflow`.
4. Railway will use `railway.json`, install with `npm ci`, and start with `node server.mjs`.

## 2. Add Postgres

1. In the Railway project, add a PostgreSQL database service.
2. Open the web service variables.
3. Add or reference the Postgres connection string as:

   ```text
   DATABASE_URL=<Railway Postgres connection string>
   ```

PlateFlow stores sync batches, inventory, raw stock, queue state, robots, and audit logs in Postgres when `DATABASE_URL` exists.

## 3. Set environment variables

Set these on the PlateFlow web service:

```text
APP_BASE_URL=https://plateflow.teknik-engineering.com
NODE_ENV=production
TRUST_PROXY=true

ONSHAPE_CLIENT_ID=<from Onshape developer portal>
ONSHAPE_CLIENT_SECRET=<from Onshape developer portal>
ONSHAPE_OAUTH_BASE=https://oauth.onshape.com
ONSHAPE_API_BASE=https://cad.onshape.com
ONSHAPE_OAUTH_SCOPE=

SESSION_SECRET=<at least 32 random bytes>
DATABASE_URL=<Railway Postgres connection string>
```

Generate a session secret locally with:

```sh
openssl rand -base64 48
```

## 4. Disable sleeping/serverless

Keep Railway's serverless/app sleeping feature off for the PlateFlow web service. The Onshape right-panel app should load without a first-request cold boot delay.

## 5. Add the custom domain

1. In the PlateFlow Railway service, open **Settings**.
2. In **Public Networking**, add:

   ```text
   plateflow.teknik-engineering.com
   ```

3. Railway will give you DNS records.
4. In Cloudflare, create the CNAME/TXT records Railway asks for.
5. Start with Cloudflare set to **DNS only** while Railway verifies and issues HTTPS.

## 6. Update Onshape OAuth

In the Onshape Developer Portal, use:

```text
OAuth URL:
https://plateflow.teknik-engineering.com/auth/onshape

Redirect URL:
https://plateflow.teknik-engineering.com/auth/onshape/callback
```

For the embedded extension action URL:

```text
https://plateflow.teknik-engineering.com/onshape?embedded=1&mode=custom&documentId={$documentId}&workspaceOrVersion={$workspaceOrVersion}&workspaceOrVersionId={$workspaceOrVersionId}&elementId={$elementId}&configuration={$configuration}&server={$server}
```

Use `mode=assembly` for an Assembly/COTS extension action.
