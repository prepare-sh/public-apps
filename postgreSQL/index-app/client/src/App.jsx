import { useEffect, useState } from "react";
import Grid from "./Grid";
import { tokens } from "./tokens";

const defaultRows = [
  {
    email: "bebra@gmail.com",
    username: "user1",
    id: 1,
  },
  {
    email: "bebra@gmail.com",
    username: "user1",
    id: 2,
  },
  {
    email: "bebra@gmail.com",
    username: "user1",
    id: 3,
  },
  {
    email: "bebra@gmail.com",
    username: "user1",
    id: 4,
  },
];

const pageSize = 12;

export default function App() {
  const [rows, setRows] = useState(defaultRows);
  const [search, setSearch] = useState("");
  const [hasIndex, setHasIndex] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      search,
      page: String(page),
      pageSize,
    });
    fetch(`/users?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setRows(d.rows);
        setTotalPages(d.totalPages || 1);
        setTotalRows(d.totalRows || 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  function handleSearch() {
    fetchData();
    setSearch("");
  }

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  const handleToggleIndex = () => {
    setPage(0);
    setHasIndex((prev) => !prev);
  };

  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <div style={tokens.page}>
      <div style={tokens.glow} />

      <div style={tokens.wrap}>
        <header style={tokens.header}>
          <span style={tokens.eyebrow}>PostgreSQL · Indexes demo</span>
          <h1 style={tokens.title}>Users</h1>
          <p style={tokens.lede}>
            Compare finding a user by {` `}
            <code style={tokens.code}>email</code>
            {` `}
            with and without the {` `}
            <code style={tokens.code}>index</code>
          </p>
          <div style={tokens.divider} />
        </header>

        {/* Results count / Status area */}
        <div style={tokens.metaRow}>
          {!error && (
            <p style={tokens.count}>
              {loading
                ? "Searching users..."
                : `${totalRows} ${totalRows === 1 ? "user" : "users"} found`}
            </p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div style={tokens.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={tokens.toolbar}>
          <div style={tokens.searchGroup}>
            <label className="sr-only" htmlFor="search"></label>
            <input
              style={tokens.input}
              placeholder="Search by email"
              type="text"
              name="search"
              id="search"
            />
            <button
              aria-label="show users matching the search"
              type="submit"
              data-type="classic"
              style={tokens.searchBtn}
              onClick={handleSearch}
            >
              Search
            </button>
          </div>
          <div style={tokens.searchGroup}>
            <button
              style={{
                ...tokens.indexBtn,
                ...(hasIndex ? tokens.indexBtnOn : tokens.indexBtnOff),
              }}
              type="button"
              onClick={handleToggleIndex}
            >
              {hasIndex ? "Remove Index" : "Add Index"}
            </button>
            {/* add a stop watch here */}
          </div>
        </div>

        <Grid error={error} loading={loading} pageSize={pageSize} rows={rows} />

        {!loading && !error && totalPages > 1 && (
          <div style={tokens.pagination}>
            <button
              className="page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={
                page <= 1
                  ? { ...tokens.pageBtn, ...tokens.pageBtnDisabled }
                  : tokens.pageBtn
              }
            >
              ← Previous
            </button>

            {pages.map((n) => (
              <button
                key={n}
                className="page-btn"
                data-active={n === page}
                onClick={() => setPage(n)}
                style={
                  n === page
                    ? { ...tokens.pageBtn, ...tokens.pageBtnActive }
                    : tokens.pageBtn
                }
              >
                {n}
              </button>
            ))}

            <button
              className="page-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={
                page >= totalPages
                  ? { ...tokens.pageBtn, ...tokens.pageBtnDisabled }
                  : tokens.pageBtn
              }
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
