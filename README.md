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

## Key API routes

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/login` | JWT |
| GET | `/api/auth/me` | Current user |
| GET | `/api/dashboard/metrics` | Filters: `baseId`, `equipmentType`, `dateFrom`, `dateTo` |
| GET | `/api/dashboard/net-movement-detail` | Bonus popup data |
| GET/POST | `/api/purchases` | Logistics+ |
| GET/POST | `/api/transfers` | Logistics+ |
| GET/POST | `/api/assignments` | Commander+ |
| POST | `/api/assignments/:id/return` | Commander+ |
| GET/POST | `/api/expenditures` | Commander+ |
| GET | `/api/audit` | Admin / Commander |

All protected routes require `Authorization: Bearer <token>`.

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
