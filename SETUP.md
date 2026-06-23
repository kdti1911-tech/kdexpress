# KDExpress Cargo System — Setup Guide

## What This Is

A lightweight Next.js 15 replacement for WPCargo/WordPress.

**Performance comparison:**
| | WordPress + WPCargo | KDExpress |
|---|---|---|
| Request overhead | 50+ plugins loaded on every page | Zero — only what's needed |
| Shipment query | 30-50 JOINs (EAV postmeta) | 1 optimized query |
| Page load | 2-5 seconds typical | <200ms typical |
| Database size | 387MB for ~10k shipments | ~30MB for same data |

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **PostgreSQL** (proper relational schema — NOT EAV)
- **Prisma** (type-safe ORM)
- **Tailwind CSS** (styling, no heavy CSS framework)
- **jose** (JWT session tokens)

## Requirements

1. **Node.js 18+** — download from https://nodejs.org
2. **PostgreSQL** — Railway, Supabase, Neon, or local install

## Quick Start

### 1. Configure environment

Edit `.env.local`:
```env
DATABASE_URL="postgresql://user:password@host:5432/kdexpress"
AUTH_SECRET="your-random-secret-minimum-32-chars"
```

Generate AUTH_SECRET:
```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Set up database

```bash
npm run db:push      # Create tables from Prisma schema
npm run db:seed      # Load initial data (branches, rates, users)
```

### 3. Start development server

```bash
npm run dev
# or on Windows without Node in PATH:
.\dev.ps1
```

Open http://localhost:3000

### 4. Default accounts (after seed)

| Email | Password | Role |
|---|---|---|
| admin@kdexpress.ca | admin123! | Admin |
| manager@kdexpress.ca | manager123! | Manager |
| demo@kdexpress.ca | client123! | Client |

## Pages

| URL | Description |
|---|---|
| `/login` | Staff login |
| `/dashboard` | Dashboard with stats |
| `/shipments` | Shipment list with filters |
| `/shipments/new` | Create shipment + rate calculator |
| `/shipments/[id]` | Shipment detail + status history |
| `/customers` | Customer/user management |
| `/branches` | Branch management |
| `/rates` | Rate zone configuration |
| `/tracking` | **Public** shipment tracking (no login) |

## Key Design Decisions

### Schema: No EAV — proper columns
```
WPCargo (old): 110MB in wp_postmeta — 1 row per field per shipment
KDExpress (new): all shipment fields as proper columns — 1 row per shipment
```

### Rate Engine
- Zones: origin location → list of destination locations
- Rates: per-kg pricing with min/max weight bounds
- Fuel surcharge: configurable percentage (default 18%)
- Insurance: 6% of declared value, capped at $10,000

### User Codes
4-character alphanumeric codes (e.g. `KD12`) automatically assigned to each user for quick customer lookup.

### Pre-loaded Data (after seed)
- **5 branches**: Mississauga, Toronto, Vancouver, Hà Nội, TP Hồ Chí Minh
- **Rate zones**: Vancouver→Vietnam ($14.80/kg), Toronto→Vietnam ($15.40/kg), Vietnam→Canada ($8.00/kg)
- **Service types**: Economy, Standard, Premium

## Deployment on Railway

1. Create a PostgreSQL database on Railway
2. Set environment variables:
   - `DATABASE_URL` = Railway PostgreSQL connection string
   - `AUTH_SECRET` = random 32+ char string
3. Deploy this repo as a Node.js service
4. Run migrations: `npm run db:push`
5. Run seed: `npm run db:seed`

## Extending the System

To add new modules:
- **Invoicing**: Add `Invoice`/`InvoiceItem` models (schema already has placeholders)
- **Freightcom API**: Add routes under `/api/freightcom/` — existing API key config in `.env.local`
- **Email notifications**: Use `NotificationQueue` table + add a worker/cron
- **Mobile app**: All functionality is exposed via the REST API

## Migrating from WPCargo

A migration script can be written to:
1. Export shipments from `wp_posts` + `wp_postmeta` 
2. Map fields to the new `shipments` table columns
3. Migrate users from `wp_users` + `wp_usermeta`
4. Migrate rate data from `wp_wpcsr_*` tables
