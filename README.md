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
