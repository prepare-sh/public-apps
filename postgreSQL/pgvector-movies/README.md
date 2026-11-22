# pgvector movies

Lab files for the pgvector tutorial on prepare.sh: semantic, hybrid and filtered search in Postgres.

| File | Purpose |
| --- | --- |
| `movies.csv` | About 5,000 films: title, year, genre and plot |
| `load.py` | Creates the tables and loads `movies.csv` (no embeddings) |
| `embed_movies.py` | Embeds every plot with `BAAI/bge-small-en-v1.5` via fastembed |
| `embed_query.py` | Embeds one question and saves it: `python embed_query.py NAME "question"` |

## Data

Movie plots come from Wikipedia, via the "Wikipedia Movie Plots" dataset on Kaggle
(https://www.kaggle.com/datasets/jrobischon/wikipedia-movie-plots).
Wikipedia text is licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
`movies.csv` is a subset of that dataset and is shared under the same license.
