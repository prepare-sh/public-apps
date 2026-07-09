async function seedIfEmpty(pool) {
  const result = await pool.query("SELECT COUNT(*) FROM users");
  const count = parseInt(result.rows[0].count, 10);

  await pool.query("DROP INDEX IF EXISTS idx_users_email;");

  if (count === 0) {
    console.log("Seeding users table...");
    await pool.query(`
      INSERT INTO users (name, email, created_at)
      SELECT
        'User ' || i,
        'user' || i || '@example.com',
        NOW() - (random() * interval '3 years')
      FROM generate_series(1, 500000) AS i
    `);
    console.log("Seeding complete.");
  } else {
    console.log(`Users table already has ${count} rows, skipping seed.`);
  }
}

module.exports = { seedIfEmpty };
