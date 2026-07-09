import { tokens } from "./tokens";

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const delta = 2;
  const range = [];
  const rangeWithDots = [];
  let l;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - delta && i <= page + delta)
    ) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l > 2) {
        rangeWithDots.push("...");
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return (
    <div style={tokens.pagination}>
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        style={
          page <= 1
            ? { ...tokens.pageBtn, ...tokens.pageBtnDisabled }
            : tokens.pageBtn
        }
      >
        ← Previous
      </button>

      {rangeWithDots.map((n, idx) =>
        n === "..." ? (
          <span
            key={`dots-${idx}`}
            style={{ ...tokens.pageBtn, cursor: "default", border: "none" }}
          >
            …
          </span>
        ) : (
          <button
            key={n}
            onClick={() => onPageChange(n)}
            style={
              n === page
                ? { ...tokens.pageBtn, ...tokens.pageBtnActive }
                : tokens.pageBtn
            }
          >
            {n}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
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
  );
}
