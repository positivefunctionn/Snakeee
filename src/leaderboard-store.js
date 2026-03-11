import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const MAX_LEADERBOARD_ENTRIES = 10;
const VALID_GRIDS = new Set([12, 16, 20]);
const VALID_SKINS = new Set(["classic", "ocean", "sunset"]);
const CHALLENGE_PATTERN = /^[a-z0-9-]{4,40}$/i;

export function sanitizeChallengeId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const nextValue = value.trim().toLowerCase();
  return CHALLENGE_PATTERN.test(nextValue) ? nextValue : null;
}

export function sanitizeEntry(input) {
  const name = typeof input?.name === "string" ? input.name.trim().slice(0, 12) : "";
  const score = Number(input?.score);
  const gridSize = Number(input?.gridSize);
  const skin = typeof input?.skin === "string" ? input.skin : "classic";
  const challengeId = sanitizeChallengeId(input?.challengeId);

  if (!name) {
    throw new Error("Name is required.");
  }

  if (!Number.isInteger(score) || score < 1) {
    throw new Error("Score must be a positive integer.");
  }

  if (!VALID_GRIDS.has(gridSize)) {
    throw new Error("Grid size is invalid.");
  }

  if (!VALID_SKINS.has(skin)) {
    throw new Error("Skin is invalid.");
  }

  return {
    name,
    score,
    gridSize,
    skin,
    challengeId,
    createdAt: new Date().toISOString()
  };
}

export function sortLeaderboard(entries) {
  return [...entries]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return String(left.createdAt).localeCompare(String(right.createdAt));
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

export function filterLeaderboardByChallenge(entries, challengeId = null) {
  const normalizedChallengeId = sanitizeChallengeId(challengeId);
  return entries.filter((entry) => sanitizeChallengeId(entry.challengeId) === normalizedChallengeId);
}

export function buildLeaderboardPayload(entries, challengeId = null) {
  const normalizedChallengeId = sanitizeChallengeId(challengeId);
  const scopedEntries = filterLeaderboardByChallenge(entries, normalizedChallengeId);
  const sorted = sortLeaderboard(scopedEntries);

  return {
    challengeId: normalizedChallengeId,
    entries: sorted,
    highScore: sorted.length > 0 ? sorted[0].score : 0
  };
}

export async function readLeaderboard(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function writeLeaderboard(filePath, entries) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(entries, null, 2));
}

export async function addLeaderboardEntry(filePath, input) {
  const entries = await readLeaderboard(filePath);
  const nextEntry = sanitizeEntry(input);
  const nextEntries = [nextEntry, ...entries];
  await writeLeaderboard(filePath, nextEntries);
  return buildLeaderboardPayload(nextEntries, nextEntry.challengeId);
}

export async function clearLeaderboard(filePath, challengeId = null) {
  const entries = await readLeaderboard(filePath);
  const normalizedChallengeId = sanitizeChallengeId(challengeId);
  const remainingEntries = entries.filter((entry) => sanitizeChallengeId(entry.challengeId) !== normalizedChallengeId);
  await writeLeaderboard(filePath, normalizedChallengeId ? remainingEntries : []);
  return buildLeaderboardPayload(remainingEntries, normalizedChallengeId);
}
