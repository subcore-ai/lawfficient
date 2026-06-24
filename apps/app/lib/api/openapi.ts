// The committed OpenAPI 3.1 contract for the public API (spec 26) — the source of truth, served
// read-only at GET /api/openapi.json. Each resource PR extends paths + schemas here. Phase 1
// describes the two read endpoints, the Lead schema, the Bearer security scheme + scopes, the
// error envelope, and cursor pagination.
import { LATEST_VERSION, VERSION_HEADER } from "./version"

export const openapiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Lawfficient Public API",
    version: LATEST_VERSION,
    description:
      "Per-firm REST API for the Lawfficient staff platform. Authenticate with a Bearer API key. " +
      "The path is unversioned; request a dated API version with the " +
      `\`${VERSION_HEADER}\` header (absent → latest stable). Responses echo the resolved version.`,
  },
  servers: [{ url: "/api" }],
  security: [{ apiKey: [] }],
  paths: {
    "/leads": {
      get: {
        operationId: "listLeads",
        summary: "List leads",
        description: "Lists the firm's leads, newest first, cursor-paginated and filterable.",
        security: [{ apiKey: ["leads:read"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/Limit" },
          { $ref: "#/components/parameters/Cursor" },
          {
            name: "status",
            in: "query",
            required: false,
            description: "Filter by the firm-defined status key.",
            schema: { type: "string" },
          },
          {
            name: "source",
            in: "query",
            required: false,
            description: "Filter by exact source label.",
            schema: { type: "string" },
          },
          {
            name: "assignee",
            in: "query",
            required: false,
            description: "Filter by assignee id (UUID).",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "q",
            in: "query",
            required: false,
            description: "Free-text search over first name, last name, email, and phone.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "A page of leads.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data", "next_cursor"],
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Lead" } },
                    next_cursor: {
                      type: ["string", "null"],
                      description: "Opaque cursor for the next page, or null on the last page.",
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/Error" },
          "401": { $ref: "#/components/responses/Error" },
          "403": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
      post: {
        operationId: "createLead",
        summary: "Create a lead",
        description:
          "Creates a lead. There is ONE endpoint to push a lead: POST /api/leads resolves the firm " +
          "from whichever Bearer key is presented. With a per-firm API key (scope `leads:write`) this " +
          "is a direct create — returns the created lead (201) and emits `lead.created`. With a " +
          "per-source ingestion key it is the inbound webhook instead (idempotent on `externalId`, " +
          "returns `{ status, leadId }`); see the lead-ingestion spec. An optional `Idempotency-Key` " +
          "header makes an API-key create safe to retry: a repeat with the same key replays the " +
          "original 201 instead of creating a second lead.",
        security: [{ apiKey: ["leads:write"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/IdempotencyKey" },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LeadCreate" } } },
        },
        responses: {
          "201": {
            description: "The created lead.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Lead" } } },
          },
          "400": { $ref: "#/components/responses/Error" },
          "401": { $ref: "#/components/responses/Error" },
          "403": { $ref: "#/components/responses/Error" },
          "409": { $ref: "#/components/responses/Error" },
          "413": { $ref: "#/components/responses/Error" },
          "422": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
          "503": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/leads/{id}": {
      get: {
        operationId: "getLead",
        summary: "Get a lead",
        description: "Returns a single firm-scoped lead. A lead from another firm returns 404.",
        security: [{ apiKey: ["leads:read"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/LeadId" },
        ],
        responses: {
          "200": {
            description: "The lead.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Lead" } } },
          },
          "401": { $ref: "#/components/responses/Error" },
          "403": { $ref: "#/components/responses/Error" },
          "404": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
      patch: {
        operationId: "updateLead",
        summary: "Update a lead",
        description:
          "Partially updates a lead — only the fields present in the body are changed. `status` is " +
          "set by its firm-defined key. Returns the updated lead and emits `lead.updated`, " +
          "`lead.status_changed`, and/or `lead.assigned` to match what changed. A lead from another " +
          "firm returns 404.",
        security: [{ apiKey: ["leads:write"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/LeadId" },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LeadPatch" } } },
        },
        responses: {
          "200": {
            description: "The updated lead.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Lead" } } },
          },
          "400": { $ref: "#/components/responses/Error" },
          "401": { $ref: "#/components/responses/Error" },
          "403": { $ref: "#/components/responses/Error" },
          "404": { $ref: "#/components/responses/Error" },
          "413": { $ref: "#/components/responses/Error" },
          "422": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/leads/{id}/archive": {
      post: {
        operationId: "archiveLead",
        summary: "Archive a lead",
        description:
          "Archives a lead. Idempotent — archiving an already-archived lead is a no-op that returns the " +
          "lead and emits NOTHING. Only an actual state change returns the lead and emits `lead.archived`. " +
          "A lead from another firm returns 404.",
        security: [{ apiKey: ["leads:write"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/LeadId" },
        ],
        responses: {
          "200": {
            description: "The archived lead.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Lead" } } },
          },
          "401": { $ref: "#/components/responses/Error" },
          "403": { $ref: "#/components/responses/Error" },
          "404": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/leads/{id}/unarchive": {
      post: {
        operationId: "unarchiveLead",
        summary: "Unarchive a lead",
        description:
          "Restores an archived lead. Idempotent — restoring an already-active lead is a no-op that " +
          "returns the lead and emits NOTHING. Only an actual state change returns the lead and emits " +
          "`lead.updated`. A lead from another firm returns 404.",
        security: [{ apiKey: ["leads:write"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/LeadId" },
        ],
        responses: {
          "200": {
            description: "The restored lead.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Lead" } } },
          },
          "401": { $ref: "#/components/responses/Error" },
          "403": { $ref: "#/components/responses/Error" },
          "404": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: "http",
        scheme: "bearer",
        description:
          "A per-firm API key. Scopes gate each endpoint (e.g. `leads:read`); a key missing the " +
          "required scope gets 403. Missing/invalid → 401; disabled → 403.",
      },
    },
    parameters: {
      VersionHeader: {
        name: VERSION_HEADER,
        in: "header",
        required: false,
        description: "Requested API version (ISO date). Absent → latest stable. Echoed on the response.",
        schema: { type: "string", example: LATEST_VERSION },
      },
      IdempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        required: false,
        description:
          "Optional opaque key making an API-key create safe to retry: a repeat with the same key " +
          "(per firm + key) replays the original response instead of creating a second lead.",
        schema: { type: "string", maxLength: 255 },
      },
      LeadId: {
        name: "id",
        in: "path",
        required: true,
        description: "Lead id (UUID).",
        schema: { type: "string", format: "uuid" },
      },
      Limit: {
        name: "limit",
        in: "query",
        required: false,
        description: "Page size. Default 50, max 200 (clamped).",
        schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
      },
      Cursor: {
        name: "cursor",
        in: "query",
        required: false,
        description: "Opaque pagination cursor from a previous response's next_cursor.",
        schema: { type: "string" },
      },
    },
    responses: {
      Error: {
        description: "Error envelope.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
    schemas: {
      Lead: {
        type: "object",
        required: [
          "id",
          "first_name",
          "last_name",
          "email",
          "phone",
          "source",
          "status",
          "assignee_id",
          "archived",
          "created_at",
          "last_activity_at",
          "data",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          source: { type: "string" },
          status: {
            type: "object",
            required: ["key", "name"],
            description: "The firm-defined pipeline status.",
            properties: {
              key: { type: "string" },
              name: { type: "string" },
            },
          },
          assignee_id: { type: ["string", "null"], format: "uuid" },
          archived: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          last_activity_at: { type: "string", format: "date-time" },
          data: {
            type: "object",
            additionalProperties: true,
            description: "Firm-defined / source-mapped extra fields (schemaless).",
          },
        },
      },
      LeadData: {
        type: "object",
        additionalProperties: true,
        description:
          "Lead data fields. The constrained fields (case_type / hierarchy / qualification, written " +
          "here as caseType / hierarchy / qualification) are validated against the firm's taxonomy; " +
          "the rest are free text. Unknown keys are preserved verbatim.",
        properties: {
          caseType: { type: "string" },
          hierarchy: { type: "string" },
          qualification: { type: "string" },
          preferredLanguage: { type: "string" },
          countryOfOrigin: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          zip: { type: "string" },
          gender: { type: "string" },
          dob: { type: "string" },
          referralSource: { type: "string" },
        },
      },
      LeadCreate: {
        type: "object",
        description: "Create payload (API-key path). The lead lands in the firm's first open stage.",
        required: ["first_name", "last_name", "source"],
        // At least one of email/phone must be present — a lead has to be reachable.
        anyOf: [{ required: ["email"] }, { required: ["phone"] }],
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string", description: "Email; required if no phone is given." },
          phone: { type: "string", description: "Phone; required if no email is given." },
          source: { type: "string" },
          assignee_id: {
            type: ["string", "null"],
            format: "uuid",
            description: "Optional assignee (must be a member of the firm).",
          },
          data: { $ref: "#/components/schemas/LeadData" },
        },
      },
      LeadPatch: {
        type: "object",
        description:
          "Partial update payload. Only the keys present are changed; omitting a key leaves it " +
          "untouched. A provided name/source can't be blanked, and you can't remove the last contact " +
          "method (phone and email both empty).",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          source: { type: "string" },
          assignee_id: {
            type: ["string", "null"],
            format: "uuid",
            description: "Set to a UUID to assign, or null to unassign.",
          },
          status: { type: "string", description: "The firm-defined status key to move the lead to." },
          data: { $ref: "#/components/schemas/LeadData" },
        },
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string", description: "Stable snake_case error code." },
              message: { type: "string", description: "Human-readable description." },
              details: { description: "Optional structured context." },
            },
          },
        },
      },
    },
  },
} as const
