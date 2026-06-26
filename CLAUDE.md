# KDExpress — Project Context for Claude

This file helps Claude Code resume work across sessions. Updated: 2026-06-26.

---

## What This Project Is

A full rebuild of a Vietnamese cargo/courier company's (KD Express, kdexpress.ca) shipment management system. The original was WordPress + WPCargo. This is a clean **Next.js 15 + PostgreSQL** replacement.

**Live deployment:** Railway (auto-deploys from GitHub push to `master`)  
**Repo:** `https://github.com/kdti1911-tech/kdexpress.git`  
**Railway deploy command** (in `railway.toml`): `npx prisma db push && npm start`

---

## Tech Stack

- **Framework:** Next.js 15 App Router (server components + client components)
- **Database:** PostgreSQL on Railway, accessed via **Prisma**
- **Styling:** Tailwind CSS — theme is **Forest Green** (`bg-green-900` sidebar, `--primary: 142.1 70.6% 29.4%`)
- **Auth:** Custom session-based (`src/lib/auth.ts`)
- **No Node.js locally** — never run `npx prisma migrate dev` locally; schema changes go via Railway's `prisma db push` on deploy

---

## Key Directories

```
src/
  app/
    (auth)/login/         Login page
    (dashboard)/          All authenticated pages (layout wraps Sidebar)
      dashboard/          Home dashboard
      shipments/          Shipment list + detail + invoice + customs-invoice + label
      manifests/          Manifest list + new + detail + pallet scan
      customers/          User management
      branches/           Branch management
      rates/              Rate management
      address-book/       Address book
  components/
    Sidebar.tsx           Green sidebar nav (bg-green-900)
    NewShipmentForm.tsx   Create shipment form
    ManifestForm.tsx      Create manifest form
    ManifestDetailClient.tsx  Manifest detail (client, useTransition auto-refresh)
    PalletScanClient.tsx  Pallet package scan (client, useTransition auto-refresh)
    UpdateStatusForm.tsx  Shipment status update
    AddressSearch.tsx     Address autocomplete
  lib/
    auth.ts               getCurrentUser(), session handling
    db.ts                 Prisma client singleton
    permissions.ts        Role-based permissions (can(role, permission))
    utils.ts              Label maps, formatters, province lists
prisma/
  schema.prisma           Full DB schema
```

---

## User Roles & Permissions

Roles: `ADMIN`, `MANAGER`, `EMPLOYEE`, `DRIVER`, `AGENT`, `AGENT_VN`, `CLIENT`

Key permissions (from `src/lib/permissions.ts`):
- `VIEW_ALL_SHIPMENTS`: ADMIN, MANAGER, EMPLOYEE, AGENT, AGENT_VN, DRIVER
- `MANAGE_BRANCHES`: ADMIN, MANAGER (used to gate manifest/pallet create/delete)
- `UPDATE_STATUS`: ADMIN, MANAGER, EMPLOYEE, DRIVER

---

## Database Schema — Key Models

```prisma
Shipment          # Main shipment record
ShipmentPackage   # Individual packages (pieces) within a shipment
StatusHistory     # Tracking history per shipment

Manifest          # A shipment batch (MNF-YYYY-MM-NNN)
  status: PLANNING → LOADING → SEALED → DISPATCHED → IN_TRANSIT → ARRIVED → CLOSED
Pallet            # Pallet within a manifest (MNF-...-P001)
  status: OPEN → SEALED
PalletPackage     # Join: pallet ↔ ShipmentPackage

Branch            # Office/warehouse locations
User              # Staff/client accounts
Rate / RateZone   # Pricing
Surcharge         # Additional fees
AddressEntry      # Saved addresses
AuditLog          # System audit trail
```

**Status cascade:** When manifest → DISPATCHED, all packages auto-set to `IN_TRANSIT`. When manifest → ARRIVED, all packages auto-set to `ARRIVED_DESTINATION`. (Handled in `src/app/api/manifests/[id]/status/route.ts`)

---

## Manifest / Pallet System

Built from scratch in this project. Key flows:

1. **Create manifest** → `/manifests/new` → `POST /api/manifests` → redirects to detail page
2. **Add pallet** → in manifest detail → `POST /api/manifests/[id]/pallets`
3. **Scan packages into pallet** → `/manifests/[id]/pallets/[palletId]` → `POST /api/manifests/[id]/pallets/[palletId]/packages` — accepts tracking with or without dashes
4. **Advance status** → buttons in manifest detail → `PATCH /api/manifests/[id]/status`
5. **Delete** → no status restrictions on delete (user decision)

**Auto-refresh pattern** (important — do not revert):  
Both `ManifestDetailClient` and `PalletScanClient` use `useTransition` + `router.refresh()` instead of local state for server data:
```tsx
const [isPending, startTransition] = useTransition();
function refresh() { startTransition(() => router.refresh()); }
// All mutations call refresh() on success
// Shows loading overlay when isPending
// Props used directly (no useState(initialProp))
```

---

## Shipping Label

Route: `/label/[tracking]` (print-optimized, 4×6 inch)

- Shows: tracking number (no dashes), shipper name, receiver name, notes, weight, destination branch name
- Does NOT show: full address, phone, dimensions
- Bottom: Vietnamese disclaimer (intentionally stays in Vietnamese — customer-facing document)

---

## UI Language

**All UI is in English.** This was unified in session 2026-06-26. Do not introduce Vietnamese strings in UI components. Exceptions:
- `VIETNAM_PROVINCES` in `lib/utils.ts` — proper nouns, stay in Vietnamese
- Shipping label disclaimer — stays in Vietnamese (customer-facing legal text)
- Customs invoice — intentionally bilingual (English / Vietnamese) for customs purposes

---

## Theme — Forest Green

Applied globally. Key classes:
- Sidebar: `bg-green-900`, active nav: `bg-green-700`, hover: `bg-green-800`
- Logo badge: `bg-green-600`
- Primary buttons: `bg-green-700 hover:bg-green-800`
- Focus rings: `ring-green-600`
- CSS var in `globals.css`: `--primary: 142.1 70.6% 29.4%`

---

## API Routes Summary

```
/api/shipments              GET list, POST create
/api/shipments/[id]         GET detail, PATCH update, DELETE
/api/shipments/[id]/status  PATCH update status
/api/manifests              GET list (with computed totals), POST create
/api/manifests/[id]         GET detail, PATCH update, DELETE
/api/manifests/[id]/status  PATCH advance status (cascades to packages)
/api/manifests/[id]/pallets               POST create pallet
/api/manifests/[id]/pallets/[palletId]    PATCH seal/unseal, DELETE
/api/manifests/[id]/pallets/[palletId]/packages  POST scan package, DELETE remove package
/api/rates/calculate        POST calculate shipping rates
/api/auth/...               Login/logout/session
```

---

## Deployment Notes

- **No local Node.js** — cannot run `npm run dev`, `npx prisma`, etc. locally
- Schema changes: edit `prisma/schema.prisma`, push to GitHub → Railway runs `prisma db push` automatically
- Never use `--accept-data-loss` on prisma db push unless explicitly required and confirmed
- Railway PostgreSQL proxy: `reseau.proxy.rlwy.net:11258` (use transiently only, do not hardcode)

---

## Recent Session Work (2026-06-26)

1. Applied Forest Green theme across all pages
2. Redesigned shipping label — 4×6", no dashes in tracking, Vietnamese disclaimer
3. Fixed destination field on label — shows `destBranch.name`
4. Built full Manifest/Pallet system — schema, API routes, all UI pages
5. Added delete for manifests and pallets (no status restrictions)
6. Implemented auto-refresh with `useTransition` in `ManifestDetailClient` and `PalletScanClient`
7. Unified all UI text to English (components, pages, label maps in utils.ts)
