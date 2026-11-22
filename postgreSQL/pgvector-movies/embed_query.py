import sys
import psycopg
from fastembed import TextEmbedding

DSN = "postgresql://postgres:postgres@localhost:5432/movies"

if len(sys.argv) != 3:
    sys.exit('Usage: python embed_query.py NAME "your question"')

name, question = sys.argv[1], sys.argv[2]

model = TextEmbedding("BAAI/bge-small-en-v1.5", cache_dir="models")
vec = next(iter(model.query_embed(question)))
literal = "[" + ",".join(f"{x:.6f}" for x in vec) + "]"

with psycopg.connect(DSN) as conn:
    conn.execute("""
        INSERT INTO queries (name, question, embedding) VALUES (%s, %s, %s)
        ON CONFLICT (name) DO UPDATE SET question = EXCLUDED.question, embedding = EXCLUDED.embedding
    """, (name, question, literal))
print(f"Saved query '{name}'")
