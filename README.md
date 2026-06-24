# Submission & Approval Workflow

Full-stack assessment — Assignment B.

## Live Demo

> URL: _pending final deployment_
>
> | Role | Email | Password |
> |---|---|---|
> | Applicant | alice@test.com | applicant-alice-9f2k |
> | Applicant | bob@test.com | applicant-bob-7m3p |
> | Reviewer | reviewer@test.com | reviewer-carol-4x8w |

---

## Running Locally

### Option A — Docker (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:3002
- Swagger docs: http://localhost:3002/api/docs

The backend container automatically runs database migrations on startup. To seed test users, run once:

```bash
docker compose exec backend npm run db:seed
```

### Option B — Manual

**Prerequisites:** Node 22+, PostgreSQL 16+

**Backend**

```bash
cd backend
cp .env.example .env          # set DATABASE_URL, JWT_SECRET
npm install
npm run db:generate
npx prisma migrate dev
npm run db:seed
npm run dev                   # :3001
```

**Frontend**

```bash
cd frontend
npm install
npm run dev                   # :5173, proxies /api → :3001
```

---

## Architecture

```
backend/
├── src/
│   ├── index.ts              # entry point
│   ├── app.ts                # Express setup
│   ├── db.ts                 # Prisma singleton
│   ├── types/                # shared TypeScript types
│   ├── middleware/            # auth, validate, error
│   ├── services/             # stateMachine, auth, application (business logic)
│   ├── controllers/          # request/response handlers
│   └── routes/               # route definitions
└── prisma/
    ├── schema.prisma
    └── seed.ts

frontend/
└── src/
    ├── api/                  # typed API functions (axios)
    ├── hooks/                # useAuth context
    ├── components/           # Layout, StatusBadge, AuditLog
    ├── pages/
    │   ├── applicant/        # Dashboard, ApplicationForm, ApplicationDetail
    │   └── reviewer/         # Queue, ApplicationDetail
    └── types/                # shared TS types
```

---

## Data Model

```
User
  id, email, name, password (bcrypt), role (APPLICANT | REVIEWER)

Application
  id, title, category, description, amount?, status, applicantId → User

AuditLog
  id, applicationId → Application, actorId → User,
  fromStatus?, toStatus, comment?, createdAt
```

Every state transition atomically updates `Application.status` and inserts an `AuditLog` row in a single Prisma transaction, so the audit trail is always consistent.

Submissions store `applicantId` as a foreign key; the full user record is joined on read. Historical integrity is preserved because `AuditLog` rows are immutable — they record `fromStatus` and `toStatus` at the time of the transition, independent of future state changes.

---

## Workflow / State Machine

```
DRAFT ──submit──► SUBMITTED ──start_review──► UNDER_REVIEW ──approve──► APPROVED
  ▲                                                         ├──reject──► REJECTED
  └────────────────────── return_for_changes ◄──────────────┘
```

Rules enforced server-side in `src/services/stateMachine.service.ts`:

| Action | From | To | Who | Comment required |
|---|---|---|---|---|
| submit | DRAFT | SUBMITTED | Applicant (owner only) | No |
| start_review | SUBMITTED | UNDER_REVIEW | Reviewer | No |
| approve | UNDER_REVIEW | APPROVED | Reviewer | No |
| reject | UNDER_REVIEW | REJECTED | Reviewer | **Yes** |
| return_for_changes | UNDER_REVIEW | DRAFT | Reviewer | **Yes** |

Illegal transitions → 422. Wrong role → 403. Missing comment → 400.

---

## API Reference

```
POST  /api/auth/login
GET   /api/auth/me

GET   /api/applications             ?status= filter (reviewer sees all; applicant sees own)
POST  /api/applications             applicant only
GET   /api/applications/:id
PUT   /api/applications/:id         applicant owner, DRAFT only
DELETE /api/applications/:id        applicant owner, DRAFT only
POST  /api/applications/:id/transitions  { action, comment? }
```

---

## Testing

```bash
cd backend && npm test
```

14 tests total:

- 13 unit tests covering the state machine — all legal transitions, all illegal ones (wrong role, wrong status, missing comment, non-owner submit).
- 1 API authorization test proving a forbidden applicant transition returns 403.

---

## Design Decisions & Trade-offs

**State machine as pure function.** `applyTransition` takes plain values and returns a typed result — no DB access, no side effects. This makes it trivially unit-testable without mocking anything.

**Service / Controller split.** Business logic lives in services; controllers only translate HTTP in/out. Routes wire schemas onto controllers via a `validate` middleware.

**Prisma transaction on transition.** `application.update` + `auditLog.create` run in a single `$transaction` so a partial failure can't leave the audit trail out of sync.

**HTTP-only JWT cookie with 7-day expiry.** No refresh tokens — acceptable for an assessment. Production would add refresh + revocation.

**No pagination.** The applicant list and reviewer queue load all records. With more time: cursor-based pagination with `take`/`cursor` in Prisma.

**No file attachments.** Skipped to keep scope tight. Would add S3 presigned URLs + a `attachmentUrl` field on `Application`.

**Auth is seeded, not self-serve.** Registration isn't a requirement; seeded users keep the auth surface minimal and auditable.

---

## AI Tools Used

- **Claude Code (claude-sonnet-4-6)** — used throughout to scaffold the project structure, generate boilerplate (Dockerfiles, Tailwind setup, Vite config), and draft the full codebase. All logic was reviewed and understood before committing: the state machine rules, the Prisma transaction pattern, the JWT middleware chain, and the React routing/auth context.
- Every AI-generated piece was verified by reading the output, running the tests, and manually tracing the auth + transition flows.
