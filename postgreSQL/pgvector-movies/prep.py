# Run once, locally. Builds movies.csv from Kaggle's wiki_movie_plots_deduped.csv.
# pip install pandas && python prep.py
import pandas as pd

df = pd.read_csv("wiki_movie_plots_deduped.csv")
df = df.rename(columns={"Title": "title", "Release Year": "year", "Genre": "genre", "Plot": "plot"})
df = df[df["Origin/Ethnicity"] == "American"][["title", "year", "genre", "plot"]]
df["genre"] = df["genre"].fillna("unknown").str.lower().str.strip()
df = df.dropna(subset=["title", "year", "plot"])

must_have = df[
    ((df["title"] == "Titanic") & (df["year"] == 1997))
    | df["plot"].str.contains("Gandalf", na=False)
]
rest = df.drop(must_have.index).sample(5000 - len(must_have), random_state=42)
out = pd.concat([must_have, rest]).sample(frac=1, random_state=1)
out.to_csv("movies.csv", index=False)

print(f"Wrote {len(out)} movies")
print("Titanic 1997 included:", ((out["title"] == "Titanic") & (out["year"] == 1997)).any())
print("Gandalf films:", out[out["plot"].str.contains("Gandalf")]["title"].tolist())
print("Westerns:", (out["genre"] == "western").sum())
