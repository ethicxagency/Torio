# Phase 3 — Customer & Team Management (CRM Lite)

## Overview

Phase 3 extends the Torio standalone SaaS platform with CRM capabilities built on existing multi-tenant architecture, RBAC, and omnichannel inbox.

## Database Models

| Model | Purpose |
|-------|---------|
| `Customer` (extended) | Status, type, lead source, assigned agent, created by |
| `CustomerSegment` | System + custom audience filters |
| `CustomerAssignment` | Customer-level assignment history |
| `Activity` | Unified customer timeline events |
| `OrganizationCrmSettings` | Auto-assignment strategy (round robin, least busy) |
| `CustomerTag` | Tags on customers |
| `Note` | Internal notes (customer + conversation) |

### Enums

- `CustomerStatus`: NEW_LEAD, INTERESTED, FOLLOW_UP, NEGOTIATION, CUSTOMER, LOST
- `CustomerType`: LEAD, PROSPECT, CUSTOMER, VIP
- `LeadSource`: MESSENGER, INSTAGRAM, WHATSAPP, WEBSITE, REFERRAL, MANUAL, OTHER
- `ActivityType`: CONVERSATION_CREATED, AGENT_ASSIGNED, CUSTOMER_ASSIGNED, TAG_ADDED, TAG_REMOVED, NOTE_ADDED, CUSTOMER_UPDATED, STATUS_UPDATED, CONVERSATION_CLOSED

## API Endpoints

### Customers (`/api/v1/customers`)
- `GET /` — list with search, filters, pagination, segment, agent scope for AGENT role
- `GET /:id` — full profile with channels, conversations, tags
- `PATCH /:id` — update profile and status
- `POST /:id/assign` | `POST /:id/unassign`
- `POST /:id/tags/:tagId` | `DELETE /:id/tags/:tagId`
- `POST /bulk` — bulk status, tag, assign
- `POST /import` — CSV row import
- `GET /export/csv` — export customers
- `GET /analytics/summary` — CRM metrics
- `GET /crm-settings` | `PATCH /crm-settings` — auto assignment

### Activities (`/api/v1/customers/:id/activities`)
- Timeline events for customer profile

### Segments (`/api/v1/segments`)
- CRUD + count customers per segment

### Team (`/api/v1/team`)
- Invite, role change, remove, suspend, reactivate, pending invitations

### Analytics (`/api/v1/analytics`)
- `GET /team-performance` — per-agent metrics

### Notes (`/api/v1/notes`)
- `GET /customer/:customerId` — customer notes

## UI Screens

| Route | Description |
|-------|-------------|
| `/customers` | CRM table with search, filters, bulk actions, analytics cards |
| `/customers/[id]` | Profile, timeline, conversations, notes, assignment, tags |
| `/settings/team` | Invite, roles, suspend/reactivate |
| `/settings/tags` | Create/edit/delete tags |

## Security

- All queries scoped by `organizationId`
- `AGENT` role sees only assigned customers
- RBAC permissions: `customers:read/update`, `tags:manage`, `team:*`, `analytics:read`
- Internal notes never exposed to customers
- Activity logging on CRM mutations

## Auto Assignment

Configure via `PATCH /customers/crm-settings`:
- `ROUND_ROBIN` — rotate across active agents
- `LEAST_BUSY` — assign to agent with fewest open conversations

Used by `AssignmentsService.autoAssignConversation()` when enabled.
