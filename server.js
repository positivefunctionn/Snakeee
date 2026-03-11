import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

import {
  addLeaderboardEntry,
  buildLeaderboardPayload,
  clearLeaderboard,
  readLeaderboard,
  sanitizeChallengeId
} from "./src/leaderboard-store.js";

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
const LEADERBOARD_FILE = join(ROOT, "data", "leaderboard.json");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function resolvePath(urlPath) {
  const cleanPath = urlPath === "/" ? "/index.html" : urlPath;
  const normalized = normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  return join(ROOT, normalized);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function handleApi(request, response, url) {
  if (url.pathname !== "/api/leaderboard") {
    sendJson(response, 404, { error: "Not found" });
    return true;
  }

  const challengeId = sanitizeChallengeId(url.searchParams.get("challenge"));

  if (request.method === "GET") {
    const entries = await readLeaderboard(LEADERBOARD_FILE);
    sendJson(response, 200, buildLeaderboardPayload(entries, challengeId));
    return true;
  }

  if (request.method === "POST") {
    try {
      const rawBody = await readRequestBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const nextLeaderboard = await addLeaderboardEntry(LEADERBOARD_FILE, {
        ...payload,
        challengeId: payload.challengeId ?? challengeId
      });
      sendJson(response, 201, nextLeaderboard);
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Invalid request" });
    }

    return true;
  }

  if (request.method === "DELETE") {
    const emptyLeaderboard = await clearLeaderboard(LEADERBOARD_FILE, challengeId);
    sendJson(response, 200, emptyLeaderboard);
    return true;
  }

  sendJson(response, 405, { error: "Method not allowed" });
  return true;
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    const filePath = resolvePath(url.pathname);
    const data = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath)] || "text/plain; charset=utf-8";

    response.writeHead(200, { "Content-Type": contentType });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(PORT, () => {
  console.log(`Snake game available at http://localhost:${PORT}`);
});
