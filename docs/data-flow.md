# Data Flow Design — Submission & Approval Workflow

## 1. Authentication Flow

```
Client                          Backend                        PostgreSQL
  │                               │                               │
  │  POST /api/auth/login         │                               │
  │  { email, password }          │                               │
  ├──────────────────────────────►│                               │
  │                               │  SELECT * FROM users          │
  │                               │  WHERE email = $1             │
  │                               ├──────────────────────────────►│
  │                               │◄──────────────────────────────┤
  │                               │  { id, email, role, password }│
  │                               │                               │
  │                               │  bcrypt.compare(             │
  │                               │    input, hash)              │
  │                               │                               │
  │  200 { user } + Set-Cookie    │  jwt.sign({ userId, role })   │
  │◄──────────────────────────────┤                               │
  │                               │                               │
  │  [browser stores httpOnly     │                               │
  │   token cookie]               │                               │
  │                               │                               │
  │  GET /api/auth/me             │                               │
  │  Cookie: token=<jwt>          │                               │
  ├──────────────────────────────►│                               │
  │                               │  jwt.verify(token)            │
  │                               │  SELECT user by id            │
  │                               ├──────────────────────────────►│
  │  200 { id, name, role }       │◄──────────────────────────────┤
  │◄──────────────────────────────┤                               │
```

Every subsequent request sends the HTTP-only `token` cookie. The `authenticate` middleware verifies the JWT signature and decodes `{ userId, role }` into `req.user` — no database lookup needed on each request.

---

## 2. Application Lifecycle — State Transitions

```
                  Applicant                    Reviewer
                     │                            │
                     │  POST /applications         │
                     │  { title, category, ... }  │
                     │                            │
                     ▼                            │
               ┌──────────┐                       │
               │  DRAFT   │                       │
               └────┬─────┘                       │
                    │ POST /applications/:id/transitions
                    │ { action: "submit" }         │
                    │ (owner only)                 │
                    ▼                             │
             ┌─────────────┐                     │
             │  SUBMITTED  │                     │
             └──────┬──────┘                     │
                    │         { action: "start_review" }
                    │◄────────────────────────────┤
                    ▼                             │
          ┌───────────────────┐                  │
          │   UNDER_REVIEW    │                  │
          └──┬──────────┬─────┘                  │
             │          │                        │
   { action: "approve" }│ { action: "reject" }   │
   ◄──────────┤          │ (comment required)     │
   │          │◄──────────────────────────────────┤
   │          │                                   │
   ▼          ▼              { action: "return_for_changes" }
┌──────────┐  ┌──────────┐   (comment required)  │
│ APPROVED │  │ REJECTED │◄──────────────────────┤
└──────────┘  └──────────┘                       │
                                                 │
   ┌──────────┐  ← returned to DRAFT, applicant
   │  DRAFT   │     can edit and resubmit
   └──────────┘
```

---

## 3. Transition Request Flow (Detailed)

This is the most critical path in the system. Walk through a `POST /api/applications/:id/transitions` with `{ action: "reject", comment: "Missing budget breakdown" }`:

```
HTTP Request
  │
  ├─ authenticate middleware
  │    jwt.verify(token) → req.user = { userId, role: "REVIEWER" }
  │
  ├─ validate middleware
  │    Zod schema: action ∈ allowed enum, comment is optional string
  │    → passes, calls next()
  │
  ├─ applicationController.performTransition
  │    reads: req.params.id, req.body.action, req.body.comment, req.user
  │    calls: applicationService.transition(...)
  │
  └─ applicationService.transition
       │
       ├─ db.application.findUnique(id)
       │    → { id, status: "UNDER_REVIEW", applicantId: "abc" }
       │
       ├─ isOwner = (applicantId === actorId)
       │    → false  (reviewer ≠ applicant)
       │
       ├─ applyTransition({
       │    action: "reject",
       │    currentStatus: "UNDER_REVIEW",
       │    actorRole: "REVIEWER",
       │    isOwner: false,
       │    comment: "Missing budget breakdown"
       │  })
       │
       │  State machine checks (in order):
       │    1. currentStatus === rule.from?    UNDER_REVIEW === UNDER_REVIEW ✓
       │    2. actorRole in allowedRoles?      REVIEWER ∈ [REVIEWER] ✓
       │    3. ownerOnly && !isOwner?          false (not owner-only) ✓
       │    4. requiresComment && !comment?    comment present ✓
       │
       │  → { ok: true, toStatus: "REJECTED" }
       │
       └─ db.$transaction([
            application.update({ status: "REJECTED" }),
            auditLog.create({
              applicationId,
              actorId: reviewer.id,
              fromStatus: "UNDER_REVIEW",
              toStatus: "REJECTED",
              comment: "Missing budget breakdown"
            })
          ])
          → both writes succeed atomically
          → returns updated application with full auditLogs[]

HTTP Response: 200 { id, status: "REJECTED", auditLogs: [...] }
```

---

## 4. State Machine Decision Tree

```
applyTransition(action, currentStatus, actorRole, isOwner, comment)
  │
  ├─ Does action exist in TRANSITIONS map?
  │    (guaranteed by Zod enum validation before this point)
  │
  ├─ currentStatus === rule.from?
  │    No  → { ok: false, code: "ILLEGAL_TRANSITION" }   HTTP 422
  │
  ├─ actorRole ∈ rule.allowedRoles?
  │    No  → { ok: false, code: "FORBIDDEN" }            HTTP 403
  │
  ├─ rule.ownerOnly && !isOwner?
  │    Yes → { ok: false, code: "FORBIDDEN" }            HTTP 403
  │
  ├─ rule.requiresComment && !comment?.trim()?
  │    Yes → { ok: false, code: "COMMENT_REQUIRED" }     HTTP 400
  │
  └─ All checks pass
       → { ok: true, toStatus: rule.to }
```

---

## 5. Read Flow — Applicant Dashboard

```
React (Dashboard)
  │
  ├─ useQuery(["applications"])
  │    → GET /api/applications
  │       Cookie: token=<jwt>
  │
  ├─ Backend: applicationService.listApplications(userId, "APPLICANT")
  │    → WHERE applicantId = $userId   (APPLICANT sees only own)
  │    → ORDER BY updatedAt DESC
  │    → SELECT id, title, category, status, amount, createdAt, updatedAt,
  │             applicant { id, name, email }
  │
  └─ 200 Application[]
       → rendered as list with StatusBadge per row
       → click row → navigate /applications/:id
```

---

## 6. Read Flow — Reviewer Queue

```
React (Queue)
  │
  ├─ useQuery(["applications", statusFilter])
  │    → GET /api/applications?status=SUBMITTED   (or omit for all)
  │
  ├─ Backend: applicationService.listApplications(userId, "REVIEWER", "SUBMITTED")
  │    → WHERE clause has no applicantId filter   (REVIEWER sees all)
  │    → WHERE status = "SUBMITTED" if filter provided
  │    → ORDER BY updatedAt DESC
  │
  └─ 200 Application[]
       → rendered as filterable table
       → click row → navigate /reviewer/applications/:id
```

---

## 7. Audit Log Flow

Every mutation that changes application state produces an `AuditLog` row:

| Action | fromStatus | toStatus | comment |
|---|---|---|---|
| create | `null` | `DRAFT` | `null` |
| submit | `DRAFT` | `SUBMITTED` | `null` |
| start_review | `SUBMITTED` | `UNDER_REVIEW` | `null` |
| approve | `UNDER_REVIEW` | `APPROVED` | optional |
| reject | `UNDER_REVIEW` | `REJECTED` | **required** |
| return_for_changes | `UNDER_REVIEW` | `DRAFT` | **required** |

Audit logs are:
- **Append-only** — no update or delete code paths exist
- **Atomic** — written in the same `$transaction` as the status update
- **Joined on read** — the detail page query fetches `auditLogs` with `actor { name, role }` so the full history is in one round trip
- Ordered ascending by `createdAt` to render a timeline

---

## 8. Error Response Shape

All error responses return a consistent JSON structure so the client can handle them uniformly:

```
{ "error": "Human-readable message" }          // single error
{ "errors": [{ "path": "...", "message": "..." }] }  // validation errors (Zod)
```

The frontend's Axios interceptor reads `error.response.data.error` and surfaces it in the relevant UI state (form field error, toast notification, or inline alert).
