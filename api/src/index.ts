import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { Pool } from "pg";
import { tasksRouter } from "./routes/tasks";
import { agentsRouter } from "./routes/agents";
import { auditRouter } from "./routes/audit";
import { demoRouter } from "./routes/demo";
import { approvalsRouter } from "./routes/approvals";
import { messagesRouter } from "./routes/messages";
import { goalsRouter } from "./routes/goals";
import { usageRouter } from "./routes/usage";
import { recurringRouter } from "./routes/recurring";
import { onboardingRouter } from "./routes/onboarding";
import { previewsRouter } from "./routes/previews";
import { authRouter } from "./routes/auth";
import { providerKeysRouter } from "./routes/provider-keys";
import { usersRouter } from "./routes/users";
import { createSwarmRouter } from "./routes/swarm";
import { workflowsRouter } from "./routes/workflows";
import { triggersRouter } from "./routes/triggers";
import { webhooksRouter } from "./routes/webhooks";
import { docsRouter } from "./routes/docs";
import { authenticate } from "./middleware/auth";
import { versionDetection, versionRedirect } from "./middleware/version";
import { generalLimiter, authLimiter, writeLimiter, readLimiter } from "./middleware/rateLimit";

// Load environment variables from correct path
dotenv.config({ path: require("path").resolve(__dirname, "../../.env") });

const app = express();
const PORT = process.env.PORT || 4000;

// Database pool
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://squadops:squadops_dev@localhost:5432/squadops",
});

// Middleware
app.use(helmet());
// CORS configuration
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// Apply rate limiting globally (with different limits per route)
app.use(generalLimiter);

// Version detection middleware
app.use(versionDetection);

// Demo routes (before version redirect to avoid redirect)
app.use("/api/demo", authenticate, writeLimiter, demoRouter);

// Redirect non-versioned routes to v1
app.use(versionRedirect);

// Health check (no auth required)
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "squadops-api" });
  } catch {
    res.status(500).json({ status: "error", message: "Database unreachable" });
  }
});

// API Documentation (no auth required for docs)
app.use("/api/docs", docsRouter);

// Public routes (no auth required) - with strict rate limiting
app.use("/api/auth", authLimiter, authRouter);

// Protected routes (JWT or API key required) - with write/read rate limiting
app.use("/api/provider-keys", authenticate, writeLimiter, providerKeysRouter);
app.use("/api/tasks", authenticate, writeLimiter, tasksRouter);
app.use("/api/agents", authenticate, writeLimiter, agentsRouter);
app.use("/api/audit", authenticate, readLimiter, auditRouter);
app.use("/api/approvals", authenticate, writeLimiter, approvalsRouter);
app.use("/api/messages", authenticate, writeLimiter, messagesRouter);
app.use("/api/goals", authenticate, writeLimiter, goalsRouter);
app.use("/api/usage", authenticate, readLimiter, usageRouter);
app.use("/api/recurring", authenticate, writeLimiter, recurringRouter);
app.use("/api/onboarding", authenticate, writeLimiter, onboardingRouter);
app.use("/api/previews", authenticate, writeLimiter, previewsRouter);
app.use("/api/swarm", authenticate, writeLimiter, createSwarmRouter(pool));
app.use("/api/users", authenticate, writeLimiter, usersRouter);
app.use("/api/workflows", authenticate, writeLimiter, workflowsRouter);
app.use("/api/triggers", authenticate, writeLimiter, triggersRouter);

// Webhooks (with specific rate limiting)
app.use("/api/webhooks", authenticate, writeLimiter, webhooksRouter);

// =====================================================
// API v1 Routes (New Versioned Routes)
// =====================================================

// v1 Routes are prefixed with /api/v1/
// These routes use the same handlers but provide a cleaner API structure

import { v1TasksRouter } from "./routes/v1/tasks";
import { v1AgentsRouter } from "./routes/v1/agents";
import { v1UsersRouter } from "./routes/v1/users";

// Apply version-specific middleware and routes
app.use("/api/v1/tasks", authenticate, writeLimiter, v1TasksRouter);
app.use("/api/v1/agents", authenticate, writeLimiter, v1AgentsRouter);
app.use("/api/v1/users", authenticate, writeLimiter, v1UsersRouter);

// v1 Routes for missing endpoints
app.use("/api/v1/approvals", authenticate, writeLimiter, approvalsRouter);
app.use("/api/v1/usage", authenticate, readLimiter, usageRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested endpoint does not exist",
    supported_versions: ["v1"],
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
  });
});

// Start
app.listen(PORT, () => {
  console.log(`SquadOps API running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api/docs`);
});
