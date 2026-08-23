const button = document.getElementById("fetch");
const badge = document.getElementById("badge");
const elapsedEl = document.getElementById("elapsed");
const statusEl = document.getElementById("status");
const result = document.getElementById("result");
const resultTitle = document.getElementById("result-title");
const resultMeta = document.getElementById("result-meta");
const resultRows = document.getElementById("result-rows");

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

button.addEventListener("click", async () => {
  button.disabled = true;
  button.textContent = "Fetching...";
  badge.className = "badge badge-idle";
  badge.textContent = "WORKING";
  elapsedEl.textContent = "—";
  statusEl.textContent = "Calling /api/report ...";

  const start = performance.now();
  const response = await fetch("/api/report");
  const payload = await response.json();
  const ms = Math.round(performance.now() - start);

  const isHit = payload.source === "cache";
  elapsedEl.textContent = ms.toLocaleString();
  badge.className = isHit ? "badge badge-hit" : "badge badge-miss";
  badge.textContent = isHit ? "CACHE HIT" : "CACHE MISS";
  statusEl.textContent = isHit
    ? `Served from Redis · expires in ${payload.ttl}s`
    : `Computed the slow way · cached for ${payload.ttl}s`;

  resultTitle.textContent = payload.data.title;
  resultMeta.textContent = `generated ${payload.data.generated_at}`;
  resultRows.innerHTML = payload.data.rows
    .map((row) => `<tr><td>${row.region}</td><td class="num">${money.format(row.revenue)}</td></tr>`)
    .join("");
  result.hidden = false;

  button.disabled = false;
  button.textContent = "Fetch Report";
});
