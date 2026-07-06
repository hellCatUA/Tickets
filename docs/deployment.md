# Deployment Guide — tickets.417group.org

Step-by-step deployment onto the existing OMV host, written against the actual
infrastructure: **NPM in host network mode**, **Nextcloud (linuxserver.io) bound
to 127.0.0.1:4080**, **Tailscale in host mode**, Docker apps under
`/docker/apps/`.

## Topology

```
Browser (Tailscale client)
   │  https://tickets.417group.org  (DNS → Tailscale IP of the OMV host)
   ▼
OMV host ── NPM (network_mode: host, :443)
   │            │
   │            ├── proxy host: cloud.417group.org   → 127.0.0.1:4080  (Nextcloud)
   │            └── proxy host: tickets.417group.org → 127.0.0.1:4090  (Tickets API+SPA)
   ▼
Tickets stack (docker compose, bridge network "tickets")
   api (127.0.0.1:4090→3000) ── db (postgres 16) ── redis 7 ── worker
```

Because NPM runs with `network_mode: host`, it cannot resolve container names
on bridge networks — so the Tickets API publishes itself on `127.0.0.1:4090`,
exactly like Nextcloud's `127.0.0.1:4080` binding. Nothing is exposed beyond
localhost; TLS terminates in NPM.

The API also calls `https://cloud.417group.org` itself (OIDC discovery, OCS
directory sync). From inside a container that traffic goes to the host's
Tailscale IP, where host-mode NPM answers — this works out of the box as long
as the domain resolves from inside the container (see Troubleshooting if not).

## Prerequisites

- DNS record `tickets.417group.org` pointing to the same address as
  `cloud.417group.org` (the OMV host's Tailscale IP).
- A Let's Encrypt certificate can be issued the same way as for
  `cloud.417group.org`. If certificates are issued via DNS-01 (required when
  port 80 is not reachable from the internet), the same DNS provider
  credentials in NPM will work for the new subdomain.
- Nextcloud admin access, Docker + Compose on OMV.

## Step 1 — get the code

```bash
sudo mkdir -p /docker/apps/tickets
sudo git clone https://github.com/hellCatUA/Tickets.git /docker/apps/tickets
cd /docker/apps/tickets
```

## Step 2 — configure `.env`

```bash
cp .env.example .env
# generate strong secrets:
openssl rand -hex 32   # → SESSION_SECRET
openssl rand -hex 24   # → DB_PASSWORD
```

| Variable | Value for this deployment |
|---|---|
| `PUBLIC_URL` | `https://tickets.417group.org` |
| `SESSION_SECRET` | random hex from above |
| `DB_PASSWORD` | random hex from above (compose feeds it to Postgres and the API) |
| `OIDC_ISSUER` | `https://cloud.417group.org` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | from Step 4 |
| `NC_BASE_URL` | `https://cloud.417group.org` |
| `NC_SERVICE_ACCOUNT` / `NC_SERVICE_APP_PASSWORD` | from Step 4 |
| `SYNC_CRON` | `*/15 * * * *` (default is fine) |
| `BOOTSTRAP_ADMIN_GROUP` | `tickets-admins` |
| `TZ` | `America/Los_Angeles` (to match the rest of the host) |

`DATABASE_URL`/`REDIS_URL` from `.env.example` are overridden by compose —
leave them as-is.

## Step 3 — build and start

```bash
cd /docker/apps/tickets
docker compose up -d --build
docker compose ps          # api, worker, db, redis running
curl -s http://127.0.0.1:4090/healthz            # → {"status":"ok","db":true}
```

## Step 4 — Nextcloud one-time setup

1. **Install apps** (as NC admin → Apps):
   - **OIDC Identity Provider** (`oidc`)
   - **External sites** (`external`)
2. **Register the OIDC client** (Settings → Administration → Security → OIDC):
   - Name: `Tickets`
   - Redirect URI: `https://tickets.417group.org/auth/callback`
   - Flow: **Authorization code flow** (Потік авторизації коду)
   - Access token type: Opaque is fine (the platform reads groups from the
     userinfo endpoint, not the token)
   - Copy the generated client id/secret into `.env`
   - **Groups**: do *not* add a custom claim for this. The app already has a
     built-in **`groups` scope** that returns the full list of the user's
     groups — the platform requests it automatically. (A custom claim with the
     "User in group" function returns only a `true/false` for one group, which
     is not what the platform needs — leave custom claims empty.) Groups are
     delivered as **GIDs** (internal group ids); keep the default, since the
     platform matches roles by GID. Only if you switched the app to display
     names (`occ config:app:set oidc group_claim_type --value displayname`)
     would you need to switch it back to `gid`.
3. **Service account for directory sync**:
   - Create user `svc-tickets` (no admin rights needed to read users/groups on
     current NC releases; if the sync later returns 403, add it to the `admin`
     group or grant it user-management rights)
   - Log in as `svc-tickets` → Settings → Security → Devices & sessions →
     create an **app password** → put into `.env`
4. **Admin group**: create group `tickets-admins`, add yourself. Members get
   the platform Admin role even before any role mapping exists.
5. **External sites entry** (Settings → Administration → External sites):
   - Name: `Tickets`, URL: `https://tickets.417group.org/?embedded=1`
   - Optionally restrict visibility to specific groups
6. Restart the tickets stack so it picks up the finished `.env`:
   ```bash
   docker compose up -d
   ```

## Step 5 — NPM proxy host

NPM UI → Hosts → Proxy Hosts → Add:

- **Domain**: `tickets.417group.org`
- **Scheme**: `http`, **Forward Host**: `127.0.0.1`, **Forward Port**: `4090`
- **Websockets support**: ON (needed for the live timeline)
- **Block common exploits**: ON
- **SSL tab**: request a certificate the same way as for `cloud.417group.org`,
  Force SSL + HTTP/2
- **Advanced tab**:

```nginx
# Allow embedding inside Nextcloud (External sites app)
proxy_hide_header X-Frame-Options;
add_header Content-Security-Policy "frame-ancestors 'self' https://cloud.417group.org" always;

# Attachment / invoice uploads
client_max_body_size 25m;
```

## Step 6 — first login and role mapping

1. Open `https://tickets.417group.org` → **Sign in with Nextcloud** → you land
   on the dashboard with the `admin` role (via `tickets-admins`).
2. Trigger the first directory sync and check the result:
   ```bash
   # or wait for the SYNC_CRON tick; status: GET /api/admin/sync
   curl -s -X POST https://tickets.417group.org/api/admin/sync \
        -H "Cookie: <your session cookie>"
   ```
   (From M1 on this lives in the admin UI; the endpoint already works.)
3. In Nextcloud, open the **Tickets** entry in the app menu — the platform
   should render inside Nextcloud in compact (embedded) mode.

## Verification checklist

- [ ] `curl http://127.0.0.1:4090/healthz` → `{"status":"ok","db":true}`
- [ ] `https://tickets.417group.org` opens over Tailscale with a valid cert
- [ ] Response headers include `Content-Security-Policy: frame-ancestors …`
      and **no** `X-Frame-Options`
- [ ] SSO login works from a browser already logged into Nextcloud
- [ ] `GET /api/me` (browser dev tools) shows your roles and groups
- [ ] The Tickets item inside Nextcloud renders the app in the iframe
- [ ] `docker compose logs api | grep "Directory sync done"` after the first
      cron tick

## Updating

```bash
cd /docker/apps/tickets
git pull
docker compose up -d --build
```

Schema changes are applied automatically in M0 (TypeORM `synchronize`);
from the first tagged release migrations run explicitly instead.

## Backups (fit into the existing OMV routine)

```bash
# nightly DB dump (add to cron / scheduled task on OMV)
docker compose --project-directory /docker/apps/tickets \
  exec -T db pg_dump -U tickets tickets | gzip \
  > /tank/backups/tickets/tickets-$(date +%F).sql.gz
```

Also back up the named volumes `tickets_attachments` and `tickets_branding`
(plain directories under `/var/lib/docker/volumes/`), alongside the existing
backups of `/docker/apps/nginxproxymanager/{data,letsencrypt}` and the
Nextcloud config/DB.

Redis holds only sessions and (from M2) queue state — no backup needed.

## Troubleshooting

**`WARN The "DB_PASSWORD" variable is not set` / `dependency failed to start:
container tickets-db-1 is unhealthy`** — Compose did not find the `.env` with
your variables. Compose reads `.env` for `${…}` substitution from the
directory of `compose.yml` — which is why `compose.yml` lives at the repo
root, right next to `.env`. Run `docker compose` commands from
`/docker/apps/tickets` and make sure `.env` exists there (`cp .env.example
.env` + fill it in). Since the guard `${DB_PASSWORD:?…}` was added, a missing
variable aborts immediately with a clear message instead of starting Postgres
with an empty password. A first start that failed this way leaves no data
behind — after fixing `.env`, plain `docker compose up -d --build` recovers;
if the `db` container still restarts, reset the empty volume once with
`docker compose down -v` (safe only while there is no data yet).

**502 from NPM** — the API container is down or the port binding is missing:
`docker compose ps`, `curl http://127.0.0.1:4090/healthz`,
`docker compose logs api`.

**"Sign-in with Nextcloud failed" / redirect to `/login?error=oidc`** — the
OIDC flow broke somewhere. The API logs say exactly where:

```bash
docker compose logs api | grep -iE "oidc|discovery" | tail
```

- *Every `OIDC discovery failed …` line, none succeeded* — the API cannot
  fetch the discovery document. It probes all known Nextcloud variants
  automatically (`/.well-known/…`, `/index.php/.well-known/…`,
  `/index.php/apps/oidc/openid-configuration`). Check reachability from
  inside the container:

  ```bash
  docker compose exec api \
    wget -qO- https://cloud.417group.org/index.php/apps/oidc/openid-configuration | head -c 200
  ```

  If DNS does not resolve there, uncomment `extra_hosts` in `compose.yml`
  and set the host's Tailscale IP. If TLS fails, the certificate on
  `cloud.417group.org` must be valid (it is, if browsers accept it).
- *`OIDC discovery succeeded` but `OIDC callback failed: …`* — the client
  registration doesn't match: verify the redirect URI is exactly
  `https://tickets.417group.org/auth/callback`, the client id/secret in
  `.env` match the OIDC app, and restart with `docker compose up -d` after
  changing `.env`.
- *`unauthorized_client` / `invalid_scope` in the error* — enable the
  authorization-code flow for the client in the OIDC Identity Provider
  settings, and leave "Allowed scopes" empty (which permits all, including
  `groups`).

**Logged in, but you have no roles / no admin access** — the `groups` claim is
not arriving. In the OIDC client, make sure there is **no custom claim named
`groups`** using the "User in group" function (it returns a boolean, not the
list) — remove it and rely on the built-in `groups` scope. Confirm the groups
reach the platform:

```bash
docker compose logs api | grep -i userinfo   # a warning here means userinfo failed
```

`GET /api/me` in the browser dev tools should list your groups; if it is empty,
the account genuinely has no Nextcloud groups, or a custom `groups` claim is
overriding the built-in one.

**Login loop only inside the Nextcloud iframe** — cookies are being blocked.
Both sites must share the parent domain (`417group.org` — they do), and the
`tickets.sid` cookie must be `SameSite=Lax; Secure` (default in production).
Hard-refresh Nextcloud after changing NPM headers.

**Iframe shows a blank page** — check the response headers of
`https://tickets.417group.org`: `frame-ancestors` must include
`https://cloud.417group.org`, `X-Frame-Options` must be absent, and the
certificate must be trusted by the browser (Nextcloud refuses to embed sites
with cert errors).

**Directory sync logs HTTP 401/403** — the app password is wrong, or
`svc-tickets` lacks permission to list users; regenerate the app password or
grant the account user-management rights (see Step 4.3).

**Wrong client IP in logs** — with host-mode NPM the API receives requests
from 127.0.0.1 and honours `X-Forwarded-For` (`trust proxy` is enabled),
so real client IPs appear in the app; nothing to configure.
