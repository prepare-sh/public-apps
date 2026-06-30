const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());

const pool = new Pool({
  host: "localhost",
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "restaurant",
});

app.get("/menu", async (req, res) => {
  const {
    category,
    sort = "id",
    order = "asc",
    page = 1,
    pageSize = 5,
  } = req.query;

  const allowedSort = ["id", "name", "price", "category"];
  const sortColumn = allowedSort.includes(sort) ? sort : "id";
  const sortOrder = order.toLowerCase() === "desc" ? "DESC" : "ASC";

  const limit = Math.max(1, Math.min(parseInt(pageSize, 10) || 5, 50));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  try {
    const values = [];
    let whereClause = "";

    if (category) {
      values.push(category);
      whereClause = `WHERE category = $${values.length}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM menu ${whereClause}`,
      values,
    );
    const totalRows = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT id, name, price, category
       FROM menu
       ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
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
app.listen(PORT, () => console.log(`Menu API listening on port ${PORT}`));
