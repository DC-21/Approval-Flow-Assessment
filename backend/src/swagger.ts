// eslint-disable-next-line @typescript-eslint/no-explicit-any
const spec: Record<string, any> = {
  openapi: "3.0.3",
  info: {
    title: "Submission & Approval Workflow API",
    version: "1.0.0",
    description:
      "RESTful API for a two-sided submission and approval workflow. " +
      "Applicants create and submit applications; Reviewers triage them through an enforced state machine.",
    contact: { email: "dev.stargate@gmail.com" },
  },
  servers: [
    { url: "/api", description: "Current server (relative)" },
    { url: "http://localhost:3001/api", description: "Local dev" },
  ],
  tags: [
    { name: "Auth", description: "Login and identity" },
    { name: "Applications", description: "CRUD and lifecycle transitions" },
  ],

  // ── Security scheme ────────────────────────────────────────────────────────
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "token",
        description: "POST /auth/login sets this HTTP-only JWT cookie.",
      },
    },

    // ── Reusable schemas ──────────────────────────────────────────────────────
    schemas: {
      // Enums
      Role: {
        type: "string",
        enum: ["APPLICANT", "REVIEWER"],
        example: "APPLICANT",
      },
      ApplicationStatus: {
        type: "string",
        enum: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"],
        example: "SUBMITTED",
      },
      ApplicationCategory: {
        type: "string",
        enum: ["BUDGET_REQUEST", "LEAVE_REQUEST", "EQUIPMENT_REQUEST", "OTHER"],
        example: "BUDGET_REQUEST",
      },
      TransitionAction: {
        type: "string",
        enum: ["submit", "start_review", "approve", "reject", "return_for_changes"],
        example: "approve",
      },

      // Objects
      UserSummary: {
        type: "object",
        properties: {
          id:    { type: "string", format: "uuid" },
          name:  { type: "string", example: "Alice Applicant" },
          email: { type: "string", format: "email", example: "alice@test.com" },
          role:  { $ref: "#/components/schemas/Role" },
        },
        required: ["id", "name", "email"],
      },

      AuditLogEntry: {
        type: "object",
        properties: {
          id:            { type: "string", format: "uuid" },
          fromStatus:    { allOf: [{ $ref: "#/components/schemas/ApplicationStatus" }], nullable: true },
          toStatus:      { $ref: "#/components/schemas/ApplicationStatus" },
          comment:       { type: "string", nullable: true, example: "Missing budget breakdown." },
          createdAt:     { type: "string", format: "date-time" },
          actor: {
            type: "object",
            properties: {
              id:   { type: "string", format: "uuid" },
              name: { type: "string" },
              role: { $ref: "#/components/schemas/Role" },
            },
          },
        },
        required: ["id", "toStatus", "createdAt", "actor"],
      },

      ApplicationSummary: {
        description: "Lightweight application object returned in list views.",
        type: "object",
        properties: {
          id:          { type: "string", format: "uuid" },
          title:       { type: "string", example: "Q3 Marketing Budget" },
          category:    { $ref: "#/components/schemas/ApplicationCategory" },
          status:      { $ref: "#/components/schemas/ApplicationStatus" },
          amount:      { type: "number", nullable: true, example: 15000 },
          createdAt:   { type: "string", format: "date-time" },
          updatedAt:   { type: "string", format: "date-time" },
          applicant: {
            type: "object",
            properties: {
              id:    { type: "string", format: "uuid" },
              name:  { type: "string" },
              email: { type: "string", format: "email" },
            },
          },
        },
        required: ["id", "title", "category", "status", "createdAt", "updatedAt", "applicant"],
      },

      ApplicationDetail: {
        description: "Full application object including audit trail.",
        allOf: [{ $ref: "#/components/schemas/ApplicationSummary" }],
        properties: {
          description: { type: "string", example: "Funds for digital advertising campaign." },
          auditLogs: {
            type: "array",
            items: { $ref: "#/components/schemas/AuditLogEntry" },
          },
        },
        required: ["description", "auditLogs"],
      },

      ApplicationBody: {
        description: "Payload for creating or updating an application.",
        type: "object",
        properties: {
          title:       { type: "string", minLength: 1, example: "Q3 Marketing Budget" },
          category:    { $ref: "#/components/schemas/ApplicationCategory" },
          description: { type: "string", minLength: 1, example: "Funds for digital advertising campaign." },
          amount:      { type: "number", minimum: 0.01, nullable: true, example: 15000 },
        },
        required: ["title", "category", "description"],
      },

      TransitionBody: {
        type: "object",
        properties: {
          action:  { $ref: "#/components/schemas/TransitionAction" },
          comment: {
            type: "string",
            description: "Required when action is `reject` or `return_for_changes`.",
            example: "Missing budget breakdown.",
          },
        },
        required: ["action"],
      },

      LoginRequest: {
        type: "object",
        properties: {
          email:    { type: "string", format: "email", example: "alice@test.com" },
          password: { type: "string", example: "applicant-alice-9f2k" },
        },
        required: ["email", "password"],
      },

      LoginResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/UserSummary" },
        },
        required: ["user"],
      },

      // Error shapes
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Forbidden" },
        },
        required: ["error"],
      },

      ValidationErrorResponse: {
        type: "object",
        properties: {
          error:   { type: "string", example: "Validation failed" },
          details: {
            type: "object",
            description: "Flattened Zod error detail.",
            properties: {
              formErrors:  { type: "array", items: { type: "string" } },
              fieldErrors: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
            },
          },
        },
        required: ["error"],
      },
    },

    // ── Reusable responses ────────────────────────────────────────────────────
    responses: {
      Unauthorized: {
        description: "Missing or invalid JWT.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      Forbidden: {
        description: "Authenticated but not permitted (wrong role or not the owner).",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      NotFound: {
        description: "Resource not found.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      UnprocessableEntity: {
        description: "Illegal state transition (current status does not allow this action).",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
      },
      ValidationError: {
        description: "Request body failed schema validation.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorResponse" } } },
      },
    },
  },

  // ── Paths ──────────────────────────────────────────────────────────────────
  paths: {

    // ── Auth ──────────────────────────────────────────────────────────────────
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description:
          "Exchange credentials for an HTTP-only JWT cookie. The browser sends that cookie " +
          "on subsequent requests when credentials are included.\n\n" +
          "**Seeded credentials**\n" +
          "| Role | Email | Password |\n" +
          "|---|---|---|\n" +
          "| Applicant | alice@test.com | applicant-alice-9f2k |\n" +
          "| Applicant | bob@test.com | applicant-bob-7m3p |\n" +
          "| Reviewer | reviewer@test.com | reviewer-carol-4x8w |",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          200: {
            description: "Login successful.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: {
            description: "Invalid email or password.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
        },
      },
    },

    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        description: "Returns the profile of the authenticated user decoded from the JWT cookie.",
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: "Current user profile.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserSummary" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ── Applications ──────────────────────────────────────────────────────────
    "/applications": {
      get: {
        tags: ["Applications"],
        summary: "List applications",
        description:
          "**Applicants** see only their own applications.\n\n" +
          "**Reviewers** see all applications across all applicants.\n\n" +
          "Optionally filter by `status`.",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            description: "Filter by application status (case-insensitive).",
            schema: { $ref: "#/components/schemas/ApplicationStatus" },
          },
        ],
        responses: {
          200: {
            description: "Array of applications (summary view, no audit log).",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/ApplicationSummary" } },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },

      post: {
        tags: ["Applications"],
        summary: "Create an application",
        description: "Creates a new application in `DRAFT` status. **Applicants only.**",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ApplicationBody" } } },
        },
        responses: {
          201: {
            description: "Application created.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApplicationDetail" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },

    "/applications/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Application UUID.",
          schema: { type: "string", format: "uuid" },
        },
      ],

      get: {
        tags: ["Applications"],
        summary: "Get an application",
        description:
          "Returns the full application including the ordered audit trail.\n\n" +
          "Applicants can only fetch their own applications. Reviewers can fetch any.",
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: "Application with audit log.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApplicationDetail" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },

      put: {
        tags: ["Applications"],
        summary: "Update an application",
        description:
          "Replaces the application fields. **Constraints:**\n" +
          "- Only the **owner** (Applicant) can edit.\n" +
          "- The application must be in `DRAFT` status.\n" +
          "- Returns `422` if not in DRAFT.",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ApplicationBody" } } },
        },
        responses: {
          200: {
            description: "Updated application.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApplicationDetail" } } },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/UnprocessableEntity" },
        },
      },

      delete: {
        tags: ["Applications"],
        summary: "Delete an application",
        description:
          "Permanently deletes the application and its audit logs. **Constraints:**\n" +
          "- Only the **owner** (Applicant) can delete.\n" +
          "- The application must be in `DRAFT` status.",
        security: [{ cookieAuth: [] }],
        responses: {
          204: { description: "Deleted successfully. No body." },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/UnprocessableEntity" },
        },
      },
    },

    "/applications/{id}/transitions": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: "Application UUID.",
          schema: { type: "string", format: "uuid" },
        },
      ],

      post: {
        tags: ["Applications"],
        summary: "Perform a state transition",
        description:
          "Advances the application through the approval workflow. " +
          "Illegal transitions are rejected with `422`; role violations with `403`.\n\n" +
          "**State machine**\n" +
          "```\n" +
          "DRAFT ──submit──► SUBMITTED ──start_review──► UNDER_REVIEW ──approve──► APPROVED\n" +
          "  ▲                                                        ├──reject──► REJECTED\n" +
          "  └───────────────── return_for_changes ◄──────────────────┘\n" +
          "```\n\n" +
          "| Action | From | To | Who | Comment required |\n" +
          "|---|---|---|---|---|\n" +
          "| `submit` | DRAFT | SUBMITTED | Applicant (owner only) | No |\n" +
          "| `start_review` | SUBMITTED | UNDER_REVIEW | Reviewer | No |\n" +
          "| `approve` | UNDER_REVIEW | APPROVED | Reviewer | No |\n" +
          "| `reject` | UNDER_REVIEW | REJECTED | Reviewer | **Yes** |\n" +
          "| `return_for_changes` | UNDER_REVIEW | DRAFT | Reviewer | **Yes** |",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TransitionBody" } } },
        },
        responses: {
          200: {
            description: "Transition applied. Returns the updated application with the new audit log entry.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApplicationDetail" } } },
          },
          400: {
            description: "Comment required for this action but was missing or blank.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
          422: { $ref: "#/components/responses/UnprocessableEntity" },
        },
      },
    },
  },
};

export default spec;
