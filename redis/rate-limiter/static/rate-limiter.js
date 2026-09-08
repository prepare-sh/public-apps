const algorithmInputs = document.querySelectorAll('input[name="algorithm"]');

const configMain = document.getElementById("config-main");
const configNote = document.getElementById("config-note");
const opsList = document.getElementById("ops-list");
const keyPrefix = document.getElementById("key-prefix");

const badge = document.querySelector(".badge");

const remainingValue = document.getElementById("remaining-value");
const usedValue = document.getElementById("used-value");

const statusText = document.getElementById("status-text");

const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");

const burstButton = document.getElementById("burst-button");
const boundaryButton = document.getElementById("boundary-button");
const resetButton = document.getElementById("reset-button");

const burstAllowed = document.getElementById("burst-allowed");
const burstBlocked = document.getElementById("burst-blocked");
const burstStatus = document.getElementById("burst-status");

const results = document.getElementById("results");

// -----------------------------------------------------------------------------
// Configuration shown in the UI
// -----------------------------------------------------------------------------

const CONFIG = {
  fixed: {
    main: "5 requests / 10 seconds",
    note: "Fixed window",
    ops: ["INCR", "EXPIRE"],
    key: "ratelimit:fixed:demo-client",
  },

  sliding: {
    main: "5 requests / rolling 10 seconds",
    note: "Sliding window",
    ops: ["ZADD", "ZREMRANGEBYSCORE", "ZCARD", "EXPIRE"],
    key: "ratelimit:sliding:demo-client",
  },

  token: {
    main: "5 tokens · 1 token / 2 seconds",
    note: "Token bucket",
    ops: ["HGETALL", "HSET"],
    key: "ratelimit:bucket:demo-client",
  },
};

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

let currentAlgorithm = "fixed";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatNumber(value) {
  if (value === undefined || value === null) {
    return "—";
  }

  if (Number.isInteger(value)) {
    return value.toString();
  }

  return Number(value).toFixed(1);
}

function setBusy(button, busy, text = null) {
  if (!button) {
    return;
  }

  if (busy) {
    button.disabled = true;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    if (text) {
      button.textContent = text;
    }
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }
}

function setBadge(text, type = "ready") {
  if (!badge) {
    return;
  }

  badge.textContent = text;

  badge.classList.remove(
    "badge-hit",
    "badge-miss",
    "badge-error",
    "badge-idle",
  );

  if (type === "hit") {
    badge.classList.add("badge-hit");
  } else if (type === "miss") {
    badge.classList.add("badge-miss");
  } else if (type === "error") {
    badge.classList.add("badge-error");
  } else if (type === "idle") {
    badge.classList.add("badge-idle");
  }
}

function clearResults() {
  if (!results) {
    return;
  }

  results.innerHTML = `
    <div class="results-empty">
      No attempts yet. Try the login form or run a burst.
    </div>
  `;

  if (burstAllowed) {
    burstAllowed.textContent = "0";
  }

  if (burstBlocked) {
    burstBlocked.textContent = "0";
  }

  if (burstStatus) {
    burstStatus.textContent = "";
  }
}

// -----------------------------------------------------------------------------
// UI rendering
// -----------------------------------------------------------------------------

function renderOperations(algorithm) {
  const config = CONFIG[algorithm];

  if (!config) {
    return;
  }

  opsList.innerHTML = "";

  config.ops.forEach((operation) => {
    const span = document.createElement("span");

    span.className = "ops-item";
    span.textContent = operation;

    opsList.appendChild(span);
  });

  keyPrefix.textContent = config.key;
}

function renderConfig(algorithm) {
  const config = CONFIG[algorithm];

  if (!config) {
    return;
  }

  configMain.textContent = config.main;
  configNote.textContent = config.note;

  renderOperations(algorithm);
}

function updateStatus(data = null) {
  console.log({
    remainingValue,
    usedValue,
    statusText,
  });

  if (!data) {
    fetchStatus();
    return;
  }

  const remaining = data.remaining ?? 0;
  const used = data.used ?? 0;

  if (remainingValue !== null) {
    remainingValue.textContent = formatNumber(remaining);
  }

  if (usedValue !== null) {
    usedValue.textContent = formatNumber(used);
  }

  if (statusText !== null) {
    if (remaining > 0) {
      statusText.textContent = `${formatNumber(remaining)} request${
        remaining === 1 ? "" : "s"
      } remaining.`;
    } else {
      statusText.textContent = "The rate limit has been reached.";
    }
  }

  if (data.algorithm) {
    currentAlgorithm = data.algorithm;
  }
}

async function fetchStatus() {
  try {
    const response = await fetch("/api/status");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch status.");
    }

    updateStatus(data);
  } catch (error) {
    console.error(error);

    setBadge("ERROR", "error");

    if (statusText) {
      statusText.textContent = "Could not read the rate limiter status.";
    }
  }
}

// -----------------------------------------------------------------------------
// Render burst results
// -----------------------------------------------------------------------------

function renderResults(items) {
  if (!results) {
    return;
  }

  if (!items || items.length === 0) {
    clearResults();
    return;
  }

  results.innerHTML = "";

  items.forEach((item) => {
    const result = document.createElement("div");

    result.className = `result ${
      item.allowed ? "result-allowed" : "result-blocked"
    }`;

    const left = document.createElement("div");
    left.className = "result-left";

    const icon = document.createElement("span");
    icon.className = "result-icon";
    icon.textContent = item.allowed ? "✓" : "×";

    const attempt = document.createElement("span");
    attempt.className = "result-attempt";
    attempt.textContent = `Attempt ${item.attempt}`;

    const state = document.createElement("span");
    state.className = "result-state";
    state.textContent = item.allowed ? "Allowed" : "Rate limited";

    left.appendChild(icon);
    left.appendChild(attempt);
    left.appendChild(state);

    const remaining = document.createElement("span");
    remaining.className = "result-remaining";
    remaining.textContent = `${formatNumber(item.remaining)} remaining`;

    result.appendChild(left);
    result.appendChild(remaining);

    results.appendChild(result);
  });
}

// -----------------------------------------------------------------------------
// Algorithm switching
// -----------------------------------------------------------------------------

algorithmInputs.forEach((input) => {
  input.addEventListener("change", async () => {
    if (!input.checked) {
      return;
    }

    const algorithm = input.value;

    setBusy(burstButton, true, "Switching...");

    setBusy(boundaryButton, true);

    try {
      const response = await fetch("/api/set-algorithm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          algorithm,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change algorithm.");
      }

      currentAlgorithm = algorithm;

      renderConfig(algorithm);
      clearResults();

      setBadge("READY", "ready");

      if (statusText) {
        statusText.textContent = "Ready to accept login attempts.";
      }

      updateStatus(data.status);
    } catch (error) {
      console.error(error);

      setBadge("ERROR", "error");

      if (statusText) {
        statusText.textContent = error.message;
      }
    } finally {
      setBusy(burstButton, false);
      setBusy(boundaryButton, false);
    }
  });
});

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  setBusy(loginButton, true, "Checking...");

  try {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    // -------------------------------------------------------------------------
    // Add this individual login attempt to the Burst Demo results
    // -------------------------------------------------------------------------

    const existingResults = Array.from(results.querySelectorAll(".result"));

    const attemptNumber = existingResults.length + 1;

    renderResults([
      ...existingResults.map((result, index) => ({
        attempt: index + 1,
        allowed: result.classList.contains("result-allowed"),
        remaining: 0,
      })),
      {
        attempt: attemptNumber,
        allowed: response.status !== 429,
        remaining: data.remaining ?? 0,
      },
    ]);

    // Update burst counters
    const allowedResults = results.querySelectorAll(".result-allowed");

    const blockedResults = results.querySelectorAll(".result-blocked");

    burstAllowed.textContent = allowedResults.length;
    burstBlocked.textContent = blockedResults.length;

    // -------------------------------------------------------------------------
    // Update main status
    // -------------------------------------------------------------------------

    if (response.status === 429) {
      setBadge("RATE LIMITED", "miss");

      statusText.textContent =
        "Too many requests. The rate limiter blocked this attempt.";
    } else if (response.status === 401) {
      setBadge("ALLOWED", "hit");

      statusText.textContent =
        "Request passed the rate limiter, but the credentials are invalid.";
    } else if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    await fetchStatus();
  } catch (error) {
    console.error(error);

    setBadge("ERROR", "error");

    if (statusText) {
      statusText.textContent = error.message;
    }
  } finally {
    setBusy(loginButton, false);
  }
});

// -----------------------------------------------------------------------------
// Normal burst
// -----------------------------------------------------------------------------

burstButton.addEventListener("click", async () => {
  setBusy(burstButton, true, "Running...");

  setBusy(boundaryButton, true);

  setBusy(resetButton, true);

  if (burstStatus) {
    burstStatus.textContent = "Sending 10 requests...";
  }

  try {
    const response = await fetch("/api/burst?n=10", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Burst failed.");
    }

    renderResults(data.results);

    burstAllowed.textContent = data.allowed;

    burstBlocked.textContent = data.blocked;

    if (burstStatus) {
      burstStatus.textContent = `Completed 10 attempts using ${CONFIG[
        data.algorithm
      ].note.toLowerCase()}.`;
    }

    if (data.blocked > 0) {
      setBadge("RATE LIMITED", "miss");
    } else {
      setBadge("ALLOWED", "hit");
    }

    await fetchStatus();
  } catch (error) {
    console.error(error);

    setBadge("ERROR", "error");

    if (burstStatus) {
      burstStatus.textContent = error.message;
    }
  } finally {
    setBusy(burstButton, false);
    setBusy(boundaryButton, false);
    setBusy(resetButton, false);
  }
});

// -----------------------------------------------------------------------------
// Fixed-window boundary burst
// -----------------------------------------------------------------------------

boundaryButton.addEventListener("click", async () => {
  if (currentAlgorithm !== "fixed") {
    setBadge("FIXED ONLY", "idle");

    if (burstStatus) {
      burstStatus.textContent =
        "The boundary demonstration only applies to Fixed Window.";
    }

    return;
  }

  setBusy(boundaryButton, true, "Running...");

  setBusy(burstButton, true);

  setBusy(resetButton, true);

  if (burstStatus) {
    burstStatus.textContent = "Waiting for the window boundary...";
  }

  try {
    /*
     * Timing is handled entirely by the server.
     *
     * This avoids browser/server clock differences and makes
     * the boundary demonstration reproducible.
     */
    const response = await fetch("/api/boundary-burst", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Boundary burst failed.");
    }

    renderResults(data.results);

    burstAllowed.textContent = data.allowed;

    burstBlocked.textContent = data.blocked;

    if (burstStatus) {
      burstStatus.textContent =
        "5 requests were accepted at the end of one window and 5 more at the start of the next.";
    }

    setBadge("BOUNDARY HIT", "hit");

    await fetchStatus();
  } catch (error) {
    console.error(error);

    setBadge("ERROR", "error");

    if (burstStatus) {
      burstStatus.textContent = error.message;
    }
  } finally {
    setBusy(boundaryButton, false);
    setBusy(burstButton, false);
    setBusy(resetButton, false);
  }
});

// -----------------------------------------------------------------------------
// Reset
// -----------------------------------------------------------------------------

resetButton.addEventListener("click", async () => {
  setBusy(resetButton, true, "Resetting...");

  setBusy(burstButton, true);

  setBusy(boundaryButton, true);

  try {
    const response = await fetch("/api/reset", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Reset failed.");
    }

    clearResults();

    setBadge("READY", "ready");

    if (statusText) {
      statusText.textContent =
        "Rate limiter reset. Ready to accept login attempts.";
    }

    updateStatus(data.status);
  } catch (error) {
    console.error(error);

    setBadge("ERROR", "error");

    if (statusText) {
      statusText.textContent = error.message;
    }
  } finally {
    setBusy(resetButton, false);
    setBusy(burstButton, false);
    setBusy(boundaryButton, false);
  }
});

// -----------------------------------------------------------------------------
// Initial state
// -----------------------------------------------------------------------------

renderConfig(currentAlgorithm);
clearResults();
fetchStatus();
