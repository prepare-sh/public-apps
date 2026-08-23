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
  elapsedEl.textContent = "0";
  elapsedEl.classList.add("is-idle");
  statusEl.textContent = "Calling /api/report ...";

  const start = performance.now();

  try {
    const response = await fetch("/api/report");

    // Read as text first: an error page may not be JSON at all.
    const raw = await response.text();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`Server returned ${response.status} (not JSON)`);
    }
    if (!response.ok) throw new Error(payload.error || `Server returned ${response.status}`);

    const ms = Math.round(performance.now() - start);
    const isHit = payload.source === "cache";

    elapsedEl.textContent = ms.toLocaleString();
    elapsedEl.classList.remove("is-idle");
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
  } catch (err) {
    badge.className = "badge badge-error";
    badge.textContent = "ERROR";
    elapsedEl.textContent = "0";
    elapsedEl.classList.add("is-idle");
    statusEl.textContent = err.message || "Request failed.";
  } finally {
    // Always re-enable -- otherwise a failed request leaves the button stuck.
    button.disabled = false;
    button.textContent = "Fetch Report";
  }
});
