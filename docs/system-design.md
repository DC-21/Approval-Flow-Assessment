# System Design — Submission & Approval Workflow

## 1. Problem Statement

We need a two-sided web application where **Applicants** submit requests for review and **Reviewers** triage them through a strictly enforced approval lifecycle. The core constraint is correctness: illegal state transitions must be rejected at the server, and every transition must leave an immutable audit trail.

---

## 2. High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                           │
│                                                                     │
│   ┌───────────────────────┐   ┌──────────────────────────────────┐  │
│   │   Applicant Views     │   │      Reviewer Views              │  │
│   │  Dashboard            │   │  Queue (filterable by status)    │  │
│   │  Create / Edit Form   │   │  Application Detail              │  │
│   │  Application Detail   │   │  Approve / Reject / Return       │  │
│   └───────────┬───────────┘   └──────────────┬───────────────────┘  │
│               │  React (Vite + TypeScript)   │                      │
│               └──────────────┬───────────────┘                      │
│                              │ HTTP/JSON (HTTP-only JWT cookie)     │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Backend API       │
                    │   Express + TS      │
                    │   Port 3001         │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │  Auth (JWT)   │  │
                    │  ├───────────────┤  │
                    │  │ Applications  │  │
                    │  │   CRUD        │  │
                    │  ├───────────────┤  │
                    │  │  Transitions  │  │
                    │  │ (State Machine│  │
                    │  └───────────────┘  │
                    └──────────┬──────────┘
                               │ Prisma ORM
                    ┌──────────▼──────────┐
                    │    PostgreSQL 16     │
                    │                     │
                    │  users              │
                    │  applications       │
                    │  audit_logs         │
                    └─────────────────────┘
```

---

## 3. Components

### 3.1 Frontend (React + TypeScript + Vite)

| Layer | Purpose |
|---|---|
| `pages/` | Route-level components (one per screen) |
| `components/` | Shared UI: Layout, StatusBadge, AuditLog |
| `hooks/useAuth` | Auth context — exposes `user`, `login`, `logout`, `loading` |
| `api/` | Typed wrappers around `axios` — one module per resource |
| `types/` | Shared TypeScript interfaces mirroring the API response shapes |

Role-gating is enforced at the route level: `RequireAuth` checks the JWT-decoded role in context and redirects to the appropriate home page if mismatched. This is defence-in-depth on the client side; the server enforces the same rules independently.

### 3.2 Backend (Node.js + Express + TypeScript)

Layered from the outside in:

```
Request
  → Routes (URL → controller binding, schema validation)
  → Middleware (authenticate, validate, errorHandler)
  → Controllers (HTTP translation — reads req, writes res)
  → Services (business logic — stateMachine, application CRUD)
  → Prisma (query builder / ORM)
  → PostgreSQL
```

Each layer has a single responsibility. Controllers never touch Prisma directly; services never touch `req`/`res`.

### 3.3 Database (PostgreSQL 16 via Prisma)

Three tables — covered in detail in the [Data Model](#5-data-model) section. Prisma manages migrations and generates a fully-typed client used throughout the backend.

---

## 4. Deployment Topology

```
docker-compose.yml
│
├── service: postgres
│     image: postgres:16-alpine
│     volume: pgdata (named, persistent)
│     port: 5432 (internal only)
│
├── service: backend
│     build: ./backend/Dockerfile
│     port: 3001 → host
│     depends_on: postgres
│     env: DATABASE_URL, JWT_SECRET, PORT
│     entrypoint: migrate → start
│
└── service: frontend
      build: ./frontend/Dockerfile
      port: 80 → host
      nginx reverse-proxy: /api/* → backend:3001
```

In local dev (without Docker) Vite's dev server proxies `/api` to `localhost:3001`, so there is no CORS issue during development.

---

## 5. Data Model

```
┌──────────────────────────────────┐
│             User                 │
│  id          UUID PK             │
│  email       TEXT UNIQUE         │
│  name        TEXT                │
│  password    TEXT (bcrypt hash)  │
│  role        APPLICANT|REVIEWER  │
│  createdAt   TIMESTAMPTZ         │
│  updatedAt   TIMESTAMPTZ         │
└──────────┬───────────────────────┘
           │ 1
           │ owns
           │ N
┌──────────▼───────────────────────┐
│          Application             │
│  id          UUID PK             │
│  title       TEXT                │
│  category    ENUM                │
│  description TEXT                │
│  amount      DECIMAL(12,2)?      │
│  status      ApplicationStatus   │
│  applicantId UUID FK → User      │
│  createdAt   TIMESTAMPTZ         │
│  updatedAt   TIMESTAMPTZ         │
└──────────┬───────────────────────┘
           │ 1
           │ has
           │ N
┌──────────▼───────────────────────┐
│           AuditLog               │
│  id            UUID PK           │
│  applicationId UUID FK           │
│  actorId       UUID FK → User    │
│  fromStatus    ApplicationStatus?│
│  toStatus      ApplicationStatus │
│  comment       TEXT?             │
│  createdAt     TIMESTAMPTZ       │
└──────────────────────────────────┘
```

**Key design choices:**
- `fromStatus` is nullable to accommodate the initial creation log entry (null → DRAFT).
- `AuditLog` rows are append-only — no update or delete paths exist in the application layer.
- `Application.status` is a PostgreSQL enum rather than a plain string to enforce valid values at the DB level.
- Transition atomicity: `application.status` update and `AuditLog` insert happen inside a single `$transaction`, so a crash between the two is impossible.

---

## 6. Authentication & Authorization

| Layer | Mechanism |
|---|---|
| Login | Email + password → bcrypt compare → signed JWT in an HTTP-only cookie (7-day expiry) |
| Request auth | `token` cookie → `authenticate` middleware verifies signature |
| Role enforcement | Controller checks `req.user.role` before every mutation |
| Ownership checks | Controller compares `req.user.userId` to `application.applicantId` |
| State machine | Pure function validates role + ownership + current status before any DB write |

The rule is: **never trust the client**. Even if the UI hides the approve button from an applicant, the API will return 403 if they attempt the transition directly.

---

## 7. Error Handling

All errors are structured JSON: `{ "error": "<message>" }`.

| Scenario | HTTP status |
|---|---|
| Missing / invalid token | 401 |
| Wrong role or not owner | 403 |
| Resource not found | 404 |
| Illegal state transition | 422 |
| Missing required comment | 400 |
| Validation (Zod schema) | 400 with `{ errors: [...] }` |
| Unhandled exceptions | 500 (caught by `errorHandler` middleware) |

---

## 8. What's Out of Scope (and Why)

| Feature | Decision |
|---|---|
| User registration | Seeded users are sufficient; registration adds auth surface area with no assessment value |
| Refresh tokens | 7-day JWT is acceptable for a prototype; production would add refresh + revocation |
| File attachments | Skipped to keep scope tight; would use S3 presigned URLs + `attachmentUrl` field |
| Pagination | Implemented as simple `page`/`limit` offset pagination; cursor pagination would be the production upgrade for large queues |
| Email notifications | Stretch goal — skipped to protect test coverage and core quality |
