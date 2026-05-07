# Cloudflare DNS for Render

Use Cloudflare for DNS and Render for the Node server.

## Target

App domain:

`https://teknik-engineering.com`

Render service:

`plateflow`

## Cloudflare Records

After adding `teknik-engineering.com` as a custom domain in the Render service, Render shows your service hostname, usually like:

`plateflow.onrender.com`

In Cloudflare DNS, create:

| Type | Name | Target | Proxy status |
| --- | --- | --- | --- |
| CNAME | `@` | `plateflow.onrender.com` | DNS only |
| CNAME | `www` | `plateflow.onrender.com` | DNS only |

Cloudflare supports CNAME flattening at the zone apex, so using a CNAME for `@` is okay.

Remove any old conflicting `A`, `AAAA`, or `CNAME` records for `@` and `www`. Render recommends removing `AAAA` records because Render custom domains do not support IPv6 records.

## SSL/TLS

In Cloudflare:

- Go to SSL/TLS -> Overview
- Set encryption mode to `Full`

Keep the records as `DNS only` until Render verifies the domain and issues certificates.

After Render shows the certificates are valid, you may optionally switch the Cloudflare records to `Proxied`. If anything weird happens with Onshape iframe loading or OAuth redirects, switch back to `DNS only`.

## Render

In the Render service:

- Settings -> Custom Domains
- Add `teknik-engineering.com`
- Add `www.teknik-engineering.com` if desired
- Wait for certificate status to become valid

## Onshape URLs

Use:

```text
https://teknik-engineering.com/auth/onshape/callback
```

and:

```text
https://teknik-engineering.com/onshape?embedded=1&documentId={$documentId}&workspaceOrVersion={$workspaceOrVersion}&workspaceOrVersionId={$workspaceOrVersionId}&elementId={$elementId}&configuration={$configuration}&server={$server}
```
