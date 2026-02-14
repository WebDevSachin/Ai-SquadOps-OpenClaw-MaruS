import { Router } from "express";
import { pool } from "../index";

export const messagesRouter = Router();

// List agent group chat messages
messagesRouter.get("/", async (req, res) => {
  try {
    const { from_agent, to_agent, message_type, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT m.*,
        fa.name as from_agent_name,
        ta.name as to_agent_name
      FROM agent_messages m
      LEFT JOIN agents fa ON m.from_agent = fa.id
      LEFT JOIN agents ta ON m.to_agent = ta.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (from_agent) {
      params.push(from_agent);
      conditions.push(`m.from_agent = $${params.length}`);
    }
    if (to_agent) {
      params.push(to_agent);
      conditions.push(`m.to_agent = $${params.length}`);
    }
    if (message_type) {
      params.push(message_type);
      conditions.push(`m.message_type = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY m.created_at DESC";
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ messages: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages", details: String(err) });
  }
});

// Send agent message
messagesRouter.post("/", async (req, res) => {
  try {
    const { from_agent, to_agent, content, message_type, metadata } = req.body;
    const result = await pool.query(
      `INSERT INTO agent_messages (from_agent, to_agent, content, message_type, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [from_agent, to_agent, content, message_type || "chat", JSON.stringify(metadata || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to send message", details: String(err) });
  }
});
