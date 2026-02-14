import { Router } from "express";
import { pool } from "../index";

export const goalsRouter = Router();

// List goals
goalsRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM goals ORDER BY created_at DESC");
    res.json({ goals: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch goals", details: String(err) });
  }
});

// Create goal
goalsRouter.post("/", async (req, res) => {
  try {
    const { title, description, target_value, unit, deadline } = req.body;
    const result = await pool.query(
      `INSERT INTO goals (title, description, target_value, unit, deadline)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description, target_value, unit, deadline]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create goal", details: String(err) });
  }
});

// Update goal progress
goalsRouter.patch("/:id", async (req, res) => {
  try {
    const { current_value, status } = req.body;
    const fields: string[] = ["updated_at = NOW()"];
    const params: any[] = [];

    if (current_value !== undefined) {
      params.push(current_value);
      fields.push(`current_value = $${params.length}`);
    }
    if (status) {
      params.push(status);
      fields.push(`status = $${params.length}`);
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE goals SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update goal", details: String(err) });
  }
});
