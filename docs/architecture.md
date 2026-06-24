# Architecture Design — Submission & Approval Workflow

## 1. Principles

1. **Separation of concerns** — each layer does exactly one thing; business logic never leaks into HTTP handlers.
2. **Pure-function state machine** — transition rules are free of side effects so they're trivially testable without mocking.
3. **Fail loudly at the boundary** — all external input (HTTP bodies, query params) is schema-validated before it reaches business logic.
4. **Atomic writes** — every state change and its audit record commit together or not at all.

---

## 2. Backend Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         Routes                          │
│  auth.routes.ts        application.routes.ts            │
│  Binds URL patterns to controllers                      │
│  Attaches middleware: authenticate, validate(schema)    │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                      Middleware                          │
│  authenticate       — verifies JWT, populates req.user  │
│  validate(schema)   — Zod parse, returns 400 on failure │
│  errorHandler       — catches thrown errors → 500       │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                     Controllers                          │
│  auth.controller.ts       application.controller.ts     │
│                                                         │
│  Responsibility:                                        │
│    • Read from req (params, body, user)                 │
│    • Call the appropriate service function              │
│    • Map the result to an HTTP status + JSON body       │
│    • Never touch Prisma directly                        │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                      Services                           │
│  auth.service.ts          — login, token generation     │
│  application.service.ts   — CRUD + transition dispatch  │
│  stateMachine.service.ts  — pure transition rules       │
│                                                         │
│  Responsibility:                                        │
│    • All domain rules live here                         │
│    • Calls Prisma for reads/writes                      │
│    • Returns typed result objects (never throws HTTP)   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                  Prisma Client (ORM)                    │
│  db.ts — singleton PrismaClient instance                │
│  Generated types from schema.prisma                     │
│  $transaction for atomic multi-write operations         │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   PostgreSQL 16                          │
│  Enum types enforce status/role at DB level             │
│  FK constraints ensure referential integrity            │
└─────────────────────────────────────────────────────────┘
```

---

## 3. State Machine Architecture

The state machine is designed as a **pure function** — no database access, no side effects.

```typescript
// stateMachine.service.ts

applyTransition({
  action,          // "submit" | "start_review" | "approve" | "reject" | "return_for_changes"
  currentStatus,   // ApplicationStatus from DB
  actorRole,       // Role from JWT
  isOwner,         // applicantId === actorId (computed before call)
  comment?,        // optional string
}) → TransitionResult
   // { ok: true, toStatus } | { ok: false, error: { code, message } }
```

The rule table is a static `Record<TransitionAction, TransitionRule>` — adding a new action is one entry in the map, no conditional chains.

**Why this matters:** `applyTransition` can be unit-tested with plain objects — no database, no HTTP, no mocking. All 13 test cases in `__tests__/stateMachine.test.ts` call this function directly.

The **caller** (`application.service.ts → transition()`) is responsible for:
1. Fetching current application state from the DB
2. Calling `applyTransition`
3. If `ok`, executing the `$transaction` (update status + insert audit log)
4. Returning a discriminated union result to the controller

---

## 4. Frontend Architecture

```
src/
├── main.tsx            BrowserRouter + AuthProvider mount
├── App.tsx             Route definitions + RequireAuth guards
│
├── hooks/
│   └── useAuth.tsx     Auth context: user state, login(), logout()
│                       Validates the HTTP-only auth cookie on mount
│
├── api/
│   ├── client.ts       Axios instance — sends credentials with API requests
│   ├── auth.ts         login(), getMe()
│   └── applications.ts list(), get(), create(), update(), remove(),
│                       performTransition()
│
├── types/
│   └── index.ts        Application, User, AuditLogEntry interfaces
│                       Mirrors backend response shapes
│
├── components/
│   ├── Layout.tsx      Nav bar (role-aware links), main content slot
│   ├── StatusBadge.tsx Colour-coded status pill
│   └── AuditLog.tsx    Ordered timeline of transitions
│
└── pages/
    ├── Login.tsx
    ├── applicant/
    │   ├── Dashboard.tsx          "My Applications" list
    │   ├── ApplicationForm.tsx    Create + Edit (same component, id param = edit mode)
    │   └── ApplicationDetail.tsx  Read-only detail + Submit action
    └── reviewer/
        ├── Queue.tsx              All applications, filterable by status
        └── ApplicationDetail.tsx  Detail + Approve/Reject/Return actions
```

### Auth Context Flow

```
App load
  → useAuth calls GET /api/auth/me with credentials
  → backend validates the HTTP-only JWT cookie and returns the user
  → sets user in context (or clears if expired)

RequireAuth (per route)
  → if loading: show spinner
  → if no user: redirect /login
  → if wrong role: redirect to own home
  → else: render children
```

### API Client

`client.ts` creates a single Axios instance with `withCredentials: true` so the browser sends the HTTP-only `token` cookie set during login. A response interceptor catches 401s and redirects stale sessions back to login.

---

## 5. Tech Stack Decisions

| Choice | Alternative considered | Reason |
|---|---|---|
| Express (not Fastify/Hono) | Fastify | Familiarity; assessment isn't bottlenecked by throughput |
| Prisma (not raw SQL or Knex) | Drizzle | Generated types eliminate runtime type mismatches; migration system is simple |
| Zod for validation | Joi, class-validator | Works natively with TypeScript inference; no decorators needed |
| HTTP-only JWT cookie | localStorage token | Keeps the stateless JWT flow while avoiding direct JavaScript access to the token |
| Vite (not Next.js) | Next.js | SPA is sufficient; SSR adds complexity with no assessment benefit |
| TanStack Query (React Query) | SWR, manual useState+useEffect | Handles loading/error/stale states with minimal boilerplate |
| Tailwind CSS | CSS Modules, styled-components | Utility-first is fast to iterate; no context-switching to CSS files |
| PostgreSQL (not MongoDB) | MongoDB | Relational model is a natural fit; enum types enforce correctness at the DB level |

---

## 6. Directory Structure

```
Assessment/
├── docker-compose.yml
├── README.md
├── docs/
│   ├── system-design.md      (this doc's companion)
│   ├── architecture.md       (this document)
│   └── data-flow.md
│
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── index.ts           HTTP server startup
│       ├── app.ts             Express app (middleware wiring)
│       ├── db.ts              Prisma singleton
│       ├── types/index.ts     AuthenticatedRequest, JwtPayload
│       ├── middleware/
│       │   ├── auth.middleware.ts
│       │   ├── validate.middleware.ts
│       │   └── error.middleware.ts
│       ├── routes/
│       │   ├── index.ts
│       │   ├── auth.routes.ts
│       │   └── application.routes.ts
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   └── application.controller.ts
│       └── services/
│           ├── auth.service.ts
│           ├── application.service.ts
│           ├── stateMachine.service.ts
│           └── __tests__/
│               └── stateMachine.test.ts
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types/index.ts
        ├── api/
        │   ├── client.ts
        │   ├── auth.ts
        │   └── applications.ts
        ├── hooks/useAuth.tsx
        ├── components/
        │   ├── Layout.tsx
        │   ├── StatusBadge.tsx
        │   └── AuditLog.tsx
        └── pages/
            ├── Login.tsx
            ├── applicant/
            │   ├── Dashboard.tsx
            │   ├── ApplicationForm.tsx
            │   └── ApplicationDetail.tsx
            └── reviewer/
                ├── Queue.tsx
                └── ApplicationDetail.tsx
```
