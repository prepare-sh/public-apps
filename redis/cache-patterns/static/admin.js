const form = document.getElementById("price-form");
const priceInput = document.getElementById("price");
const submit = document.getElementById("submit");
const resetBtn = document.getElementById("reset");
const statusEl = document.getElementById("status");
const dbPriceEl = document.getElementById("db-price");
const ttlNumEl = document.getElementById("ttl-num");
const opsEl = document.getElementById("ops");
const opsList = document.getElementById("ops-list");

function showOps(ops) {
  opsList.innerHTML = ops.map((op) => `<li><code>${op}</code></li>`).join("");
  opsEl.hidden = false;
}

function showTtl(ttl) {
  // redis TTL returns -2 when the key is gone, -1 when it has no expiry.
  ttlNumEl.textContent = ttl === null || ttl === undefined || ttl < 0 ? "no key" : ttl;
}

async function callJson(url, options) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`Server returned ${response.status} (not JSON)`);
  }
  if (!response.ok) throw new Error(payload.error || `Server returned ${response.status}`);
  return payload;
}

async function loadState() {
  try {
    const payload = await callJson("/api/mode");
    const radio = document.querySelector(`input[name="mode"][value="${payload.mode}"]`);
    if (radio) radio.checked = true;
    dbPriceEl.textContent = `$${payload.product.price.toFixed(2)}`;
    if (!priceInput.value) priceInput.value = payload.product.price.toFixed(2);
    showTtl(payload.ttl);
  } catch (err) {
    statusEl.textContent = err.message || "Could not load current state.";
  }
}

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener("change", async () => {
    try {
      const payload = await callJson("/api/admin/set-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: radio.value }),
      });
      statusEl.textContent = `Mode set to ${payload.mode}.`;
      opsEl.hidden = true;
    } catch (err) {
      statusEl.textContent = err.message || "Could not switch mode.";
    }
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submit.disabled = true;
  statusEl.textContent = "Writing ...";

  try {
    const payload = await callJson("/api/admin/update-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: Number(priceInput.value) }),
    });
    dbPriceEl.textContent = `$${payload.product.price.toFixed(2)}`;
    showTtl(payload.ttl);
    showOps(payload.ops);
    statusEl.textContent = `Price updated in ${payload.mode} mode.`;
  } catch (err) {
    statusEl.textContent = err.message || "Update failed.";
  } finally {
    submit.disabled = false;
  }
});

resetBtn.addEventListener("click", async () => {
  resetBtn.disabled = true;
  try {
    const payload = await callJson("/api/admin/reset", { method: "POST" });
    showOps(payload.ops);
    statusEl.textContent = "Back to the starting state.";
    priceInput.value = "";
    await loadState();
  } catch (err) {
    statusEl.textContent = err.message || "Reset failed.";
  } finally {
    resetBtn.disabled = false;
  }
});

loadState();
// Keep the TTL readout live so you can see the cache expire from this page too.
setInterval(loadState, 1000);
