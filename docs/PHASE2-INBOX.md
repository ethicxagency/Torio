# Phase 2 — Omnichannel Inbox

## API Endpoints

| Module | Endpoints |
|--------|-----------|
| Channels | `GET/POST /channels`, Meta OAuth, WhatsApp connect, disconnect, sync |
| Webhooks | `GET/POST /webhooks/meta`, `GET/POST /webhooks/whatsapp` |
| Conversations | `GET /conversations`, filters, assign, tags, status |
| Messages | `GET/POST /conversations/:id/messages` |
| Customers | `GET /customers`, `GET /customers/:id` |
| Tags | `GET/POST/PATCH/DELETE /tags` |
| Notes | `GET/POST/DELETE /notes` |

## Realtime (Socket.io)

Namespace: `/inbox`

Connect with JWT in `auth.token`. Join org room via `inbox:join`.

Events: `message:new`, `message:status`, `conversation:updated`, `typing:start/stop`

## Webhook URLs (production)

- Meta: `https://your-api.railway.app/api/v1/webhooks/meta`
- WhatsApp: `https://your-api.railway.app/api/v1/webhooks/whatsapp`

## Local Testing

1. Connect channels at http://localhost:3010/settings/channels
2. Use Meta webhook tunnel (ngrok) for inbound messages
3. Or connect WhatsApp Cloud API with test credentials

## Database Models Added

- `channel_connections` — OAuth tokens, page IDs, WhatsApp phone IDs
- `oauth_states` — Meta OAuth CSRF state
- `attachments` — Message media
- `conversation_assignments` — Assignment history with assignedBy/assignedAt
- `searchText` on conversations for full-text search
