const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());

const pool = new Pool({
  host: "localhost",
  port: process.env.PGPORT || 5433,
  user: process.env.PGUSER || "postgres",
  // change to postgres
  password: process.env.PGPASSWORD || "Nadir-2004",
  database: process.env.PGDATABASE || "usersdb",
});

app.get("/users", async (req, res) => {
  const { search = "", page = 1, pageSize = 5 } = req.query;

  const useIndex = req.query.index === "true";

  const limit = Math.max(1, Math.min(parseInt(pageSize, 10) || 5, 50));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  // created index with CREATE INDEX idx_users_email_pattern ON users (email, varchar_pattern_ops);
  try {
    let querytext = "";

    if (useIndex) {
      querytext = `WHERE email ILIKE '$1%'`;
    } else {
      querytext = `WHERE (email || '') ILIKE '$1%'`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${querytext}`,
      [search],
    );
    const totalRows = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT id, username, email
       FROM users
       ${querytext}
       LIMIT $2 OFFSET $3;`,
      [search, limit, offset],
    );

    res.json({
      rows: dataResult.rows,
      page: parseInt(page, 10),
      pageSize: limit,
      totalRows,
      totalPages: Math.ceil(totalRows / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`users API listening on port ${PORT}`));
