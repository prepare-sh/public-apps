import React from "react";
import { tokens } from "./tokens";

function Grid({ loading, pageSize, rows, error }) {
  if (loading) {
    return (
      <div style={tokens.grid}>
        {Array.from({ length: pageSize }).map((_, idx) => (
          <div key={idx} style={tokens.card}>
            <div style={tokens.cardBody}>
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
                  width: "100%",
                  height: 20,
                  borderRadius: 4,
                  marginBottom: 12,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!error && rows.length === 0) {
    return (
      <div style={tokens.grid}>
        <div style={tokens.empty}>
          <p style={{ margin: 0, fontWeight: 500, color: "#F2ECE1" }}>
            No users match this search.
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#7A705F" }}>
            Try looking for another email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={tokens.grid}>
      {rows.map((item) => (
        <div key={item.id} className="interactive-card" style={tokens.card}>
          <div style={tokens.cardBody}>
            <h3 style={tokens.cardName}>{item.username}</h3>
            <div style={tokens.priceRow}>
              <span style={tokens.priceDots} />
              <p style={tokens.cardPrice}>{item.email}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Grid;
