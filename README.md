# Military Asset Management System (MAMS)

Initial framework for tracking critical assets (vehicles, weapons, ammunition) across multiple bases — with balance metrics, transfers, assignments/expenditures, and role-based access control.

## Live deployments

| Layer | URL |
| --- | --- |
| **Frontend** | [https://client-rho-bice-67.vercel.app/](https://client-rho-bice-67.vercel.app/) |
| **Backend** | [https://server-rho-khaki.vercel.app/](https://server-rho-khaki.vercel.app/) |

Health check: [https://server-rho-khaki.vercel.app/api/health](https://server-rho-khaki.vercel.app/api/health)

## Stack & justifications

| Layer | Choice | Why |
| --- | --- | --- |
| **Frontend** | React 19 + TypeScript + Vite | Fast DX, typed UI, responsive SPA with React Router. Vite proxy forwards `/api` to the backend in development. |
| **Backend** | Node.js + Express + TypeScript | Lightweight REST API, mature middleware ecosystem for JWT auth, RBAC, and request logging. |
| **ORM** | Prisma | Type-safe queries against Supabase Postgres. |
| **Database** | **Supabase (PostgreSQL)** | Hosted Postgres with connection pooling; ACID transactions for inventory mutations; foreign keys; RLS enabled on all tables (Data API locked down; Express uses a dedicated DB role). |

### Why relational (SQL) over NoSQL?

Asset accountability is ledger-like: every purchase, transfer, assignment, and expenditure must leave an auditable trail and keep inventory consistent. SQL gives:

- **ACID transactions** — transfer out of Base A and into Base B succeeds or rolls back together.
- **Referential integrity** — assets, bases, and users cannot drift into orphan records.
- **Aggregations** — `SUM(purchases) + SUM(transfer_in) - SUM(transfer_out)` for Net Movement is straightforward.
- **RBAC joins** — scope queries by `user.baseId` cleanly.

NoSQL would force application-level consistency for multi-document updates and weaker ad-hoc reporting for command dashboards.

### Supabase project

- **Project:** [Military Asset Management](https://supabase.com/dashboard/project/haahudqaqwonizibpcer) (`haahudqaqwonizibpcer`, region `ap-south-1`)
- Configure `server/.env` from `server/.env.example` (pooler `DATABASE_URL` + direct `DIRECT_URL`).
- Schema & seed are applied to Supabase Postgres; Prisma talks to it over SSL.

## Features implemented

- **Dashboard** — Opening Balance, Closing Balance, Net Movement (Purchases + Transfer In − Transfer Out), Assigned, Expended; filters for date / base / equipment type; **click Net Movement** for purchase / transfer-in / transfer-out detail (bonus).
- **Purchases** — create + historical list with filters.
- **Transfers** — inter-base moves with timestamped history; inventory updated atomically.
- **Assignments & Expenditures** — assign to personnel, return stock, record expended quantities.
- **RBAC (middleware)**  
  - **Admin** — all bases & operations  
  - **Base Commander** — own base; purchases, transfers, assignments, expenditures  
  - **Logistics Officer** — own base; purchases & transfers only  
- **API audit log** — every login and mutating transaction written to `AuditLog`; **Audit log** page for Admin / Base Commander (`/app/audit`).
- Opening / closing balances reconstructed from current stock by reversing ledger movements after the selected dates.

## Project layout

```
/
  client/          React SPA
  server/          Express API + Prisma
  package.json     concurrently scripts
```

## Quick start

```bash
# From repo root
npm install
npm run install:all
# Ensure server/.env points at your Supabase project (see .env.example)
npm run db:generate --prefix server   # Prisma client
npm run db:seed --prefix server       # optional re-seed via Prisma
npm run dev                           # API :4000 + UI :5173
```

Open [http://localhost:5173](http://localhost:5173).

### Demo accounts

Password for all: `Password123!`

| Role | Email |
| --- | --- |
| Admin | `admin@mams.mil` |
| Base Commander (Fort Apex) | `commander.fax@mams.mil` |
| Logistics Officer (Fort Apex) | `logistics.fax@mams.mil` |

## API documentation

**Base URL (local):** `http://localhost:4000`  
**Base URL (prod):** `https://server-rho-khaki.vercel.app`

**Auth header (protected routes):**

```http
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Roles:** `ADMIN` · `BASE_COMMANDER` · `LOGISTICS_OFFICER`  
**Equipment types:** `VEHICLE` · `WEAPON` · `AMMUNITION` · `OTHER`  
**Error shape (all failures):** `{ "error": "message" }`

| Role | Purchases / Transfers | Assignments / Expenditures | Audit |
| --- | --- | --- | --- |
| Admin | All bases | All bases | All |
| Base Commander | Own base | Own base | Own actions |
| Logistics Officer | Own base | — | — |

Non-admin users are base-scoped via JWT `baseId`. Dates are ISO-8601 strings.

---

### Health

#### `GET /api/health` — Public

**Response `200`**

```json
{ "status": "ok", "service": "mams-api" }
```

---

### Auth

#### `POST /api/auth/login` — Public

**Request**

```json
{ "email": "admin@mams.mil", "password": "Password123!" }
```

**Response `200`**

```json
{
  "token": "<jwt>",
  "user": {
    "id": "clx…",
    "email": "admin@mams.mil",
    "role": "ADMIN",
    "baseId": null,
    "name": "System Admin",
    "rank": null,
    "base": null
  }
}
```

**Errors:** `401` invalid credentials · `400` validation

#### `POST /api/auth/register` — Public

Creates `BASE_COMMANDER` or `LOGISTICS_OFFICER` only (Admin is seeded).

**Request**

```json
{
  "email": "officer@mams.mil",
  "password": "Password123!",
  "name": "Jane Doe",
  "rank": "Capt",
  "role": "LOGISTICS_OFFICER",
  "baseId": "clx…"
}
```

Password: min 8 chars, must include a letter and a number. `rank` optional.

**Response `201`** — same shape as login (`token` + `user` with `base`).

**Errors:** `409` email exists · `400` base not found / validation

#### `POST /api/auth/change-password` — Public

**Request**

```json
{
  "email": "admin@mams.mil",
  "currentPassword": "Password123!",
  "newPassword": "NewPass456!"
}
```

**Response `200`**

```json
{
  "message": "Password updated successfully",
  "token": "<jwt>",
  "user": { "id": "…", "email": "…", "role": "…", "baseId": null, "name": "…", "rank": null, "base": null }
}
```

**Errors:** `401` bad email/current password · `400` new equals current / validation

#### `GET /api/auth/me` — Bearer

**Response `200`**

```json
{
  "id": "clx…",
  "email": "admin@mams.mil",
  "name": "System Admin",
  "rank": null,
  "role": "ADMIN",
  "baseId": null,
  "base": null
}
```

---

### Bases & assets

#### `GET /api/bases/public` — Public

Used by the registration form.

**Response `200`**

```json
[
  { "id": "clx…", "name": "Fort Apex", "code": "FAX", "location": "…" }
]
```

#### `GET /api/bases` — Bearer (any role)

**Response `200`** — full `Base` rows (`id`, `name`, `code`, `location`, `createdAt`, `updatedAt`).

#### `GET /api/assets` — Bearer (any role)

**Response `200`**

```json
[
  {
    "id": "clx…",
    "name": "M4 Carbine",
    "equipmentType": "WEAPON",
    "unit": "unit",
    "serialPrefix": "M4",
    "description": null,
    "createdAt": "…",
    "updatedAt": "…"
  }
]
```

---

### Dashboard

Shared query params (optional): `baseId`, `equipmentType`, `dateFrom`, `dateTo`  
Defaults: current calendar month to today; non-admin forced to own base.

#### `GET /api/dashboard/metrics` — Bearer

**Example:** `/api/dashboard/metrics?baseId=…&equipmentType=WEAPON&dateFrom=2026-09-01&dateTo=2026-09-26`

**Response `200`**

```json
{
  "filters": {
    "baseId": "clx…",
    "equipmentType": "WEAPON",
    "dateFrom": "2026-09-01T00:00:00.000Z",
    "dateTo": "2026-09-26T23:59:59.999Z"
  },
  "metrics": {
    "openingBalance": 100,
    "closingBalance": 120,
    "netMovement": 25,
    "purchases": 30,
    "transferIn": 5,
    "transferOut": 10,
    "assigned": 8,
    "expended": 2
  }
}
```

`netMovement` = `purchases + transferIn − transferOut`.

#### `GET /api/dashboard/net-movement-detail` — Bearer

Same query params as metrics.

**Response `200`**

```json
{
  "purchases": [ { "id": "…", "quantity": 10, "asset": {…}, "base": {…}, "createdBy": { "name": "…" }, "…": "…" } ],
  "transferIn": [ { "id": "…", "fromBase": {…}, "toBase": {…}, "asset": {…}, "…" : "…" } ],
  "transferOut": [ { "…" : "…" } ]
}
```

---

### Purchases — Bearer · `ADMIN` | `BASE_COMMANDER` | `LOGISTICS_OFFICER`

#### `GET /api/purchases`

**Query:** `baseId`, `equipmentType`, `dateFrom`, `dateTo` (all optional)

**Response `200`** — array of purchases with `asset`, `base`, `createdBy` (`id`, `name`, `email`).

#### `POST /api/purchases`

**Request**

```json
{
  "baseId": "clx…",
  "assetId": "clx…",
  "quantity": 50,
  "unitCost": 1200.5,
  "purchasedAt": "2026-09-20T10:00:00.000Z",
  "vendor": "Acme Arms",
  "notes": "Q3 restock"
}
```

`unitCost`, `purchasedAt`, `vendor`, `notes` optional. Increments inventory atomically.

**Response `201`** — created purchase with `asset`, `base`.

#### `PUT /api/purchases/:id`

**Request** — any subset of create fields (partial update). Reverses old inventory impact, applies new.

**Response `200`** — updated purchase.

#### `DELETE /api/purchases/:id`

**Response `204`** — empty body. Fails if inventory would go negative.

---

### Transfers — Bearer · `ADMIN` | `BASE_COMMANDER` | `LOGISTICS_OFFICER`

Officers/commanders may only transfer **from** their own base.

#### `GET /api/transfers`

**Query:** `baseId`, `equipmentType`, `dateFrom`, `dateTo`  
When `baseId` is set (or scoped), returns transfers where that base is source **or** destination.

**Response `200`** — array with `asset`, `fromBase`, `toBase`, `createdBy`.

#### `POST /api/transfers`

**Request**

```json
{
  "fromBaseId": "clx…",
  "toBaseId": "clx…",
  "assetId": "clx…",
  "quantity": 10,
  "transferredAt": "2026-09-21T12:00:00.000Z",
  "notes": "Resupply"
}
```

`transferredAt`, `notes` optional. `fromBaseId` ≠ `toBaseId`. Status set to `COMPLETED`.

**Response `201`** — transfer with `asset`, `fromBase`, `toBase`.

**Errors:** `400` insufficient inventory / same base

#### `PUT /api/transfers/:id` · `DELETE /api/transfers/:id`

Partial body for PUT (same fields as create). DELETE → `204`. Both reverse/reapply inventory in a transaction.

---

### Assignments — Bearer · `ADMIN` | `BASE_COMMANDER`

#### `GET /api/assignments`

**Query:** `baseId`, `equipmentType`, `dateFrom`, `dateTo`, `activeOnly=true` (only `returnedAt: null`)

**Response `200`** — array with `asset`, `base`, `createdBy` (`id`, `name`).

#### `POST /api/assignments`

**Request**

```json
{
  "baseId": "clx…",
  "assetId": "clx…",
  "quantity": 2,
  "personnelName": "Sgt. Rivera",
  "personnelId": "P-1024",
  "assignedAt": "2026-09-22T08:00:00.000Z",
  "notes": "Patrol kit"
}
```

`personnelId`, `assignedAt`, `notes` optional. Decrements on-hand stock (reserved).

**Response `201`** — assignment with `asset`, `base`.

#### `POST /api/assignments/:id/return`

No body. Sets `returnedAt` and restores inventory.

**Response `200`** — updated assignment.

**Errors:** `400` already returned · `404` not found

#### `PUT /api/assignments/:id` · `DELETE /api/assignments/:id`

Cannot edit a returned assignment. DELETE restores stock if still active → `204`.

---

### Expenditures — Bearer · `ADMIN` | `BASE_COMMANDER`

#### `GET /api/expenditures`

**Query:** `baseId`, `equipmentType`, `dateFrom`, `dateTo`

**Response `200`** — array with `asset`, `base`, `createdBy`.

#### `POST /api/expenditures`

**Request**

```json
{
  "baseId": "clx…",
  "assetId": "clx…",
  "quantity": 5,
  "reason": "Live-fire exercise",
  "expendedAt": "2026-09-23T16:00:00.000Z",
  "notes": "Range day"
}
```

`expendedAt`, `notes` optional. Permanently decrements inventory.

**Response `201`** — expenditure with `asset`, `base`.

#### `PUT /api/expenditures/:id` · `DELETE /api/expenditures/:id`

Partial update / delete with inventory reverse+reapply. DELETE → `204`.

---

### Audit — Bearer · `ADMIN` | `BASE_COMMANDER`

#### `GET /api/audit`

**Query:** `limit` (default 100, max 500), `action`, `entityType`, `dateFrom`, `dateTo`  
Base commanders only see rows where `userId` is themselves.

**Response `200`**

```json
[
  {
    "id": "clx…",
    "action": "PURCHASE_CREATE",
    "entityType": "Purchase",
    "entityId": "clx…",
    "details": "{\"baseId\":\"…\",\"quantity\":50}",
    "userId": "clx…",
    "ipAddress": "::1",
    "createdAt": "2026-09-26T06:00:00.000Z",
    "user": { "name": "…", "email": "…", "role": "ADMIN" }
  }
]
```

Common `action` values: `LOGIN`, `REGISTER`, `PASSWORD_CHANGE`, `PURCHASE_*`, `TRANSFER_*`, `ASSIGNMENT_*`, `EXPENDITURE_*`.

---

## Assumptions & limitations

- Password recovery is **change-password** (current + new), not email reset.
- Admin accounts are seeded; public registration is limited to Base Commander and Logistics Officer.
- Inventory mutations rely on Express + Prisma transactions; Supabase RLS is enabled to lock down the Data API (no anon policies).

## Data model (high level)

- **Base / User / Asset** — organizational master data; users optionally bound to a base.
- **InventoryBalance** — current on-hand qty per `(base, asset)`.
- **Purchase / Transfer / Assignment / Expenditure** — movement ledgers that drive balances.
- **AuditLog** — immutable operational trail.

Net Movement for a period:

`Purchases + Transfers In − Transfers Out`

Opening balance is reconstructed as on-hand inventory at the start of the selected period (current stock reversed by all ledger movements after that instant). Closing balance is inventory as of the period end date.

## Security notes (framework)

- Passwords hashed with bcrypt; JWT expires in 12h.
- Role checks via `authorize(...roles)` middleware; base scope via `assertBaseAccess`.
- Replace `JWT_SECRET` in `server/.env` before any real deployment.
- Prefer PostgreSQL + HTTPS + hardened CORS in production.
