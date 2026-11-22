import psycopg
from fastembed import TextEmbedding

DSN = "postgresql://postgres:postgres@localhost:5432/movies"
model = TextEmbedding("BAAI/bge-small-en-v1.5", cache_dir="models")


def to_pgvector(vec):
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"


with psycopg.connect(DSN) as conn:
    rows = conn.execute("SELECT id, plot FROM movies WHERE embedding IS NULL ORDER BY id").fetchall()
    ids = [r[0] for r in rows]
    plots = [r[1] for r in rows]
    print(f"Embedding {len(plots)} plots...")
    for i, (movie_id, vec) in enumerate(zip(ids, model.passage_embed(plots, batch_size=64)), 1):
        conn.execute("UPDATE movies SET embedding = %s WHERE id = %s", (to_pgvector(vec), movie_id))
        if i % 500 == 0:
            print(f"  {i}/{len(plots)}")
    print("Done.")
