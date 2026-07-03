# Nginx Proxy Manager — proxy host for tickets.417group.org

Forward to `api:3000` over the shared `npm` docker network
(`docker network create npm` once; NPM's compose must also join it).

Proxy host settings:

- **Scheme**: http, **Forward host**: `api` (or `tickets-api-1`), **Port**: `3000`
- **Websockets support**: ON
- **Block common exploits**: ON
- SSL: Let's Encrypt. If the domain is reachable only over Tailscale, use a
  **DNS-01 challenge** (HTTP-01 cannot complete) — set your DNS provider's API
  credentials in the certificate dialog.

Custom Nginx configuration (Advanced tab):

```nginx
# Allow embedding inside Nextcloud (External sites app)
proxy_hide_header X-Frame-Options;
add_header Content-Security-Policy "frame-ancestors 'self' https://cloud.417group.org" always;

# Attachment uploads
client_max_body_size 25m;
```

## Nextcloud side (one-time)

1. Apps → install **OIDC Identity Provider** and **External sites**.
2. OIDC: register client `tickets`, redirect URI
   `https://tickets.417group.org/auth/callback`, confidential, code flow,
   enable the `groups` claim/scope. Put client id/secret into `.env`.
3. External sites: add "Tickets" → `https://tickets.417group.org/?embedded=1`.
4. Create user `svc-tickets`, generate an app password
   (Settings → Security → Devices & sessions), put it into `.env`
   (`NC_SERVICE_ACCOUNT` / `NC_SERVICE_APP_PASSWORD`).
5. Create group `tickets-admins` (or change `BOOTSTRAP_ADMIN_GROUP`) and add
   the people who will configure the platform.
