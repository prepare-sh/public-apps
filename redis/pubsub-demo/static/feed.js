const badge = document.getElementById("badge");
const connectedAt = document.getElementById("connected-at");

const disconnectButton = document.getElementById("disconnect-button");
const reconnectButton = document.getElementById("reconnect-button");

const feed = document.getElementById("feed");
const toastLayer = document.getElementById("toast-layer");

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

let eventSource = null;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString();
  } catch (error) {
    return isoString;
  }
}

function setBadge(text, type) {
  badge.classList.remove("badge-connecting", "badge-live", "badge-offline");
  badge.classList.add(`badge-${type}`);

  badge.innerHTML = `<span class="badge-dot"></span>${text}`;
}

function clearFeedEmptyState() {
  const empty = feed.querySelector(".feed-empty");

  if (empty) {
    empty.remove();
  }
}

function addNotification(message, sentAt) {
  clearFeedEmptyState();

  const card = document.createElement("div");
  card.className = "notification";

  card.innerHTML = `
    <span class="notification-icon">&#9679;</span>
    <span class="notification-body">
      <span class="notification-message"></span>
      <span class="notification-time"></span>
    </span>
  `;

  card.querySelector(".notification-message").textContent = message;
  card.querySelector(".notification-time").textContent = formatTime(sentAt);

  feed.appendChild(card);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  toastLayer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3600);
}

// -----------------------------------------------------------------------------
// SSE connection
// -----------------------------------------------------------------------------

function connect() {
  setBadge("Connecting", "connecting");

  eventSource = new EventSource("/api/stream");

  eventSource.addEventListener("connected", (event) => {
    const data = JSON.parse(event.data);

    setBadge("Live", "live");

    connectedAt.textContent = formatTime(data.connected_at);
  });

  eventSource.addEventListener("notification", (event) => {
    const data = JSON.parse(event.data);

    addNotification(data.message, data.sent_at);
    showToast(data.message);
  });

  eventSource.onerror = () => {
    setBadge("Offline", "offline");
  };

  disconnectButton.hidden = false;
  reconnectButton.hidden = true;
}

function disconnect() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  setBadge("Offline", "offline");

  disconnectButton.hidden = true;
  reconnectButton.hidden = false;
}

// -----------------------------------------------------------------------------
// Controls
// -----------------------------------------------------------------------------

disconnectButton.addEventListener("click", disconnect);
reconnectButton.addEventListener("click", connect);

// -----------------------------------------------------------------------------
// Initial state
// -----------------------------------------------------------------------------

connect();
