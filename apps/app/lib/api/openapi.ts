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
    },
    "/leads/{id}": {
      get: {
        operationId: "getLead",
        summary: "Get a lead",
        description: "Returns a single firm-scoped lead. A lead from another firm returns 404.",
        security: [{ apiKey: ["leads:read"] }],
        parameters: [
          { $ref: "#/components/parameters/VersionHeader" },
          {
            name: "id",
            in: "path",
            required: true,
            description: "Lead id (UUID).",
            schema: { type: "string", format: "uuid" },
          },
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
