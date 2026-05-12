# plateflow.org Onshape Setup

Production domain:

`https://plateflow.org`

## Required App URLs

Use these in the Onshape Developer Portal.

OAuth/login URL:

`https://plateflow.org/auth/onshape`

OAuth redirect URL:

`https://plateflow.org/auth/onshape/callback`

Standalone app URL:

`https://plateflow.org/`

Embedded Onshape URL:

`https://plateflow.org/onshape?embedded=1`

Element right-panel action URL:

```text
https://plateflow.org/onshape?embedded=1&documentId={$documentId}&workspaceOrVersion={$workspaceOrVersion}&workspaceOrVersionId={$workspaceOrVersionId}&elementId={$elementId}&configuration={$configuration}&server={$server}
```

## Onshape Developer Portal Steps

1. Open the Onshape Developer Portal:

   `https://cad.onshape.com/appstore/dev-portal/`

2. Create a new OAuth application.

3. Enter app details:

   - Name: `PlateFlow`
   - Primary format: `org.plateflow`
   - Company/Publisher: `Teknik Engineering`
   - Website: `https://plateflow.org`
   - Redirect URL: `https://plateflow.org/auth/onshape/callback`

   If you are updating an existing Onshape app and Onshape does not let you edit the primary format, leave the existing primary format alone. The OAuth URL, redirect URL, and extension action URL are the fields that must match the new domain.

4. Choose OAuth scopes/permissions with least privilege:

   - Read documents/Part Studios/parts
   - Read metadata/materials
   - Export or translation access for STEP generation
   - Avoid write permissions unless you intentionally store generated STEP files in the Onshape document

5. Copy the generated client ID and client secret into production environment variables:

   - `ONSHAPE_CLIENT_ID`
   - `ONSHAPE_CLIENT_SECRET`

6. Add an extension:

   - Extension type: Element right panel
   - Context: Part Studio
   - Action URL: use the Element right-panel action URL above

7. Save the app, install/test it from your account or company, then open a Part Studio and launch PlateFlow from the right panel.

## Server Deployment Checklist

- Point DNS for `plateflow.org` to your hosting provider.
- Serve HTTPS with a valid TLS certificate.
- Run the app with `NODE_ENV=production`.
- Set `APP_BASE_URL=https://plateflow.org`.
- Set a long random `SESSION_SECRET`.
- Put the Node app behind a reverse proxy that forwards HTTPS traffic to the app port.
- Keep the app response header `Content-Security-Policy: frame-ancestors 'self' https://*.onshape.com`.
- Do not add `X-Frame-Options: SAMEORIGIN`, because it blocks the Onshape iframe.
- Replace the in-memory session/order stores before accepting real orders.

## Test URLs

Standalone:

`https://plateflow.org/`

Embedded test:

```text
https://plateflow.org/onshape?embedded=1&documentId=abc123456789&workspaceOrVersionId=def123456789&elementId=ghi123456789&server=https://cad.onshape.com
```

OAuth test:

`https://plateflow.org/auth/onshape`
