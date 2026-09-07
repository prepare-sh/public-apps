const button = document.getElementById("reload");
const auto = document.getElementById("auto");
const badge = document.getElementById("badge");
const elapsedEl = document.getElementById("elapsed");
const ttlEl = document.getElementById("ttl");
const statusEl = document.getElementById("status");
const nameEl = document.getElementById("product-name");
const priceEl = document.getElementById("price");

let autoTimer = null;
let ttlTimer = null;

function startTtlCountdown(seconds) {
  // The server hands us the real TTL of product:1; tick it down locally so the
  // viewer can watch the cache age without hammering Redis.
  clearInterval(ttlTimer);
  let remaining = seconds;

  const render = () => {
    if (remaining > 0) {
      ttlEl.textContent = remaining;
      ttlEl.classList.remove("is-idle");
      remaining -= 1;
    } else {
      ttlEl.textContent = "0";
      ttlEl.classList.add("is-idle");
      clearInterval(ttlTimer);
    }
  };

  render();
  ttlTimer = setInterval(render, 1000);
}

async function load() {
  button.disabled = true;
  badge.className = "badge badge-idle";
  badge.textContent = "READING";
  statusEl.textContent = "Calling /api/product ...";

  const start = performance.now();

  try {
    const response = await fetch("/api/product");

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
    const isHit = payload.source === "hit";

    elapsedEl.textContent = ms.toLocaleString();
    elapsedEl.classList.remove("is-idle");
    badge.className = isHit ? "badge badge-hit" : "badge badge-miss";
    badge.textContent = isHit ? "CACHE HIT" : "CACHE MISS";
    statusEl.textContent = isHit
      ? `Served from Redis without touching the database`
      : `Cache was empty — read the database and stored ${payload.key}`;

    nameEl.textContent = payload.product.name;
    priceEl.textContent = payload.product.price.toFixed(2);
    startTtlCountdown(payload.ttl);
  } catch (err) {
    badge.className = "badge badge-error";
    badge.textContent = "ERROR";
    statusEl.textContent = err.message || "Request failed.";
  } finally {
    // Always re-enable -- otherwise a failed request leaves the button stuck.
    button.disabled = false;
  }
}

button.addEventListener("click", load);

auto.addEventListener("change", () => {
  clearInterval(autoTimer);
  if (auto.checked) {
    load();
    autoTimer = setInterval(load, 2000);
  }
});

load();
