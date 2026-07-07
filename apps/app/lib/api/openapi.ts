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
    "/consultations": {
      get: {
        operationId: "listConsultations",
        summary: "List consultations",
        description:
          "Lists the firm's consultations, newest first, cursor-paginated and filterable. Non-archived " +
          "by default; pass `archived=true` for archived only.",
        security: [{ apiKey: ["consultations:read"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/Limit" },
          { $ref: "#/components/parameters/Cursor" },
          {
            name: "attorney",
            in: "query",
            required: false,
            description: "Filter by attorney id (UUID).",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "lead",
            in: "query",
            required: false,
            description: "Filter by lead id (UUID).",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "status",
            in: "query",
            required: false,
            description: "Filter by lifecycle status.",
            schema: {
              type: "string",
              enum: ["scheduled", "paid", "completed", "rescheduled", "canceled", "no_show"],
            },
          },
          {
            name: "archived",
            in: "query",
            required: false,
            description: "`true` returns archived consultations only; otherwise non-archived are returned.",
            schema: { type: "boolean" },
          },
        ],
        responses: {
          "200": {
            description: "A page of consultations.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data", "next_cursor"],
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Consultation" } },
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
        operationId: "bookConsultation",
        summary: "Book a consultation",
        description:
          "Books a consultation into one of an attorney's free slots. The requested time is validated " +
          "against the attorney's office hours and time-off for that day, and the database guarantees no " +
          "double-booking — a slot already taken returns 409. `start_at` is a UTC instant. An optional " +
          "`Idempotency-Key` header makes a retry safe: a repeat with the same key replays the original " +
          "201 instead of booking a second consultation. Returns the booked consultation (201) and emits " +
          "`consultation.booked`.",
        security: [{ apiKey: ["consultations:write"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/IdempotencyKey" },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ConsultationCreate" } } },
        },
        responses: {
          "201": {
            description: "The booked consultation.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Consultation" } } },
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
    "/consultations/{id}": {
      get: {
        operationId: "getConsultation",
        summary: "Get a consultation",
        description:
          "Returns a single firm-scoped consultation. A consultation from another firm returns 404.",
        security: [{ apiKey: ["consultations:read"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/ConsultationId" },
        ],
        responses: {
          "200": {
            description: "The consultation.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Consultation" } } },
          },
          "401": { $ref: "#/components/responses/Error" },
          "403": { $ref: "#/components/responses/Error" },
          "404": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
      patch: {
        operationId: "updateConsultation",
        summary: "Reschedule or cancel a consultation",
        description:
          "Reschedules a consultation (send any of `start_at`, `duration_min`, `attorney_id`, " +
          "`time_zone` — the new slot is re-validated against office hours, time-off, and the no-double-" +
          "book guard) and/or cancels it (send `status: \"canceled\"`). Only a non-terminal consultation " +
          "can change; a finalized or other-firm consultation returns 404. Returns the updated " +
          "consultation and emits `consultation.rescheduled` and/or `consultation.canceled`.",
        security: [{ apiKey: ["consultations:write"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          { $ref: "#/components/parameters/ConsultationId" },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ConsultationPatch" } } },
        },
        responses: {
          "200": {
            description: "The updated consultation.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Consultation" } } },
          },
          "400": { $ref: "#/components/responses/Error" },
          "401": { $ref: "#/components/responses/Error" },
          "403": { $ref: "#/components/responses/Error" },
          "404": { $ref: "#/components/responses/Error" },
          "409": { $ref: "#/components/responses/Error" },
          "413": { $ref: "#/components/responses/Error" },
          "422": { $ref: "#/components/responses/Error" },
          "429": { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/attorneys": {
      get: {
        operationId: "listAttorneys",
        summary: "List attorneys",
        description:
          "Lists the firm's schedulable, active attorneys — the staff who can take consultations. Use " +
          "this to resolve an attorney's `id` for booking: the id returned here is exactly the " +
          "`attorney_id` that POST /api/consultations accepts. Each attorney carries `has_office_hours`; " +
          "pass `?has_office_hours=true` to list only those with office hours configured (any other one " +
          "would fail booking with `outside_office_hours`). The set is small, so this listing is not " +
          "paginated — `next_cursor` is always null.",
        security: [{ apiKey: ["consultations:read"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          {
            name: "has_office_hours",
            in: "query",
            required: false,
            schema: { type: "boolean" },
            description:
              "When `true`, return only attorneys who have recurring office hours configured (the " +
              "genuinely bookable subset). Any other value lists all schedulable attorneys.",
          },
        ],
        responses: {
          "200": {
            description: "The firm's schedulable, active attorneys.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data", "next_cursor"],
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Attorney" } },
                    next_cursor: {
                      type: ["string", "null"],
                      description: "Always null — the attorney listing is not paginated.",
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Error" },
          "403": { $ref: "#/components/responses/Error" },
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
      ConsultationId: {
        name: "id",
        in: "path",
        required: true,
        description: "Consultation id (UUID).",
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
          "the rest are free text. On WRITE only the fields below are stored — other keys you send are " +
          "ignored, not persisted; keys already on the record (e.g. from ingestion) are preserved on " +
          "update and returned on read.",
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
      Consultation: {
        type: "object",
        required: [
          "id",
          "lead_id",
          "attorney_id",
          "type",
          "status",
          "start_at",
          "duration_min",
          "time_zone",
          "paid",
          "amount",
          "outcome",
          "archived",
          "created_at",
          "data",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          lead_id: { type: ["string", "null"], format: "uuid", description: "The lead this consult is for." },
          attorney_id: { type: ["string", "null"], format: "uuid" },
          type: { type: "string", description: "The consultation type name." },
          status: {
            type: "string",
            enum: ["scheduled", "paid", "completed", "rescheduled", "canceled", "no_show"],
            description: "Booking lifecycle status.",
          },
          start_at: { type: "string", format: "date-time", description: "Start instant (UTC)." },
          duration_min: { type: "integer" },
          time_zone: { type: "string", description: "IANA time zone the consult is shown in." },
          paid: { type: "boolean", description: "Payment status (track-only)." },
          amount: { type: ["number", "null"], description: "Charge amount, or null." },
          outcome: { type: ["string", "null"], description: "Post-consult qualification, or null." },
          archived: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          data: {
            type: "object",
            additionalProperties: true,
            description: "Practice-specific extra fields (schemaless).",
          },
        },
      },
      ConsultationCreate: {
        type: "object",
        description:
          "Booking payload. The slot must fall within the attorney's office hours for that day and not " +
          "overlap an existing consultation or the attorney's time-off.",
        required: ["lead_id", "attorney_id", "type", "start_at", "duration_min"],
        properties: {
          lead_id: { type: "string", format: "uuid", description: "The lead this consult is for." },
          attorney_id: {
            type: "string",
            format: "uuid",
            description: "A schedulable, active attorney in the firm.",
          },
          type: { type: "string", description: "The consultation type name (free text)." },
          start_at: { type: "string", format: "date-time", description: "Start instant (UTC)." },
          duration_min: { type: "integer", minimum: 5, maximum: 1440 },
          time_zone: {
            type: "string",
            description: "IANA time zone (defaults to America/New_York).",
          },
          paid: { type: "boolean", description: "Payment status (track-only). Defaults to false." },
          amount: { type: ["number", "null"], minimum: 0, description: "Charge amount, or null." },
          data: {
            type: "object",
            additionalProperties: true,
            description: "Practice-specific extra fields (schemaless).",
          },
        },
      },
      ConsultationPatch: {
        type: "object",
        description:
          "Reschedule and/or cancel payload. Only the keys present are changed. Sending any of " +
          "`start_at` / `duration_min` / `attorney_id` / `time_zone` reschedules (re-validated against " +
          "office hours, time-off, and the no-double-book guard). `status` may only be set to " +
          "\"canceled\".",
        properties: {
          start_at: { type: "string", format: "date-time", description: "New start instant (UTC)." },
          duration_min: { type: "integer", minimum: 5, maximum: 1440 },
          attorney_id: { type: "string", format: "uuid", description: "Reassign to another attorney." },
          time_zone: { type: "string", description: "Update the display time zone." },
          status: { type: "string", enum: ["canceled"], description: "Set to \"canceled\" to cancel." },
        },
      },
      Attorney: {
        type: "object",
        description: "A schedulable, active attorney — bookable via POST /api/consultations.",
        required: ["id", "name", "schedulable", "has_office_hours"],
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Staff UUID — pass as `attorney_id` when booking a consultation.",
          },
          name: { type: "string", description: "The attorney's display name." },
          schedulable: {
            type: "boolean",
            description: "Always true in this listing — only schedulable attorneys are returned.",
          },
          has_office_hours: {
            type: "boolean",
            description:
              "Whether the attorney has recurring office hours configured. `schedulable` alone is " +
              "just an admin toggle; without office hours every booking fails `outside_office_hours`, " +
              "so this is the reliable 'actually bookable' signal. Filter to only these with " +
              "`?has_office_hours=true`.",
          },
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
