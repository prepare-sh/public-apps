const leaderboard = document.getElementById("leaderboard");
const badge = document.getElementById("badge");
const toggle = document.getElementById("toggle");
const reset = document.getElementById("reset");

let paused = false;
let intervalId = null;
let previousRanks = {};

async function fetchLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");

    if (!response.ok) {
      throw new Error("Failed to fetch leaderboard");
    }

    const data = await response.json();

    renderLeaderboard(data.players);
  } catch (error) {
    console.error(error);

    badge.textContent = "ERROR";
    badge.className = "badge badge-error";
  }
}

async function tick() {
  if (paused) {
    return;
  }

  try {
    const response = await fetch("/api/tick", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to update leaderboard");
    }

    const data = await response.json();

    renderLeaderboard(data.players);
  } catch (error) {
    console.error(error);

    badge.textContent = "ERROR";
    badge.className = "badge badge-error";
  }
}

function renderLeaderboard(players) {
  leaderboard.innerHTML = players
    .map((player) => {
      const previousRank = previousRanks[player.player];

      let movement = "";

      if (previousRank !== undefined) {
        if (player.rank < previousRank) {
          movement = "rank-up";
        } else if (player.rank > previousRank) {
          movement = "rank-down";
        }
      }

      return `
        <div class="player ${movement}">
          <span class="rank">#${player.rank}</span>

          <span class="player-name">
            ${player.player}
          </span>

          <span class="score">
            ${player.score.toLocaleString()}
          </span>
        </div>
      `;
    })
    .join("");

  previousRanks = {};

  players.forEach((player) => {
    previousRanks[player.player] = player.rank;
  });
}

function updateStatus() {
  if (paused) {
    badge.textContent = "PAUSED";
    badge.className = "badge badge-paused";
    toggle.textContent = "Resume";
  } else {
    badge.textContent = "LIVE";
    badge.className = "badge badge-live";
    toggle.textContent = "Pause";
  }
}

function startSimulation() {
  if (intervalId !== null) {
    return;
  }

  intervalId = setInterval(tick, 1500);
}

function stopSimulation() {
  clearInterval(intervalId);
  intervalId = null;
}

function toggleSimulation() {
  paused = !paused;

  if (paused) {
    stopSimulation();
  } else {
    startSimulation();
    tick();
  }

  updateStatus();
}

async function resetLeaderboard() {
  try {
    reset.disabled = true;

    const response = await fetch("/api/reset", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to reset leaderboard");
    }

    previousRanks = {};

    await fetchLeaderboard();
  } catch (error) {
    console.error(error);
  } finally {
    reset.disabled = false;
  }
}

toggle.addEventListener("click", toggleSimulation);

reset.addEventListener("click", resetLeaderboard);

fetchLeaderboard();
startSimulation();
