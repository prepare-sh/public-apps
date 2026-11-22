import csv
import psycopg

DSN = "postgresql://postgres:postgres@localhost:5432/movies"

with psycopg.connect(DSN) as conn:
    conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    conn.execute("DROP TABLE IF EXISTS movies, queries")
    conn.execute("""
        CREATE TABLE movies (
            id        serial PRIMARY KEY,
            title     text NOT NULL,
            year      int,
            genre     text,
            plot      text NOT NULL,
            plot_tsv  tsvector GENERATED ALWAYS AS (to_tsvector('english', plot)) STORED,
            embedding vector(384)
        )
    """)
    conn.execute("CREATE INDEX movies_plot_tsv_idx ON movies USING gin (plot_tsv)")
    conn.execute("""
        CREATE TABLE queries (
            name      text PRIMARY KEY,
            question  text NOT NULL,
            embedding vector(384) NOT NULL
        )
    """)
    with open("movies.csv", newline="", encoding="utf-8") as f:
        with conn.cursor().copy("COPY movies (title, year, genre, plot) FROM STDIN") as copy:
            for row in csv.DictReader(f):
                copy.write_row((row["title"], int(row["year"]), row["genre"], row["plot"]))
    print(conn.execute("SELECT count(*) FROM movies").fetchone()[0], "movies loaded")
