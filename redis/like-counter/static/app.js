const likeBtn = document.getElementById("like");
const likeLabel = document.getElementById("like-label");
const likesEl = document.getElementById("likes");
const unsafeEl = document.getElementById("unsafe-likes");
const statusEl = document.getElementById("status");

const burstBtn = document.getElementById("burst");
const burstN = document.getElementById("burst-n");
const resetBtn = document.getElementById("reset");
const burstResult = document.getElementById("burst-result");
const statN = document.getElementById("stat-n");
const statGained = document.getElementById("stat-gained");
const statUnsafe = document.getElementById("stat-unsafe");
const statLost = document.getElementById("stat-lost");

let liked = false;

function render(counts) {
  likesEl.textContent = counts.likes.toLocaleString();
  unsafeEl.textContent = counts.unsafe_likes.toLocaleString();
}

async function call(path, options) {
  const response = await fetch(path, options);

  // Read as text first: an error page may not be JSON at all.
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

function setLiked(next) {
  liked = next;
  likeBtn.classList.toggle("is-liked", liked);
  likeBtn.setAttribute("aria-pressed", String(liked));
  likeBtn.querySelector(".heart").innerHTML = liked ? "&#9829;" : "&#9825;";
  likeLabel.textContent = liked ? "Liked" : "Like";
}

likeBtn.addEventListener("click", async () => {
  const next = !liked;
  likeBtn.disabled = true;
  try {
    const counts = await call(next ? "/api/like" : "/api/unlike", { method: "POST" });
    render(counts);
    setLiked(next);
    statusEl.textContent = next
      ? "INCR likes:post1 → " + counts.likes
      : "DECR likes:post1 → " + counts.likes;
  } catch (err) {
    statusEl.textContent = err.message || "Request failed.";
  } finally {
    // Always re-enable -- otherwise a failed request leaves the button stuck.
    likeBtn.disabled = false;
  }
});

burstBtn.addEventListener("click", async () => {
  const n = Number(burstN.value) || 100;
  burstBtn.disabled = true;
  burstBtn.textContent = "Firing...";
  statusEl.textContent = `Firing ${n} concurrent likes ...`;

  try {
    const payload = await call(`/api/simulate-burst?n=${n}`, { method: "POST" });
    render(payload.after);
    statN.textContent = payload.n.toLocaleString();
    statGained.textContent = "+" + payload.gained.toLocaleString();
    statUnsafe.textContent = "+" + payload.unsafe_gained.toLocaleString();
    statLost.textContent = payload.lost.toLocaleString();
    statLost.className = "stat-value " + (payload.lost === 0 ? "is-good" : "is-bad");
    statUnsafe.className = "stat-value " + (payload.unsafe_gained === payload.n ? "is-good" : "is-bad");
    burstResult.hidden = false;
    statusEl.textContent = `${payload.n} concurrent likes in ${payload.elapsed_ms} ms · atomic +${payload.gained}, unsafe +${payload.unsafe_gained}`;
  } catch (err) {
    statusEl.textContent = err.message || "Burst failed.";
  } finally {
    burstBtn.disabled = false;
    burstBtn.textContent = "Fire burst";
  }
});

resetBtn.addEventListener("click", async () => {
  resetBtn.disabled = true;
  try {
    render(await call("/api/reset", { method: "POST" }));
    setLiked(false);
    burstResult.hidden = true;
    statusEl.textContent = "Both keys deleted. Counters back to 0.";
  } catch (err) {
    statusEl.textContent = err.message || "Reset failed.";
  } finally {
    resetBtn.disabled = false;
  }
});

// Load the current counts on open, so a page refresh shows Redis's real state.
call("/api/likes")
  .then(render)
  .catch((err) => {
    statusEl.textContent = err.message || "Could not reach the server.";
  });
