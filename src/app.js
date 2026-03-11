import { createInitialState, queueDirection, stepGame, togglePause } from "./game.js";

const TICK_MS = 200;
const SETTINGS_KEY = "snake-settings";

const SKINS = {
  classic: {
    snake: "#355f2e",
    head: "#25471f",
    food: "#c94f3d"
  },
  ocean: {
    snake: "#2a6f97",
    head: "#16425b",
    food: "#ff7b54"
  },
  sunset: {
    snake: "#8f3b76",
    head: "#5f0f40",
    food: "#fb8b24"
  }
};

const board = document.querySelector("[data-board]");
const scoreValue = document.querySelector("[data-score]");
const highScoreValue = document.querySelector("[data-high-score]");
const roomLabel = document.querySelector("[data-room-label]");
const statusValue = document.querySelector("[data-status]");
const restartButton = document.querySelector("[data-restart]");
const pauseButton = document.querySelector("[data-pause]");
const inviteButton = document.querySelector("[data-invite]");
const clearBoardButton = document.querySelector("[data-clear-board]");
const skinSelect = document.querySelector("[data-skin]");
const gridSizeSelect = document.querySelector("[data-grid-size]");
const playerNameInput = document.querySelector("[data-player-name]");
const leaderboardList = document.querySelector("[data-leaderboard-list]");
const controls = document.querySelectorAll("[data-direction]");

let settings = loadSettings();
let highScore = 0;
let leaderboard = [];
let currentChallengeId = readChallengeId();
let state = createInitialState({ gridSize: settings.gridSize });
let cellElements = [];
let previousGameOver = false;

function loadSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      skin: parsed.skin && SKINS[parsed.skin] ? parsed.skin : "classic",
      gridSize: [12, 16, 20].includes(Number(parsed.gridSize)) ? Number(parsed.gridSize) : 16,
      playerName: typeof parsed.playerName === "string" && parsed.playerName.trim() ? parsed.playerName.trim().slice(0, 12) : "Player"
    };
  } catch {
    return { skin: "classic", gridSize: 16, playerName: "Player" };
  }
}

function saveSettings() {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function readChallengeId() {
  const params = new URLSearchParams(window.location.search);
  const value = (params.get("challenge") || "").trim().toLowerCase();
  return /^[a-z0-9-]{4,40}$/.test(value) ? value : null;
}

function createChallengeId() {
  const safeName = settings.playerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "player";
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${safeName}-${randomPart}`;
}

function getLeaderboardUrl() {
  const url = new URL("/api/leaderboard", window.location.origin);
  if (currentChallengeId) {
    url.searchParams.set("challenge", currentChallengeId);
  }
  return url.toString();
}

function updateRoomLabel() {
  roomLabel.textContent = currentChallengeId ? `Battle room: ${currentChallengeId}` : "Global leaderboard";
}

function applySkin() {
  const skin = SKINS[settings.skin];
  document.documentElement.style.setProperty("--snake", skin.snake);
  document.documentElement.style.setProperty("--snake-head", skin.head);
  document.documentElement.style.setProperty("--food", skin.food);
}

function syncInputs() {
  skinSelect.value = settings.skin;
  gridSizeSelect.value = String(settings.gridSize);
  playerNameInput.value = settings.playerName;
}

function buildBoard() {
  const totalCells = state.gridSize * state.gridSize;
  cellElements = [];
  board.innerHTML = "";
  board.style.setProperty("--grid-size", state.gridSize);

  for (let index = 0; index < totalCells; index += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    board.append(cell);
    cellElements.push(cell);
  }
}

function renderLeaderboard() {
  leaderboardList.innerHTML = "";

  if (leaderboard.length === 0) {
    const item = document.createElement("li");
    item.textContent = currentChallengeId ? "No scores in this battle yet" : "No scores yet";
    leaderboardList.append(item);
    return;
  }

  for (const entry of leaderboard) {
    const item = document.createElement("li");
    item.textContent = `${entry.name} - ${entry.score} (${entry.gridSize}x${entry.gridSize}, ${entry.skin})`;
    leaderboardList.append(item);
  }
}

function updateScores() {
  scoreValue.textContent = String(state.score);
  highScoreValue.textContent = String(highScore);
}

function setStatus(message) {
  statusValue.textContent = message;
}

function applyLeaderboardPayload(payload) {
  leaderboard = Array.isArray(payload.entries) ? payload.entries : [];
  highScore = Number(payload.highScore) || 0;
  currentChallengeId = payload.challengeId || currentChallengeId;
  updateRoomLabel();
  renderLeaderboard();
  updateScores();
}

async function fetchLeaderboard() {
  try {
    const response = await fetch(getLeaderboardUrl());
    if (!response.ok) {
      throw new Error("Unable to load leaderboard.");
    }

    applyLeaderboardPayload(await response.json());
  } catch {
    setStatus("Leaderboard offline");
    renderLeaderboard();
    updateScores();
  }
}

async function submitScore() {
  if (state.score <= 0) {
    return;
  }

  const entry = {
    name: settings.playerName,
    score: state.score,
    gridSize: state.gridSize,
    skin: settings.skin,
    challengeId: currentChallengeId
  };

  try {
    const response = await fetch(getLeaderboardUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(entry)
    });

    if (!response.ok) {
      throw new Error("Unable to save score.");
    }

    applyLeaderboardPayload(await response.json());
  } catch {
    setStatus("Score save failed");
  }
}

function render() {
  for (const cell of cellElements) {
    cell.className = "cell";
  }

  for (const segment of state.snake) {
    const index = segment.y * state.gridSize + segment.x;
    if (cellElements[index]) {
      cellElements[index].classList.add("cell-snake");
    }
  }

  const head = state.snake[0];
  const headIndex = head.y * state.gridSize + head.x;
  if (cellElements[headIndex]) {
    cellElements[headIndex].classList.add("cell-head");
  }

  if (state.food) {
    const foodIndex = state.food.y * state.gridSize + state.food.x;
    if (cellElements[foodIndex]) {
      cellElements[foodIndex].classList.add("cell-food");
    }
  }

  updateScores();

  if (state.isGameOver && !previousGameOver) {
    void submitScore();
  }

  previousGameOver = state.isGameOver;

  if (state.isGameOver) {
    setStatus("Game over");
    pauseButton.textContent = "Pause";
    pauseButton.disabled = true;
    return;
  }

  pauseButton.disabled = false;
  pauseButton.textContent = state.isPaused ? "Resume" : "Pause";
  setStatus(state.isPaused ? "Paused" : "Running");
}

function restartGame() {
  state = createInitialState({ gridSize: settings.gridSize });
  previousGameOver = false;
  buildBoard();
  render();
}

function tick() {
  state = stepGame(state);
  render();
}

function toggleGamePause() {
  state = togglePause(state);
  render();
}

function handleDirection(nextDirection) {
  state = queueDirection(state, nextDirection);
}

function updateSkin() {
  settings.skin = skinSelect.value;
  saveSettings();
  applySkin();
  renderLeaderboard();
}

function updateGridSize() {
  settings.gridSize = Number(gridSizeSelect.value);
  saveSettings();
  restartGame();
}

function updatePlayerName() {
  const nextName = playerNameInput.value.trim().slice(0, 12);
  settings.playerName = nextName || "Player";
  playerNameInput.value = settings.playerName;
  saveSettings();
}

async function inviteFriends() {
  if (!currentChallengeId) {
    currentChallengeId = createChallengeId();
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("challenge", currentChallengeId);
    window.history.replaceState({}, "", nextUrl);
    updateRoomLabel();
    await fetchLeaderboard();
  }

  const inviteUrl = new URL(window.location.href);
  inviteUrl.searchParams.set("challenge", currentChallengeId);
  const message = `${settings.playerName} invited you to a Snake battle. Join here: ${inviteUrl.toString()}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Snake battle invite",
        text: `${settings.playerName} invited you to a Snake battle`,
        url: inviteUrl.toString()
      });
      setStatus("Battle invite sent");
      return;
    }

    await navigator.clipboard.writeText(inviteUrl.toString());
    setStatus("Invite link copied");
  } catch {
    window.prompt("Copy this invite link", inviteUrl.toString());
    setStatus("Invite link ready");
  }
}

async function clearLeaderboard() {
  try {
    const response = await fetch(getLeaderboardUrl(), { method: "DELETE" });
    if (!response.ok) {
      throw new Error("Unable to clear leaderboard.");
    }

    applyLeaderboardPayload(await response.json());
    setStatus(currentChallengeId ? "Battle leaderboard cleared" : "Leaderboard cleared");
  } catch {
    setStatus("Clear failed");
  }
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();
  const keyMap = {
    arrowup: "UP",
    w: "UP",
    arrowdown: "DOWN",
    s: "DOWN",
    arrowleft: "LEFT",
    a: "LEFT",
    arrowright: "RIGHT",
    d: "RIGHT"
  };

  if (keyMap[key]) {
    event.preventDefault();
    handleDirection(keyMap[key]);
    return;
  }

  if (key === " " || key === "p") {
    event.preventDefault();
    toggleGamePause();
    return;
  }

  if (key === "enter" && state.isGameOver) {
    restartGame();
  }
}

applySkin();
syncInputs();
updateRoomLabel();
buildBoard();
renderLeaderboard();
render();
void fetchLeaderboard();
window.setInterval(tick, TICK_MS);

window.addEventListener("keydown", handleKeydown);
restartButton.addEventListener("click", restartGame);
pauseButton.addEventListener("click", toggleGamePause);
inviteButton.addEventListener("click", () => {
  void inviteFriends();
});
clearBoardButton.addEventListener("click", () => {
  void clearLeaderboard();
});
skinSelect.addEventListener("change", updateSkin);
gridSizeSelect.addEventListener("change", updateGridSize);
playerNameInput.addEventListener("change", updatePlayerName);
playerNameInput.addEventListener("blur", updatePlayerName);

for (const control of controls) {
  control.addEventListener("click", () => {
    handleDirection(control.dataset.direction);
  });
}
