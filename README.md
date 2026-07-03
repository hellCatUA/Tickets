# 417 Group — Service Ticket Platform

Internal service-ticket platform integrated with Nextcloud, self-hosted via Docker Compose.

- **Requirements:** [docs/requirements.md](docs/requirements.md)
- **Architecture & deployment:** [docs/architecture.md](docs/architecture.md)

| | |
|---|---|
| Frontend | Vue 3 + Vite (PWA) |
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL |
| Queue / jobs | Redis + BullMQ |
| Auth | Nextcloud OIDC (SSO) + OCS group sync |
| Deployment | Docker Compose on OMV, behind Nginx Proxy Manager + Tailscale |
| URL | `https://tickets.417group.org`, embedded into `https://cloud.417group.org` via External sites |

## Repository layout

```
apps/api        NestJS backend (REST API, OIDC auth, OCS directory sync)
apps/web        Vue 3 SPA (PWA, light/dark theme, embedded mode for Nextcloud)
packages/shared Shared TypeScript types (roles, permissions, DTOs)
docker/         Dockerfile, compose stack, NPM + Nextcloud setup notes
docs/           Requirements and architecture
```

## Local development

```bash
pnpm install
pnpm build                  # shared + api + web
pnpm dev:api                # NestJS on :3000 (needs DATABASE_URL, see .env.example)
pnpm dev:web                # Vite on :5173, proxies /api and /auth to :3000
```

## Deployment (OMV)

```bash
cp .env.example .env        # fill in secrets
docker network create npm   # once, shared with Nginx Proxy Manager
docker compose -f docker/compose.yml up -d --build
```

Then follow [docker/npm-notes.md](docker/npm-notes.md) for the NPM proxy host
and the one-time Nextcloud setup (OIDC client, External sites entry, service
account, `tickets-admins` group).
