# Onshape App Store Checklist

Onshape requirements and implementation notes for this app.

## Developer Portal

- Create an OAuth application in the Onshape Developer Portal.
- Use a reverse-DNS primary format, for example `org.frc.plateflow`.
- Add your production redirect URL:

  `https://your-domain.example/auth/onshape/callback`

- Set the OAuth/login URL:

  `https://your-domain.example/auth/onshape`

- Select the least permissions needed for reading parts/materials and exporting STEP files.
- Create the App Store entry from the app Details tab.

## Extension Placement

This app is suitable as an Onshape tab or right-panel extension. It also works as a standalone quote portal. When launched from Onshape, pass document context into the URL:

`/?did={documentId}&wid={workspaceId}&eid={elementId}&type=partstudio`

Recommended production extension URLs:

- Element tab:

  `https://your-domain.example/onshape?embedded=1`

- Element right panel, context `Part Studio`:

  `https://your-domain.example/onshape?embedded=1&documentId={$documentId}&workspaceOrVersion={$workspaceOrVersion}&workspaceOrVersionId={$workspaceOrVersionId}&elementId={$elementId}&configuration={$configuration}&server={$server}`

Use the right-panel option for the smoothest workflow: the panel opens next to the Part Studio, the app receives document/workspace/element/configuration context, and the user can import parts without copying IDs.

Element tab extensions receive default query parameters from Onshape, but Onshape does not support custom parameter replacement for that location. The app still reads the default `documentId`, `workspaceId`, `versionId`, `elementId`, `server`, `companyId`, `userId`, `locale`, and `clientId` query parameters when present.

## Production Hardening

- Serve only over HTTPS.
- Set `APP_BASE_URL` to the exact HTTPS origin.
- Do not send `X-Frame-Options: SAMEORIGIN`; Onshape iframe embedding is controlled by `Content-Security-Policy: frame-ancestors`.
- Use a persistent session store.
- Store OAuth refresh tokens encrypted at rest.
- Restrict allowed redirect hosts in your reverse proxy.
- Add monitoring for failed Onshape API calls and translation jobs.
- Connect `POST /api/orders` to your quoting/checkout backend before taking real orders.

## Onshape API Flow

- `GET /api/v6/parts/d/{did}/w/{wid}?elementId={eid}` reads parts and includes assigned material data when present.
- `POST /api/v11/partstudios/d/{did}/w/{wid}/e/{eid}/export/step` starts STEP export.
- `GET /api/v9/translations/{translationId}` polls the export job.
- `GET /api/v6/blobelements/d/{did}/w/{wid}/e/{resultElementId}` downloads the exported STEP/ZIP blob when `storeInDocument=true`.
