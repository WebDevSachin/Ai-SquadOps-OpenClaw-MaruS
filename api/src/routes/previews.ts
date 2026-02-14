import { Router, Request, Response } from "express";
import { pool } from "../index";

export const previewsRouter = Router();

/**
 * GET /api/previews — List all active project previews
 */
previewsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, project_name, preview_url, deploy_target, agent_id, status, created_at, updated_at
       FROM previews
       ORDER BY updated_at DESC
       LIMIT 50`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch previews" });
  }
});

/**
 * POST /api/previews — Register a new preview URL (called by agents after deploy)
 */
previewsRouter.post("/", async (req: Request, res: Response) => {
  const { project_name, preview_url, deploy_target, agent_id } = req.body;

  if (!project_name || !preview_url) {
    res.status(400).json({ error: "project_name and preview_url required" });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO previews (project_name, preview_url, deploy_target, agent_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (project_name) DO UPDATE SET
         preview_url = EXCLUDED.preview_url,
         deploy_target = EXCLUDED.deploy_target,
         status = 'active',
         updated_at = NOW()
       RETURNING *`,
      [project_name, preview_url, deploy_target || "local", agent_id || null],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to register preview" });
  }
});

/**
 * DELETE /api/previews/:id — Deactivate a preview
 */
previewsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await pool.query(
      `UPDATE previews SET status = 'stopped', updated_at = NOW() WHERE id = $1`,
      [req.params.id],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to deactivate preview" });
  }
});
