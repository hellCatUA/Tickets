# Architecture & Deployment — 417 Group Service Ticket Platform

Companion to [requirements.md](requirements.md).

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | **NestJS** (Node 22, TypeScript) | REST API + WebSocket gateway (Socket.IO) |
| Frontend | **Vue 3** + Vite + Pinia + Vue Router | Built as PWA (service worker, manifest, Web Push) |
| Database | **PostgreSQL 16** | JSONB for form schemas & submitted values |
| Queue / scheduler | **Redis 7 + BullMQ** | Automation rules, SLA timers, notifications, PDF jobs |
| ORM | TypeORM | Entities + migrations checked into the repo |
| PDF generation | Headless Chromium (HTML → PDF for page 1) + `pdf-lib` (merge uploaded vendor invoice, stamp approval signature) | |
| Signature capture | `signature_pad` on a canvas (touch/mouse), stored as PNG | |
| Auth | `openid-client` against Nextcloud OIDC; platform issues its own session cookie | `SameSite=Lax`, `Secure`, `HttpOnly` |

### Monorepo layout (pnpm workspaces)

```
apps/
  api/        # NestJS backend + worker entrypoint
  web/        # Vue 3 frontend
packages/
  shared/     # DTOs, enums, validation schemas shared by api & web
docs/
docker/       # Dockerfiles, compose files, NPM notes
```

## 2. Core domain model (sketch)

```
User          (synced from Nextcloud; nc_uid, display name, email, active)
Group         (synced from Nextcloud) ↔ RoleMapping / Permission grants
Category      (tree; agent groups, SLA targets, default priority)
FormSchema    (versioned JSONB per category)
Location      (tree)
ObjectFamily  (device category; per-family custom field schema)
AssetObject   (belongs to ObjectFamily + Location; serial no, inventory no,
               family fields JSONB; QR token)
ServiceLogEntry (manual service-history entry on an AssetObject:
               date, description, performed by, cost USD)
Ticket        (ticket no T-YYYY-NNNN; category, status, priority, requester,
               assignee/group, location?, object?, form values JSONB)
TicketEvent   (append-only timeline: type, actor, payload, created_at)
Comment       (public | internal), Attachment
AutomationRule(condition JSONB, action JSONB, enabled)
Vendor        (company details, payment details)
BillingRecord (ticket, vendor, SOW, result, price USD, tax?,
               invoice file, approver, approval signature (PNG),
               status, doc number; many per ticket)
BrandingSettings, NotificationPreference, AuditLogEntry
```

Notes:

- `TicketEvent` is the single source of truth for the timeline, notifications
  fan-out, and the Service Document's timeline section.
- Form schemas are **versioned**: a ticket stores the schema version it was
  created with, so later form edits never break old tickets.
- QR tokens are random slugs → `https://tickets.417group.org/new?object=<token>`.

## 3. Authentication flow

1. Browser hits the app without a session → redirect to
   `cloud.417group.org` OIDC authorize endpoint (code + PKCE).
2. User is already logged into Nextcloud → immediate redirect back with a code
   (first time only: consent screen; if blocked inside the iframe, the app opens
   it in a popup and resumes).
3. API exchanges the code, validates the ID token, reads `groups` claim,
   upserts the user, resolves roles/permissions from the group mapping, and
   issues its own session cookie.
4. Independently, a BullMQ cron job syncs the full user & group directory via the
   OCS Provisioning API (`OCS-APIRequest: true`) using a dedicated Nextcloud
   service account with an app password.

Because `cloud.417group.org` and `tickets.417group.org` share the parent domain,
the iframe is **same-site** and the session cookie works with `SameSite=Lax`.

### Step-up re-authorization (UAC-style)

For sensitive actions (billing approval/rejection, ticket closure) the API
requires a fresh **elevated grant**:

1. Frontend opens a popup to the OIDC authorize endpoint with
   `prompt=login&max_age=0` — Nextcloud forces password entry (and 2FA if
   enabled), regardless of the existing session.
2. On callback the API verifies the new ID token's `auth_time`, then issues a
   short-lived elevation (~5 min) bound to the session.
3. The protected endpoint only executes while the elevation is valid; the
   confirmation is recorded on the ticket timeline and in the audit log.

The platform never sees the password — verification stays inside Nextcloud.
Billing approval additionally submits a signature PNG captured with
`signature_pad`; the worker stamps it into the Service Document PDF.

## 4. Containers (Docker Compose on OMV)

```yaml
# docker/compose.yml — shape, not final
services:
  api:
    build: { context: .., dockerfile: docker/api.Dockerfile }
    environment:
      DATABASE_URL: postgresql://tickets:${DB_PASSWORD}@db:5432/tickets
      REDIS_URL: redis://redis:6379
      OIDC_ISSUER: https://cloud.417group.org
      OIDC_CLIENT_ID: ${OIDC_CLIENT_ID}
      OIDC_CLIENT_SECRET: ${OIDC_CLIENT_SECRET}
      NC_SERVICE_ACCOUNT: ${NC_SERVICE_ACCOUNT}      # OCS sync
      NC_SERVICE_APP_PASSWORD: ${NC_SERVICE_APP_PASSWORD}
      PUBLIC_URL: https://tickets.417group.org
    ports: ['127.0.0.1:4090:3000']      # host-mode NPM proxies to localhost
    volumes:
      - attachments:/data/attachments   # ticket files + vendor invoices
      - branding:/data/branding         # logo etc.
    depends_on: [db, redis]
    networks: [tickets]

  worker:                               # same image, worker entrypoint
    build: { context: .., dockerfile: docker/api.Dockerfile }
    command: ["node", "dist/worker.js"] # automation, SLA, push, PDF
    environment: *same-as-api
    volumes: [attachments:/data/attachments, branding:/data/branding]
    depends_on: [db, redis]
    networks: [tickets]

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: tickets
      POSTGRES_USER: tickets
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [db-data:/var/lib/postgresql/data]
    networks: [tickets]

  redis:
    image: redis:7-alpine
    volumes: [redis-data:/data]
    networks: [tickets]

volumes: { db-data: {}, redis-data: {}, attachments: {}, branding: {} }
networks: { tickets: {} }
```

- The frontend is built at image build time and served statically by the API
  container — one origin, no CORS.
- The API binds to `127.0.0.1:4090` on the host: NPM runs in host network
  mode on this server, so it proxies to localhost (same pattern as
  Nextcloud's `127.0.0.1:4080`). Nothing is reachable from outside the host.
- Worker runs Chromium for PDF rendering → give it ~512 MB headroom.
- Footprint: **~700–900 MB RAM idle**, peaks to ~1.5 GB during PDF generation.
  Recommended allocation on OMV: **2 GB** — never needs thought at this scale.

## 5. Nginx Proxy Manager

Proxy host `tickets.417group.org` → `http://127.0.0.1:4090`
(full walkthrough: [deployment.md](deployment.md)):

- **WebSocket support: on** (Socket.IO).
- Custom response headers:
  - `Content-Security-Policy: frame-ancestors 'self' https://cloud.417group.org`
  - do **not** add `X-Frame-Options` (and strip it if a default config adds one).
- TLS: Let's Encrypt via **DNS-01 challenge** (the site is only reachable over
  Tailscale, so HTTP-01 cannot complete). Requires DNS provider API credentials
  in NPM. A valid public certificate is required — Nextcloud will refuse to
  iframe a site with an untrusted cert.
- `client_max_body_size` raised (e.g. 25 MB) for invoice/attachment uploads.

## 6. Nextcloud side (one-time setup)

1. Install **OIDC Identity Provider** app; register client
   `tickets.417group.org` (confidential, code + PKCE, groups claim enabled).
2. Install **External sites** app; add entry "Tickets" →
   `https://tickets.417group.org/?embedded=1` (icon + name), optionally limited
   to specific groups.
3. Create service account `svc-tickets` (member of no groups, admin *not*
   required if user:list/group:list permissions suffice — verify on the target
   NC version) and generate an app password for OCS sync.

## 7. Backups (OMV)

- Nightly `pg_dump` into a dump volume/directory picked up by the existing OMV
  backup routine.
- `attachments` and `branding` volumes backed up as plain directories.
- Redis is disposable state (queues re-derive from Postgres); no backup needed
  beyond AOF for graceful restarts.

## 8. Delivery plan (proposed milestones)

1. **M0 — skeleton**: monorepo, CI, compose stack boots, OIDC login end-to-end,
   user/group sync, role mapping, embedded mode inside Nextcloud.
2. **M1 — core tickets**: categories + form builder, ticket CRUD, comments,
   attachments, timeline, statuses, assignment, dark theme, responsive UI.
3. **M2 — automation & notifications**: rules engine, SLA timers, in-app bell,
   Web Push, notification preferences.
4. **M3 — locations & objects**: directories, object families with per-family
   field schemas, serial numbers, QR codes, per-object service history and
   cost totals.
5. **M4 — billing**: vendors, billing records, step-up re-authorization,
   signature capture, approval flow, branding settings, Service Document PDF,
   CSV export.
6. **M5 — polish**: reports dashboard, audit log, ticket templates, PWA
   install/offline shell, backup docs.
