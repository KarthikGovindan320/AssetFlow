# AssetFlow

### Own every laptop, badge, key, and conference room — without a spreadsheet graveyard

**AssetFlow** is an enterprise asset & resource management system: register physical inventory, put it in the right hands, move it safely between people and teams, and see what is free, held, overdue, or in limbo — from one TypeScript stack.

No Firebase. No mock JSON. No “coming soon” buttons on the core path.  
**Express + Prisma + PostgreSQL** API. **React + Vite + Tailwind** UI. **JWT + RBAC** end to end.

Built under hackathon fire by **Karthik**, **Vishnu**, and **Ann**.

---

## Why it exists

Every company invents the same tragedy:

| Spreadsheet reality | AssetFlow |
|---|---|
| “Who has the MacBook?” → Slack archaeology | Active allocation → named holder, expected return |
| Double-assign the same projector | **409 Conflict** + DB unique partial index |
| Asset tags collide under concurrent register | Postgres `SEQUENCE` → `AF-0001`, `AF-0002`, … |
| Status means whatever the intern typed | Explicit **lifecycle state machine** |
| Anyone edits anything | **4-role RBAC** on every mutating route |

---

## What ships in this repo

### Backend — solid core

| Domain | What you get |
|--------|----------------|
| **Auth** | Signup (always as Employee), login, logout, `/me`, rotating refresh tokens, forgot + reset password |
| **Departments** | Hierarchy, tree view, activate / deactivate, public options list for forms |
| **Employees** | Directory, profile updates, **admin-only role changes** |
| **Categories** | Asset categories with structured definitions for registration |
| **Assets** | CRUD, search/list, locations, status transitions, auto tags `AF-####` |
| **Allocations** | Assign to **user XOR department**, return flow, conflict-aware create |
| **Transfers** | Request → approve / reject pipeline with role gates |
| **Dashboard** | Live KPIs: available / allocated stock, open maintenance counts, active bookings, pending transfers, overdue & upcoming returns |

Cross-cutting:

- Zod validation on env + request bodies  
- Helmet, CORS, rate-limited auth endpoints  
- Structured `ApiError` responses (incl. **409** for real conflicts)  
- Vitest unit + integration tests (status machine, allocation conflict, auth/RBAC)

### Data model — full lifecycle schema

Prisma models (and enums) cover more than the first-wave HTTP modules — so the database is ready for the rest of the product surface:

**Users · Departments · Categories · Assets · Allocations · Transfer requests · Bookings · Maintenance · Audit cycles / assignments / items · Notifications · Activity log**

Asset statuses:  
`AVAILABLE → ALLOCATED → RESERVED → UNDER_MAINTENANCE → LOST → RETIRED → DISPOSED`  
(with legal transitions enforced in code via the status machine).

### Frontend — product UI

React screens and shell for the operator workflow:

| Screen | Role in the product |
|--------|---------------------|
| **Login / Signup / Forgot password** | JWT session entry |
| **Dashboard** | KPI cards, overdue vs upcoming returns |
| **Asset directory + detail** | Register, filter by lifecycle state, inspect history-ready detail |
| **Allocation & transfers** | Put assets in hands; move them with approval |
| **Bookings** | Resource calendar UI |
| **Reports** | Analytics surface |

UI stack: React 19, React Router, React Hook Form + Zod, Tailwind 4, IBM Plex, Lucide, CVA-based primitives.

---

## Architecture at a glance

```
┌─────────────────┐     JWT      ┌──────────────────────┐     Prisma     ┌────────────┐
│  React (Vite)   │ ──────────►  │  Express /api/v1/*    │ ────────────► │ PostgreSQL │
│  feature pages  │ ◄──────────  │  modules + RBAC       │ ◄──────────── │ migrations │
└─────────────────┘   JSON/409   └──────────────────────┘   constraints  └────────────┘
```

| Layer | Choice | Why |
|-------|--------|-----|
| API | Express 4 + TypeScript | Boring, auditable HTTP |
| ORM | Prisma 6 | Schema-first migrations in git |
| DB | PostgreSQL 16 | Partial unique indexes, CHECK constraints, sequences |
| Auth | JWT access (~15m) + refresh (~7d) | Stateless API, bcrypt password hashes |
| Validation | Zod | One vocabulary for env, body, query |
| UI | React + Vite + Tailwind | Fast product UI without a component zoo |

---

## Roles (RBAC)

| Role | Intended power |
|------|----------------|
| **ADMIN** | Full control — org structure, roles, assets, allocations, transfers |
| **ASSET_MANAGER** | Register/update assets, allocate & return, approve transfers |
| **DEPARTMENT_HEAD** | Allocate within own department; approve relevant transfers |
| **EMPLOYEE** | Day-to-day use; signup always lands here |

Mutating routes take `requireAuth` + `requireRole(...)`. Department heads cannot allocate outside their org boundary — the service layer enforces it, not just the UI.

---

## Hard guarantees (the fun parts)

**1. One active holder per asset**  
Application checks for an open allocation and returns a structured **409** naming the current holder. The database backs it up:

```sql
CREATE UNIQUE INDEX one_active_allocation_per_asset
  ON "Allocation" ("assetId")
  WHERE "returnedAt" IS NULL;
```

**2. Exactly one allocation target**  
CHECK constraint: user **or** department — never both, never neither. Same idea on transfer recipients.

**3. Collision-free asset tags**  
Not `MAX(tag)+1`. A real sequence:

```sql
CREATE SEQUENCE asset_tag_seq START 1;
-- → AF-0001, AF-0002, ...
```

**4. Legal status transitions only**  
`asset-status-machine` defines who can move where; illegal jumps fail closed.

**5. Auth that behaves like production**  
Short-lived access tokens, rotating refresh, rate limits on login/signup/forgot, password reset flow on the API.

---

## API surface (implemented routers)

Base path: **`/api/v1`**

| Prefix | Capabilities |
|--------|----------------|
| `GET /health` | Liveness |
| `/auth` | `signup`, `login`, `refresh`, `logout`, `me`, `forgot-password`, `reset-password` |
| `/departments` | list, tree, CRUD-ish, activate/deactivate, `/options` |
| `/employees` | list, get, patch, set role |
| `/categories` | list, get, create, update, delete |
| `/assets` | list, get, create, update, `PATCH :id/status`, locations |
| `/allocations` | list, create, `POST :id/return` |
| `/transfer-requests` | list, create, approve, reject |
| `/dashboard/kpis` | Aggregate cards + overdue/upcoming return lists |

Wire format: JSON. Auth: `Authorization: Bearer <accessToken>`.

---

## Project layout

```
AssetFlow/
├── docker-compose.yml          # Postgres 16
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Full domain model
│   │   ├── migrations/         # init · tag sequence · allocation guards
│   │   └── seed.ts             # Bootstrap admin
│   ├── src/
│   │   ├── app.ts              # HTTP app + route mount
│   │   ├── server.ts
│   │   ├── config/env.ts       # Zod-validated env
│   │   ├── lib/                # jwt, password, prisma, status machine, …
│   │   ├── middleware/         # auth, rbac, rate-limit, errors
│   │   └── modules/            # auth · departments · employees · categories
│   │                           # assets · allocations · transfers · dashboard
│   └── tests/                  # vitest + supertest integration
└── frontend/
    ├── src/
    │   ├── api/types.ts
    │   ├── components/         # shell, KPI, table primitives, fields
    │   ├── features/           # auth · dashboard · assets · allocations
    │   │                       # bookings · reports
    │   ├── lib/                # format, utils
    │   └── routes/
    └── vite.config.ts
```

---

## Quick start

### Prerequisites

- Node.js 20+  
- Docker (for Postgres)  
- npm

### 1. Database

```bash
docker compose up -d
```

Postgres listens on `localhost:5432`  
User / password / db: `assetflow` / `assetflow_dev` / `assetflow`

### 2. Backend

```bash
cd backend
cp .env.example .env   # or create .env with the values below
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

**Environment** (see `backend/src/config/env.ts`):

```env
DATABASE_URL="postgresql://assetflow:assetflow_dev@localhost:5432/assetflow?schema=public"
PORT=4000
CORS_ORIGIN="http://localhost:5173"
JWT_ACCESS_SECRET="replace-with-long-random-string"
JWT_REFRESH_SECRET="replace-with-another-long-random-string"
ACCESS_TOKEN_TTL="15m"
REFRESH_TOKEN_TTL_DAYS=7
BCRYPT_ROUNDS=10
NODE_ENV=development
```

**Seed admin**

| Field | Value |
|-------|--------|
| Email | `admin@assetflow.io` |
| Password | `Admin@123` |

API default: **http://localhost:4000**  
Health: `GET /api/v1/health`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

UI default: **http://localhost:5173**

### 4. Tests

```bash
cd backend
npm test
```

Covers the asset status machine, allocation conflict behaviour, and auth/RBAC integration paths.

---

## Typical happy path

1. **Login** as admin (`admin@assetflow.io` / `Admin@123`)  
2. **Create departments** and promote users via employee role endpoints  
3. **Define categories**, then **register assets** → tags like `AF-0001`  
4. **Allocate** to a user or a department (second active allocate → **409**)  
5. **Request a transfer** when someone else needs it; approve as manager/head  
6. **Return** the asset; watch **dashboard KPIs** and overdue lists update  
7. Transition status only along the legal machine (e.g. maintenance, retired, disposed)

---

## Design principles

1. **Database is a partner, not a dump** — partial unique indexes and CHECKs catch races the app might miss.  
2. **409 means something** — conflicts are product events (who holds it?), not generic 500s.  
3. **Roles are server-side** — the UI can hide buttons; the API still enforces.  
4. **Schema first** — migrations live in git; the model already describes bookings, maintenance, audits, notifications, and activity for the next modules.  
5. **TypeScript everywhere** — one language from Prisma client to React forms.

---

## Stack badge rack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-Express-222?style=flat&logo=nodedotjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)

---

## Team

| | |
|--|--|
| **Karthik** | Core backend — auth, assets, allocations, transfers, constraints |
| **Vishnu** | UI shell, dashboard, asset & allocation experience |
| **Ann** | Product modules & domain expansion |

---

## License

ISC (see `backend/package.json`). Use it, fork it, allocate it responsibly.

---

<p align="center">
  <strong>AssetFlow</strong> — track it · allocate it · transfer it · return it.<br/>
  <sub>Built to replace the spreadsheet before the next audit does.</sub>
</p>
