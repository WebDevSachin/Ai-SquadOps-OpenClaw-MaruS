import { Router, Request, Response } from "express";
import { pool } from "../index";

export const docsRouter = Router();

// OpenAPI 3.0 Specification
const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "SquadOps API",
    version: "1.0.0",
    description: `
## Overview
SquadOps is an AI Operations Platform that provides a comprehensive API for managing tasks, agents, workflows, and more.

## Authentication
All API endpoints (except /api/auth/*) require authentication using one of the following methods:

### JWT Token
Include the JWT token in the Authorization header:
\`Authorization: Bearer <your_jwt_token>\`

### API Key
Include the API key in the X-API-Key header:
\`X-API-Key: <your_api_key>\`

## Rate Limiting
The API implements rate limiting with the following headers:
- **X-RateLimit-Limit**: Maximum requests per window
- **X-RateLimit-Remaining**: Remaining requests in current window
- **X-RateLimit-Reset**: Unix timestamp when the rate limit resets

Different endpoints have different rate limits:
- Authentication endpoints: 5 requests per 15 minutes
- Write operations: 50 requests per minute
- Read operations: 200 requests per minute
- General API: 100 requests per minute

## API Versioning
The API supports versioning via URL prefix:
- Current version: \`/api/v1/\`
- Example: \`/api/v1/tasks\`

You can also use the Accept header:
\`Accept: application/vnd.squadops.v1+json\`

## Webhooks
SquadOps supports webhooks for real-time event notifications. See the webhooks endpoint for more information.
    `.trim(),
    contact: {
      name: "SquadOps Support",
      email: "support@squadops.ai",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Development server",
    },
    {
      url: "https://api.squadops.ai",
      description: "Production server",
    },
  ],
  tags: [
    { name: "Authentication", description: "User authentication and registration" },
    { name: "Tasks", description: "Task management operations" },
    { name: "Agents", description: "AI agent management" },
    { name: "Webhooks", description: "Webhook configuration and management" },
    { name: "Workflows", description: "Workflow automation" },
    { name: "Users", description: "User management" },
    { name: "Messages", description: "Messaging and notifications" },
    { name: "Goals", description: "Goal tracking" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        description: "Check if the API is running and database is accessible",
        tags: ["Health"],
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "squadops-api" },
                  },
                },
              },
            },
          },
          "500": {
            description: "Database unreachable",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "error" },
                    message: { type: "string", example: "Database unreachable" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        summary: "Register a new user",
        description: "Create a new user account",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email", example: "user@example.com" },
                  password: { type: "string", format: "password", minLength: 8, example: "securepassword" },
                  name: { type: "string", example: "John Doe" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User created successfully",
            content: {
              "application/json": {
                example: { message: "User created", user: { id: "uuid", email: "user@example.com" } },
              },
            },
          },
          "400": {
            description: "Validation error",
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "User login",
        description: "Authenticate user and receive JWT token",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                example: { token: "jwt-token", user: { id: "uuid", email: "user@example.com" } },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
          },
        },
      },
    },
    "/api/webhooks": {
      get: {
        summary: "List webhooks",
        description: "Get all webhooks for the authenticated user",
        tags: ["Webhooks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        parameters: [
          {
            name: "active",
            in: "query",
            schema: { type: "boolean" },
            description: "Filter by active status",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50 },
            description: "Number of results",
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
            description: "Number of results to skip",
          },
        ],
        responses: {
          "200": {
            description: "List of webhooks",
            content: {
              "application/json": {
                example: { webhooks: [], total: 0 },
              },
            },
          },
        },
      },
      post: {
        summary: "Register webhook",
        description: "Create a new webhook endpoint",
        tags: ["Webhooks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url", "events"],
                properties: {
                  url: { type: "string", format: "uri", example: "https://example.com/webhook" },
                  events: {
                    type: "array",
                    items: { type: "string", enum: ["user.created", "task.completed", "agent.triggered"] },
                    example: ["task.completed"],
                  },
                  name: { type: "string", example: "My Webhook" },
                  secret: { type: "string", description: "Signing secret for verification" },
                  is_active: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Webhook created",
            content: {
              "application/json": {
                example: { webhook: { id: "uuid" }, message: "Webhook registered successfully" },
              },
            },
          },
        },
      },
    },
    "/api/webhooks/{id}": {
      get: {
        summary: "Get webhook",
        description: "Get a specific webhook by ID",
        tags: ["Webhooks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "Webhook ID",
          },
        ],
        responses: {
          "200": {
            description: "Webhook details",
          },
          "404": {
            description: "Webhook not found",
          },
        },
      },
      patch: {
        summary: "Update webhook",
        description: "Update an existing webhook",
        tags: ["Webhooks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Webhook updated",
          },
          "404": {
            description: "Webhook not found",
          },
        },
      },
      delete: {
        summary: "Delete webhook",
        description: "Remove a webhook",
        tags: ["Webhooks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Webhook deleted",
          },
          "404": {
            description: "Webhook not found",
          },
        },
      },
    },
    "/api/webhooks/{id}/test": {
      post: {
        summary: "Test webhook",
        description: "Send a test event to a webhook",
        tags: ["Webhooks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["event"],
                properties: {
                  event: {
                    type: "string",
                    enum: ["user.created", "user.updated", "user.deleted", "task.created", "task.completed", "task.failed", "task.started", "agent.triggered", "agent.completed", "workflow.started", "workflow.completed", "workflow.failed"],
                  },
                  payload: { type: "object", description: "Custom payload data" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Test result",
            content: {
              "application/json": {
                example: { success: true, status_code: 200 },
              },
            },
          },
        },
      },
    },
    "/api/webhooks/events": {
      get: {
        summary: "List webhook events",
        description: "Get all available webhook events",
        tags: ["Webhooks"],
        responses: {
          "200": {
            description: "List of available events",
            content: {
              "application/json": {
                example: { events: ["user.created", "task.completed"] },
              },
            },
          },
        },
      },
    },
    "/api/tasks": {
      get: {
        summary: "List tasks",
        description: "Get all tasks with optional filters",
        tags: ["Tasks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["pending", "in_progress", "completed", "failed", "all"] },
          },
          {
            name: "priority",
            in: "query",
            schema: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", default: 0 },
          },
        ],
        responses: {
          "200": {
            description: "List of tasks",
          },
        },
      },
      post: {
        summary: "Create task",
        description: "Create a new task",
        tags: ["Tasks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string", example: "Complete report" },
                  description: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high", "urgent"], default: "medium" },
                  assigned_agent: { type: "string", format: "uuid" },
                  tags: { type: "array", items: { type: "string" } },
                  due_date: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Task created",
          },
        },
      },
    },
    "/api/tasks/{id}": {
      get: {
        summary: "Get task",
        description: "Get a specific task by ID",
        tags: ["Tasks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Task details",
          },
          "404": {
            description: "Task not found",
          },
        },
      },
      patch: {
        summary: "Update task",
        description: "Update a task",
        tags: ["Tasks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"] },
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                  assigned_agent: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Task updated",
          },
          "404": {
            description: "Task not found",
          },
        },
      },
      delete: {
        summary: "Delete task",
        description: "Delete a task",
        tags: ["Tasks"],
        security: [{ BearerAuth: [], ApiKeyAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Task deleted",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token from /api/auth/login",
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "API key from /api/provider-keys",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "string" },
        },
      },
      ValidationError: {
        type: "object",
        properties: {
          error: { type: "string", example: "Validation failed" },
          validation_errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
      RateLimitError: {
        type: "object",
        properties: {
          error: { type: "string", example: "Rate limit exceeded" },
          retry_after: { type: "integer", example: 60 },
        },
      },
    },
  },
};

// Serve OpenAPI JSON at /api/docs
docsRouter.get("/openapi.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.json(openApiSpec);
});

// Serve Swagger UI HTML at /api/docs
docsRouter.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SquadOps API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .api-title { font-size: 2.5rem !important; font-weight: 700 !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: 'StandaloneLayout',
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      });
      window.ui = ui;
    };
  </script>
</body>
</html>
  `);
});

export { openApiSpec };
