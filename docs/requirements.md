# Requirements — 417 Group Service Ticket Platform

Status: **agreed with the owner, pre-development baseline**
Last updated: 2026-07-03

## 1. Overview

A full-featured web platform for internal service tickets. It runs as a standalone
site at `https://tickets.417group.org` and is embedded into Nextcloud
(`https://cloud.417group.org`) via the **External sites** app, with single sign-on
against Nextcloud accounts and groups.

## 2. Confirmed decisions

| Topic | Decision |
|---|---|
| Stack | NestJS (TypeScript) backend, Vue 3 frontend, PostgreSQL, Redis + BullMQ |
| Authentication | Nextcloud **OIDC Identity Provider** app (SSO, groups in claims) + background user/group sync via OCS Provisioning API using a service account |
| Attachments | Local Docker volume (independent from Nextcloud) |
| Notifications | In-app bell + Web Push (PWA); configurable per user, per group, and per ticket participants. Email channel designed in but disabled until an SMTP server is available |
| Billing currency | **USD only** (single-currency system) |
| Step-up authorization | Sensitive approvals require password re-confirmation via Nextcloud (UAC-style); billing approval additionally requires a drawn signature |
| Domains | Nextcloud: `cloud.417group.org` · Tickets: `tickets.417group.org` (same parent domain → iframe cookies work) |
| Scale | ~25 users, ~50 tickets/month (design allows growth; no premature scaling work) |
| UI language | English only |
| Deployment | Docker Compose on OpenMediaVault, behind Nginx Proxy Manager, reachable over Tailscale |

## 3. Users, roles and access

Roles are **not** assigned to individual users directly. Admins configure a mapping
**Nextcloud group → platform role**; membership is managed in Nextcloud.

| Role | Capabilities |
|---|---|
| **Requester** | Create tickets, view and comment on own tickets, receive updates |
| **Agent** | Work on tickets in the categories their group is assigned to; change status, comment (public + internal), attach files |
| **Manager** | Full visibility, assignment, escalations, reports, **billing approval** |
| **Admin** | All configuration: categories, forms, locations, objects, role mapping, automation rules, branding, vendors |

Additional fine-grained permissions can be granted to any Nextcloud group
independently of the four base roles:

- `manage:locations` — maintain the locations directory
- `manage:objects` — maintain the objects/assets directory
- `manage:vendors` — maintain the vendor (service company) directory
- `manage:billing` — create/edit billing records and service documents
- `approve:billing` — act as Approving Manager
- `view:reports` — access dashboards and exports
- `manage:automation` — edit automation rules

## 4. Functional requirements

### 4.1 Categories, subcategories and custom forms

- Tree of categories → subcategories, managed by Admin.
- Each (sub)category has a **form builder**: fields of type text, long text, number,
  select, multi-select, date, checkbox, file, user picker, object picker,
  location picker.
- Per-field settings: required, default value, help text, conditional visibility
  (show field when another field has a given value).
- Form schemas and submitted values are stored as JSONB — adding
  categories/fields requires no code changes or migrations.
- Each category can define: assigned agent group(s), default priority, SLA targets.

### 4.2 Locations and objects

- **Locations**: hierarchical directory (site → building → room, depth flexible).
- **Objects** (assets/devices): belong to a location, have a type, a **serial
  number** and inventory number as standard fields, plus custom fields
  (same form-builder mechanism), e.g. model, warranty date.
- **Service history per object**: automatically aggregates every ticket (with
  its billing records and costs) that references the object, plus **manual
  service log entries** (date, description, performed by, cost) for work done
  outside the ticket flow. Per-object totals: number of services, total spend
  (USD) — effectively cost-of-ownership tracking per device.
- Both directories are maintained by groups holding the corresponding permission.
- A ticket may reference a location and/or an object.
- **QR codes**: each object/location gets a printable QR code; scanning it opens
  the new-ticket form with the object/location pre-filled.

### 4.3 Tickets and lifecycle

- Default statuses: `New → In Progress → Waiting for Requester / Waiting for Vendor
  → Resolved → Closed`, plus `Cancelled`. Status names/colors configurable by Admin.
- Priorities: Low / Normal / High / Critical (configurable).
- Assignment: to an agent or an agent group; manual by Manager or automatic by rule.
- Comments: public (visible to requester) and **internal notes** (staff only).
- Attachments on tickets and comments (images, PDFs, docs) stored on a local volume.
- Ticket templates for recurring request types.

### 4.4 Timeline and automation

- Every ticket has an event timeline: created, status changed, assigned, commented,
  attachment added, billing events, automation events. Timeline is the single
  source for notifications and for the Service Document.
- Live updates over WebSocket (no page reloads).
- **Automation rules** (Admin-configurable, condition → action), executed by a
  background worker, e.g.:
  - "Resolved with no requester reply for 5 days → auto-close"
  - "Not picked up within 4 hours → escalate to Manager"
  - "New ticket in category X → auto-assign group Y"
  - "Status = Waiting for Vendor for 7 days → notify billing manager"
- SLA tracking per category: time-to-first-response and time-to-resolution,
  with breach events on the timeline.

### 4.5 Notifications

- Channels: **in-app bell** (with unread counter) and **Web Push** (PWA).
- **Email (SMTP)** is implemented behind the same channel abstraction but stays
  disabled until a mail server is available — enabling it later is configuration
  only (SMTP env vars), no code changes.
- Routing: events notify ticket participants (requester, assignee, watchers),
  the responsible agent group, and managers on escalations.
- Configurable at three levels:
  1. **Admin defaults per group** (e.g. agents get push for new assignments),
  2. **per-ticket participants** (watch/unwatch any ticket),
  3. **per-user preferences** (which event types on which channel).

### 4.6 Billing and Service Documents

Vendor work performed against a ticket is documented and exported as a formal
internal document.

**Vendor directory** (`manage:vendors`): company name, contact person, email/phone,
address, payment/registration details, notes.

**Billing record** attached to a ticket (`manage:billing`). A ticket may have
**several billing records** — one per vendor engagement.

- Vendor (from directory)
- SOW — statement of work (rich text)
- Result — outcome summary (rich text)
- Price in **USD**, optional tax
- Vendor invoice upload (PDF or image)
- Approving Manager (user with `approve:billing`); approval is an explicit action
  recorded with a timestamp on the timeline, and requires **step-up
  re-authorization plus a drawn signature** (see 4.7)
- Record status: `Draft → Pending Approval → Approved / Rejected`, optional
  `Paid` flag

**Service Document (PDF)** generated per billing record, with a sequential
document number (configurable prefix, e.g. `SD-2026-0001`):

- **Page 1 — internal document:**
  - Our company logo and details (configured in Admin → Branding)
  - Servicing company (vendor) details
  - Ticket reference, location/object
  - Timeline (key events: created, assigned, work started, resolved, approved)
  - Result
  - SOW
  - Price (USD, with optional tax breakdown)
  - Approving Manager: name, approval date, and the **captured signature image**
- **Page 2+ — the vendor's own invoice**, embedded from the uploaded file
  (PDF pages merged as-is; images placed one per page).

**Exports:**

- Per-record: the Service Document PDF (download / regenerate).
- Period export: CSV of billing records (date, ticket, vendor, SOW summary,
  price USD, status, approver) for accounting.

**Branding settings** (Admin): company logo upload, company legal name, address,
registration details, document number prefix.

### 4.7 Step-up authorization (UAC-style confirmation)

Sensitive actions require the actor to re-confirm their identity immediately
before the action, similar to Windows User Account Control:

- **Actions covered** (Admin-configurable list): approving a billing record
  (price/invoice), rejecting a billing record, closing a ticket.
- **Mechanism**: because login is SSO, the platform never stores or sees
  Nextcloud passwords. Re-confirmation is done by forcing a fresh OIDC
  re-authentication (`prompt=login`, `max_age=0`) in a popup — Nextcloud itself
  asks for the password (and 2FA, if the user has it). On success the platform
  grants a short-lived elevation (~5 minutes) that unlocks the action.
- **Signature**: billing approval additionally requires a handwritten signature
  drawn on a signature pad (touch or mouse). The signature image is stored with
  the approval event and stamped onto the Service Document PDF. A user may
  optionally save their signature in their profile for one-tap reuse.
- Every step-up confirmation is written to the timeline and the audit log.

### 4.8 Administration

- Settings area available to the Admin group: role mapping, categories & forms,
  statuses & priorities, automation rules, SLA targets, branding, vendors,
  notification defaults.
- **Audit log** of all administrative actions (who changed what, when).

## 5. Nextcloud integration

- **Embedding**: Nextcloud "External sites" app adds a menu entry rendering the
  platform in an iframe. The platform serves
  `Content-Security-Policy: frame-ancestors https://cloud.417group.org` and no
  `X-Frame-Options` header. When it detects the embedded context, it switches to
  a compact layout (hides its own top-level chrome).
- **SSO**: Nextcloud "OIDC Identity Provider" app; authorization-code flow with
  PKCE; group memberships arrive as claims. First-consent screen falls back to a
  popup if the iframe blocks it; afterwards login is silent.
- **Directory sync**: a Nextcloud service account periodically syncs all users and
  groups via the OCS Provisioning API, so staff can be assigned tickets before
  their first login.
- Cookies: `SameSite=Lax` is sufficient — both apps share the parent domain
  `417group.org`, so the iframe is same-site.

## 6. Platforms and UX

- Single responsive web UI:
  - **Mobile**: card lists, bottom navigation, large touch targets;
  - **Desktop**: tables, sidebar, rich filters;
  - **Desktop inside Nextcloud**: embedded/compact mode.
- **PWA**: installable on phones/desktops, offline app shell, Web Push.
- **Theme**: light + dark via CSS variables; follows system preference
  (`prefers-color-scheme`) with a manual override toggle.

## 7. Non-functional requirements

- Target load: tens of users, hundreds of tickets/year — a single app instance
  plus one worker is sufficient; schema and queues allow scaling later.
- All persistent state in PostgreSQL and named Docker volumes → simple backup
  (pg_dump + volume snapshots on OMV).
- English-only UI, but all strings go through an i18n layer with a single `en`
  locale so more languages can be added cheaply.
- Audit log and timeline events are append-only.

## 8. Open questions

1. **Tax handling** — assumed a single optional tax percentage/amount per record,
   no multi-rate breakdown. Confirm.
2. Nextcloud version (must support the OIDC Identity Provider and External sites
   apps) and whether apps can be installed from the App Store.
3. Let's Encrypt on NPM is confirmed; verify which challenge type is in use —
   if the site is reachable only over Tailscale, HTTP-01 cannot complete and a
   DNS-01 challenge (DNS provider API credentials in NPM) is required.
4. OMV CPU architecture (x86/ARM) — affects Docker base images.
