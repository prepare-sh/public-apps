const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  host: "localhost",
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "appdb",
});

app.post("/index", async (req, res) => {
  const { action } = req.body;
  try {
    if (action === "create") {
      await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users (email text_pattern_ops)",
      );
    } else {
      await pool.query("DROP INDEX IF EXISTS idx_users_email");
    }
    res.json({ ok: true, action });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/users", async (req, res) => {
  const { search = "", page = 1, pageSize = 12 } = req.query;

  const limit = Math.max(1, Math.min(parseInt(pageSize, 10) || 12, 50));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
  const start = Date.now();

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE email ILIKE $1`,
      [search + "%"],
    );
    const totalRows = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT id, name, email
       FROM users
       WHERE email ILIKE $1
       ORDER BY id
       LIMIT $2 OFFSET $3`,
      [search + "%", limit, offset],
    );

    const ms = Date.now() - start;

    res.json({
      rows: dataResult.rows,
      page: parseInt(page, 10),
      pageSize: limit,
      totalRows,
      totalPages: Math.ceil(totalRows / limit),
      ms,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Users API listening on port ${PORT}`));
