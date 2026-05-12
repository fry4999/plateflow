# Cloudflare DNS for Render

Use Cloudflare for DNS and Render for the Node server.

## Target

App domain:

`https://plateflow.org`

Render service:

`plateflow`

## Cloudflare Records

After adding `plateflow.org` as a custom domain in the Render service, Render shows your service hostname, usually like:

`plateflow.onrender.com`

In Cloudflare DNS, create:

| Type | Name | Target | Proxy status |
| --- | --- | --- | --- |
| CNAME | `plateflow` | `plateflow.onrender.com` | DNS only |

Remove any old conflicting `A`, `AAAA`, or `CNAME` records with the name `plateflow`. Render recommends removing `AAAA` records because Render custom domains do not support IPv6 records.

## SSL/TLS

In Cloudflare:

- Go to SSL/TLS -> Overview
- Set encryption mode to `Full`

Keep the records as `DNS only` until Render verifies the domain and issues certificates.

After Render shows the certificates are valid, you may optionally switch the Cloudflare records to `Proxied`. If anything weird happens with Onshape iframe loading or OAuth redirects, switch back to `DNS only`.

## Render

In the Render service:

- Settings -> Custom Domains
- Add `plateflow.org`
- Wait for certificate status to become valid

## Onshape URLs

Use:

```text
https://plateflow.org/auth/onshape/callback
```

and:

```text
https://plateflow.org/onshape?embedded=1&documentId={$documentId}&workspaceOrVersion={$workspaceOrVersion}&workspaceOrVersionId={$workspaceOrVersionId}&elementId={$elementId}&configuration={$configuration}&server={$server}
```
