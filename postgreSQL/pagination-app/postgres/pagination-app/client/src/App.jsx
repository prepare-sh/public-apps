import { useEffect, useState } from "react";

const CATEGORY_LABELS = {
  "": "All",
  starter: "Starter",
  main: "Main",
  dessert: "Dessert",
};

export default function App() {
  const [rows, setRows] = useState([]);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("id");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      sort,
      order,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (category) params.set("category", category);
    fetch(`/menu?${params}`)
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
  }, [category, sort, order, page, pageSize]);

  const go = (val, setter) => {
    setter(val);
    setPage(1);
  };

  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <div style={s.page}>
      <div style={s.glow} />

      {/* Global CSS Injector for Animations & Hover states */}
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          background: #100D0A;
        }
        * {
          box-sizing: border-box;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #211c15 25%, #2c2519 50%, #211c15 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite linear;
        }
        .interactive-card {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s, border-color 0.2s;
        }
        .interactive-card:hover {
          transform: translateY(-4px);
          border-color: #4C9A6A55 !important;
          box-shadow: 0 16px 28px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(76,154,106,0.08);
        }
        button, select {
          outline: none;
          transition: all 0.2s !important;
        }
        button:focus-visible, select:focus-visible {
          box-shadow: 0 0 0 3px rgba(76, 154, 106, 0.35);
        }
        .filter-btn:hover:not([data-active="true"]) {
          border-color: #3D362B !important;
          background: #1F1A14 !important;
          color: #F2ECE1 !important;
        }
        .page-btn:hover:not([disabled]):not([data-active="true"]) {
          border-color: #3D362B !important;
          background: #1F1A14 !important;
        }
        select option {
          background: #1B1712;
          color: #F2ECE1;
        }
        ::selection {
          background: rgba(76, 154, 106, 0.35);
        }
      `}</style>

      <div style={s.wrap}>
        {/* Header */}
        <header style={s.header}>
          <span style={s.eyebrow}>PostgreSQL · Pagination Demo</span>
          <h1 style={s.title}>Restaurant Menu</h1>
          <p style={s.lede}>
            Every filter, sort, and page change runs a real SQL query —&nbsp;
            <code style={s.code}>WHERE</code>,{" "}
            <code style={s.code}>ORDER BY</code>, and&nbsp;
            <code style={s.code}>LIMIT / OFFSET</code>.
          </p>
          <div style={s.divider} />
        </header>

        {/* Toolbar */}
        <div style={s.toolbar}>
          <div style={s.filterGroup}>
            {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
              <button
                key={val}
                className="filter-btn"
                data-active={category === val}
                onClick={() => go(val, setCategory)}
                style={
                  category === val
                    ? { ...s.filterBtn, ...s.filterBtnActive }
                    : s.filterBtn
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div style={s.sortGroup}>
            <select
              value={sort}
              onChange={(e) => go(e.target.value, setSort)}
              style={s.select}
            >
              <option value="id">Default order</option>
              <option value="price">Sort by price</option>
              <option value="name">Sort by name</option>
            </select>
            <select
              value={order}
              onChange={(e) => go(e.target.value, setOrder)}
              style={s.select}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>

        {/* Results count / Status area */}
        <div style={s.metaRow}>
          {!error && (
            <p style={s.count}>
              {loading
                ? "Searching menu..."
                : `${totalRows} ${totalRows === 1 ? "dish" : "dishes"} found`}
            </p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div style={s.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Dynamic Main Grid Area */}
        <div style={s.grid}>
          {loading ? (
            Array.from({ length: pageSize }).map((_, idx) => (
              <div key={idx} style={s.card}>
                <div
                  className="skeleton"
                  style={{ ...s.cardImg, background: "transparent" }}
                />
                <div style={s.cardBody}>
                  <div
                    className="skeleton"
                    style={{
                      width: "30%",
                      height: 16,
                      borderRadius: 12,
                      marginBottom: 12,
                    }}
                  />
                  <div
                    className="skeleton"
                    style={{
                      width: "75%",
                      height: 18,
                      borderRadius: 4,
                      marginBottom: 12,
                    }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: "20%", height: 14, borderRadius: 4 }}
                  />
                </div>
              </div>
            ))
          ) : !error && rows.length === 0 ? (
            <div style={s.empty}>
              <span style={{ fontSize: 32, marginBottom: 12 }}>🍽️</span>
              <p style={{ margin: 0, fontWeight: 500, color: "#F2ECE1" }}>
                No dishes match this filter.
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#7A705F" }}>
                Try selecting another category.
              </p>
            </div>
          ) : !error ? (
            rows.map((item) => (
              <div key={item.id} className="interactive-card" style={s.card}>
                <div style={s.cardImg}>
                  <span style={s.cardEmoji}>{emoji(item.category)}</span>
                </div>
                <div style={s.cardBody}>
                  <span style={{ ...s.badge, ...badgeColor(item.category) }}>
                    {item.category || "General"}
                  </span>
                  <h3 style={s.cardName}>{item.name}</h3>
                  <div style={s.priceRow}>
                    <span style={s.priceDots} />
                    <p style={s.cardPrice}>£{Number(item.price).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))
          ) : null}
        </div>

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div style={s.pagination}>
            <button
              className="page-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={
                page <= 1 ? { ...s.pageBtn, ...s.pageBtnDisabled } : s.pageBtn
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
                  n === page ? { ...s.pageBtn, ...s.pageBtnActive } : s.pageBtn
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
                  ? { ...s.pageBtn, ...s.pageBtnDisabled }
                  : s.pageBtn
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

function emoji(category) {
  if (category === "starter") return "🥗";
  if (category === "main") return "🍕";
  if (category === "dessert") return "🍰";
  return "🍽️";
}

function badgeColor(category) {
  if (category === "starter")
    return {
      background: "rgba(127, 163, 122, 0.12)",
      color: "#9FC298",
      border: "1px solid rgba(127, 163, 122, 0.35)",
    };
  if (category === "main")
    return {
      background: "rgba(201, 123, 74, 0.14)",
      color: "#E0A47D",
      border: "1px solid rgba(201, 123, 74, 0.38)",
    };
  if (category === "dessert")
    return {
      background: "rgba(201, 123, 156, 0.14)",
      color: "#E0A0BE",
      border: "1px solid rgba(201, 123, 156, 0.38)",
    };
  return {
    background: "rgba(167, 156, 137, 0.12)",
    color: "#C9BFAE",
    border: "1px solid rgba(167, 156, 137, 0.3)",
  };
}

// Warm, candlelit dark palette — built for a menu, not a dashboard.
const s = {
  page: {
    minHeight: "100vh",
    background: "#100D0A",
    padding: "48px 24px",
    boxSizing: "border-box",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -180,
    left: "50%",
    transform: "translateX(-50%)",
    width: 900,
    height: 500,
    background:
      "radial-gradient(closest-side, rgba(76,154,106,0.14), transparent 70%)",
    pointerEvents: "none",
  },
  wrap: { maxWidth: 960, margin: "0 auto", position: "relative" },

  header: { marginBottom: 32 },
  eyebrow: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#4C9A6A",
    marginBottom: 12,
  },
  title: {
    fontFamily: "'Georgia', 'Iowan Old Style', ui-serif, serif",
    fontSize: 40,
    fontWeight: 600,
    color: "#F5EFE4",
    margin: "0 0 12px",
    letterSpacing: "-0.01em",
  },
  lede: {
    fontSize: 15,
    color: "#A79C89",
    margin: "0 0 24px",
    lineHeight: 1.65,
    maxWidth: 620,
  },
  code: {
    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
    background: "#1F1A14",
    border: "1px solid #2E2820",
    padding: "2px 7px",
    borderRadius: 6,
    fontSize: 12.5,
    color: "#6BB585",
    fontWeight: 600,
    whiteSpace: "nowrap",
    display: "inline-block",
  },
  divider: {
    height: 1,
    background: "linear-gradient(90deg, #2E2820, transparent 70%)",
    margin: "0 0 12px",
  },

  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  filterGroup: { display: "flex", gap: 8, flexWrap: "wrap" },
  sortGroup: { display: "flex", gap: 10 },

  filterBtn: {
    padding: "8px 16px",
    borderRadius: 9999,
    border: "1px solid #2E2820",
    background: "#161210",
    color: "#A79C89",
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 500,
  },
  filterBtnActive: {
    background: "#4C9A6A",
    color: "#100D0A",
    borderColor: "#4C9A6A",
    fontWeight: 700,
    boxShadow: "0 4px 16px rgba(76, 154, 106, 0.25)",
  },

  select: {
    padding: "8px 32px 8px 14px",
    borderRadius: 10,
    border: "1px solid #2E2820",
    background: "#161210",
    fontSize: 14,
    color: "#D8CFC0",
    cursor: "pointer",
    fontWeight: 500,
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1L5 5L9 1' stroke='%23A79C89' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 14px center",
  },

  metaRow: { minHeight: 20, marginBottom: 16 },
  count: {
    fontSize: 13,
    color: "#7A705F",
    fontWeight: 500,
    margin: 0,
    letterSpacing: "0.02em",
  },
  empty: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: "48px 16px",
    background: "#161210",
    borderRadius: 16,
    border: "1px dashed #3D362B",
  },
  errorBox: {
    background: "rgba(201, 82, 74, 0.1)",
    border: "1px solid rgba(201, 82, 74, 0.35)",
    borderRadius: 12,
    padding: "16px",
    color: "#E29A93",
    fontSize: 14,
    marginBottom: 24,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
    marginBottom: 40,
  },

  card: {
    background: "#161210",
    borderRadius: 16,
    border: "1px solid #241F19",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.4)",
    display: "flex",
    flexDirection: "column",
  },
  cardImg: {
    background: "linear-gradient(160deg, #1B1712 0%, #14100D 100%)",
    height: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderBottom: "1px solid #221C15",
  },
  cardEmoji: { fontSize: 44, filter: "saturate(0.9)" },
  cardBody: {
    padding: "20px",
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
  },
  badge: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 9999,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 12,
  },
  cardName: {
    fontFamily: "'Georgia', ui-serif, serif",
    fontSize: 17,
    fontWeight: 600,
    color: "#F2ECE1",
    margin: "0 0 14px",
    lineHeight: 1.3,
  },
  priceRow: {
    marginTop: "auto",
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  priceDots: {
    flexGrow: 1,
    borderBottom: "1px dashed #3D362B",
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 16,
    color: "#6BB585",
    margin: 0,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },

  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 16,
  },
  pageBtn: {
    minWidth: 40,
    height: 40,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #2E2820",
    background: "#161210",
    color: "#D8CFC0",
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 600,
  },
  pageBtnActive: {
    background: "#4C9A6A",
    color: "#100D0A",
    borderColor: "#4C9A6A",
    boxShadow: "0 4px 14px rgba(76, 154, 106, 0.22)",
  },
  pageBtnDisabled: {
    background: "#131110",
    color: "#4A4438",
    borderColor: "#221C15",
    cursor: "not-allowed",
  },
};
