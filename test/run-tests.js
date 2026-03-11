import assert from "node:assert/strict";

import {
  buildLeaderboardPayload,
  sanitizeChallengeId,
  sanitizeEntry,
  sortLeaderboard
} from "../src/leaderboard-store.js";
import {
  createInitialState,
  placeFood,
  queueDirection,
  stepGame
} from "../src/game.js";

const tests = [
  {
    name: "snake moves one cell in the queued direction",
    run() {
      const state = createInitialState({ rng: () => 0 });
      const next = stepGame(state, () => 0);

      assert.deepEqual(next.snake[0], { x: state.snake[0].x + 1, y: state.snake[0].y });
      assert.equal(next.score, 0);
      assert.equal(next.isGameOver, false);
    }
  },
  {
    name: "snake grows and score increments when it eats food",
    run() {
      const state = createInitialState({ rng: () => 0 });
      const food = { x: state.snake[0].x + 1, y: state.snake[0].y };
      const next = stepGame({ ...state, food }, () => 0);

      assert.equal(next.snake.length, state.snake.length + 1);
      assert.equal(next.score, 1);
      assert.notDeepEqual(next.food, food);
    }
  },
  {
    name: "snake hits the wall and ends the game",
    run() {
      const state = {
        ...createInitialState({ rng: () => 0 }),
        snake: [{ x: 15, y: 0 }],
        direction: "RIGHT",
        queuedDirection: "RIGHT",
        food: { x: 0, y: 0 }
      };

      const next = stepGame(state, () => 0);
      assert.equal(next.isGameOver, true);
    }
  },
  {
    name: "snake cannot reverse directly into itself",
    run() {
      const state = createInitialState({ rng: () => 0 });
      const next = queueDirection(state, "LEFT");

      assert.equal(next.queuedDirection, "RIGHT");
    }
  },
  {
    name: "self collision ends the game",
    run() {
      const state = {
        ...createInitialState({ rng: () => 0 }),
        snake: [
          { x: 5, y: 5 },
          { x: 5, y: 6 },
          { x: 4, y: 6 },
          { x: 4, y: 5 },
          { x: 4, y: 4 },
          { x: 5, y: 4 }
        ],
        direction: "UP",
        queuedDirection: "LEFT",
        food: { x: 0, y: 0 }
      };

      const next = stepGame(state, () => 0);
      assert.equal(next.isGameOver, true);
    }
  },
  {
    name: "food is placed only on empty cells",
    run() {
      const snake = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ];

      const food = placeFood(snake, 2, () => 0);
      assert.deepEqual(food, { x: 1, y: 1 });
    }
  },
  {
    name: "custom grid size builds a matching state",
    run() {
      const state = createInitialState({ gridSize: 12, rng: () => 0 });

      assert.equal(state.gridSize, 12);
      assert.equal(state.snake[0].x, 6);
      assert.equal(state.snake[0].y, 6);
      assert.ok(state.food.x >= 0 && state.food.x < 12);
      assert.ok(state.food.y >= 0 && state.food.y < 12);
    }
  },
  {
    name: "leaderboard entries are sanitized",
    run() {
      const entry = sanitizeEntry({ name: "  Beginner12345  ", score: 7, gridSize: 16, skin: "ocean", challengeId: "Room-1" });

      assert.equal(entry.name, "Beginner1234");
      assert.equal(entry.score, 7);
      assert.equal(entry.gridSize, 16);
      assert.equal(entry.skin, "ocean");
      assert.equal(entry.challengeId, "room-1");
      assert.ok(entry.createdAt);
    }
  },
  {
    name: "leaderboard rejects invalid scores",
    run() {
      assert.throws(() => sanitizeEntry({ name: "Player", score: 0, gridSize: 16, skin: "classic" }));
    }
  },
  {
    name: "challenge ids are normalized",
    run() {
      assert.equal(sanitizeChallengeId(" Room-42 "), "room-42");
      assert.equal(sanitizeChallengeId("***"), null);
    }
  },
  {
    name: "leaderboard keeps highest scores first inside one challenge",
    run() {
      const payload = buildLeaderboardPayload(
        sortLeaderboard([
          { name: "A", score: 5, gridSize: 16, skin: "classic", challengeId: "room-1", createdAt: "2026-03-10T10:00:00.000Z" },
          { name: "B", score: 9, gridSize: 16, skin: "ocean", challengeId: "room-1", createdAt: "2026-03-10T11:00:00.000Z" },
          { name: "C", score: 7, gridSize: 20, skin: "sunset", challengeId: "room-2", createdAt: "2026-03-10T12:00:00.000Z" }
        ]),
        "room-1"
      );

      assert.equal(payload.highScore, 9);
      assert.equal(payload.challengeId, "room-1");
      assert.deepEqual(payload.entries.map((entry) => entry.name), ["B", "A"]);
    }
  }
];

let passed = 0;

for (const test of tests) {
  try {
    test.run();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error) {
    console.error(`FAIL ${test.name}`);
    console.error(error);
    process.exit(1);
  }
}

console.log(`\n${passed}/${tests.length} tests passed.`);
