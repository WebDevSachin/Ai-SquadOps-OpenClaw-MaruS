import express from "express";
import cors from "cors";
import { Pool } from "pg";
import { tasksRouter } from "./routes/tasks";
import { agentsRouter } from "./routes/agents";
import { auditRouter } from "./routes/audit";
import { approvalsRouter } from "./routes/approvals";
import { messagesRouter } from "./routes/messages";
import { goalsRouter } from "./routes/goals";
import { usageRouter } from "./routes/usage";
import { recurringRouter } from "./routes/recurring";
import { onboardingRouter } from "./routes/onboarding";
import { previewsRouter } from "./routes/previews";
import { authRouter } from "./routes/auth";
import { providerKeysRouter } from "./routes/provider-keys";
import { authenticate } from "./middleware/auth";

const app = express();
const PORT = process.env.PORT || 4000;

// Database pool
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://squadops:squadops_dev@localhost:5432/squadops",
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "squadops-api" });
  } catch {
    res.status(500).json({ status: "error", message: "Database unreachable" });
  }
});

// Public routes (no auth required)
app.use("/api/auth", authRouter);

// Protected routes (JWT or API key required)
app.use("/api/provider-keys", authenticate, providerKeysRouter);
app.use("/api/tasks", authenticate, tasksRouter);
app.use("/api/agents", authenticate, agentsRouter);
app.use("/api/audit", authenticate, auditRouter);
app.use("/api/approvals", authenticate, approvalsRouter);
app.use("/api/messages", authenticate, messagesRouter);
app.use("/api/goals", authenticate, goalsRouter);
app.use("/api/usage", authenticate, usageRouter);
app.use("/api/recurring", authenticate, recurringRouter);
app.use("/api/onboarding", authenticate, onboardingRouter);
app.use("/api/previews", authenticate, previewsRouter);

// Start
app.listen(PORT, () => {
  console.log(`SquadOps API running on port ${PORT}`);
});
