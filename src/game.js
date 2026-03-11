export const DEFAULT_GRID_SIZE = 16;
export const INITIAL_DIRECTION = "RIGHT";

export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
};

export function createInitialSnake(gridSize = DEFAULT_GRID_SIZE) {
  const mid = Math.floor(gridSize / 2);
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid }
  ];
}

export function serializeCell(cell) {
  return `${cell.x},${cell.y}`;
}

export function randomInt(max, rng = Math.random) {
  return Math.floor(rng() * max);
}

export function placeFood(snake, gridSize = DEFAULT_GRID_SIZE, rng = Math.random) {
  const occupied = new Set(snake.map(serializeCell));
  const available = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const key = serializeCell({ x, y });
      if (!occupied.has(key)) {
        available.push({ x, y });
      }
    }
  }

  if (available.length === 0) {
    return null;
  }

  return available[randomInt(available.length, rng)];
}

export function createInitialState(options = {}) {
  const { gridSize = DEFAULT_GRID_SIZE, rng = Math.random } = options;
  const snake = createInitialSnake(gridSize);

  return {
    gridSize,
    snake,
    direction: INITIAL_DIRECTION,
    queuedDirection: INITIAL_DIRECTION,
    food: placeFood(snake, gridSize, rng),
    score: 0,
    isGameOver: false,
    isPaused: false
  };
}

export function isOppositeDirection(current, next) {
  return (
    (current === "UP" && next === "DOWN") ||
    (current === "DOWN" && next === "UP") ||
    (current === "LEFT" && next === "RIGHT") ||
    (current === "RIGHT" && next === "LEFT")
  );
}

export function queueDirection(state, nextDirection) {
  if (!DIRECTIONS[nextDirection]) {
    return state;
  }

  if (isOppositeDirection(state.direction, nextDirection) && state.snake.length > 1) {
    return state;
  }

  return { ...state, queuedDirection: nextDirection };
}

export function getNextHead(head, direction) {
  const delta = DIRECTIONS[direction];
  return {
    x: head.x + delta.x,
    y: head.y + delta.y
  };
}

export function stepGame(state, rng = Math.random) {
  if (state.isGameOver || state.isPaused) {
    return state;
  }

  const direction = state.queuedDirection;
  const nextHead = getNextHead(state.snake[0], direction);
  const hitsWall =
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= state.gridSize ||
    nextHead.y >= state.gridSize;

  if (hitsWall) {
    return { ...state, direction, isGameOver: true };
  }

  const willEat = state.food && nextHead.x === state.food.x && nextHead.y === state.food.y;
  const bodyToCheck = willEat ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);

  if (hitsSelf) {
    return { ...state, direction, isGameOver: true };
  }

  const nextSnake = [nextHead, ...state.snake];
  if (!willEat) {
    nextSnake.pop();
  }

  return {
    ...state,
    direction,
    snake: nextSnake,
    food: willEat ? placeFood(nextSnake, state.gridSize, rng) : state.food,
    score: willEat ? state.score + 1 : state.score
  };
}

export function togglePause(state) {
  if (state.isGameOver) {
    return state;
  }

  return { ...state, isPaused: !state.isPaused };
}
