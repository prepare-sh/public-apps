const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { seedIfEmpty } = require("./utils");

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

app.get("/index", async (req, res) => {
  const result = await pool.query(`
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' 
    AND indexname = 'idx_users_email'
  `);
  res.json({ exists: result.rows.length > 0 });
});

app.post("/index", async (req, res) => {
  const { action } = req.body;
  try {
    if (action === "create") {
      // Why GIN + trigrams instead of a regular B-tree index?
      //
      // A regular B-tree index (what we covered in the tutorial) works great for
      // exact matches and prefix searches like WHERE email = 'user@example.com'
      // or WHERE email LIKE 'user%' — it can follow the sorted tree directly.
      //
      // But ILIKE is case-insensitive, and B-tree indexes are case-sensitive by
      // default. So Postgres ignores a regular index for ILIKE and falls back to
      // a sequential scan of all 500,000 rows.
      //
      // The fix is a trigram index (GIN + gin_trgm_ops):
      // - pg_trgm breaks every string into overlapping 3-character chunks (trigrams)
      //   e.g. "hello" → "hel", "ell", "llo"
      // - GIN (Generalized Inverted Index) stores a lookup table of trigram → rows
      // - ILIKE 'user250000%' gets broken into trigrams too, and Postgres uses the
      //   index to find only rows whose trigrams match — no full table scan needed
      //
      // This is the right index type for case-insensitive search on text columns.
      // The B-tree index we created manually in the tutorial is still the right
      // choice for exact lookups like WHERE email = $1 — each index type has its
      // place depending on the query shape.
      await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_users_email ON users USING gin (email gin_trgm_ops)`,
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

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE email ILIKE $1`,
      [search + "%"],
    );
    const totalRows = parseInt(countResult.rows[0].count, 10);

    const start = Date.now();

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
seedIfEmpty(pool)
  .then(() => {
    app.listen(PORT, () => console.log(`Users API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });
