const TILE_SIZE = 32;
const GRAVITY = 0.8;
const JUMP_VELOCITY = -12;
const WALK_SPEED = 3;
const RUN_SPEED = 5;
const MAX_FALL_SPEED = 16;

const game = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  levelWidth: 0,
  levelHeight: 0,
  tiles: {},
  enemies: [],
  spawn: { x: 32, y: 32 },
  player: {
    x: 32,
    y: 32,
    width: 24,
    height: 30,
    velX: 0,
    velY: 0,
    onGround: false
  },
  keys: {
    left: false,
    right: false,
    jump: false,
    run: false
  },
  camera: {
    x: 0,
    y: 0
  }
};

function initGame() {
  game.canvas = document.getElementById('gameCanvas');
  game.ctx = game.canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  setupControls();
  setupBackButton();

  loadLevelFromSource().then((loaded) => {
    if (!loaded) {
      showError('Unable to load level.');
      return;
    }
    requestAnimationFrame(gameLoop);
  });
}

function resizeCanvas() {
  const container = document.querySelector('.game-container');
  game.canvas.width = container.clientWidth;
  game.canvas.height = container.clientHeight;
  game.width = game.canvas.width;
  game.height = game.canvas.height;
}

function setupControls() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') game.keys.left = true;
    if (e.code === 'ArrowRight') game.keys.right = true;
    if (e.code === 'KeyX') game.keys.jump = true;
    if (e.code === 'KeyZ') game.keys.run = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') game.keys.left = false;
    if (e.code === 'ArrowRight') game.keys.right = false;
    if (e.code === 'KeyX') game.keys.jump = false;
    if (e.code === 'KeyZ') game.keys.run = false;
  });
}

function setupBackButton() {
  const backBtn = document.getElementById('backToEditorBtn');
  const urlParams = new URLSearchParams(window.location.search);
  const levelId = urlParams.get('id');
  const fromEditor = urlParams.get('from') === 'editor';

  backBtn.addEventListener('click', () => {
    if (fromEditor) {
      const target = levelId ? `editor.html?id=${levelId}` : 'editor.html';
      window.location.href = target;
    } else {
      window.history.back();
    }
  });
}

async function loadLevelFromSource() {
  const urlParams = new URLSearchParams(window.location.search);
  const levelId = urlParams.get('id');
  const source = urlParams.get('source');

  if (source === 'session') {
    const data = sessionStorage.getItem('testLevelData');
    if (!data) return false;
    const levelData = JSON.parse(data);
    applyLevelData({ title: 'Test Level', level_data: levelData });
    return true;
  }

  if (levelId) {
    if (String(levelId).startsWith('local-')) {
      const localData = localStorage.getItem(`levelDraft-${levelId}`);
      if (!localData) return false;
      const levelData = JSON.parse(localData);
      applyLevelData({ title: 'Local Draft', level_data: levelData });
      return true;
    }

    try {
      const response = await fetch(`/api/levels/${levelId}`);
      if (!response.ok) return false;
      const level = await response.json();
      applyLevelData(level);
      return true;
    } catch (err) {
      console.error('Error loading level:', err);
      return false;
    }
  }

  return false;
}

function applyLevelData(level) {
  const titleEl = document.getElementById('gameTitle');
  titleEl.textContent = level.title || 'Level';

  const levelData = level.level_data || {};
  game.levelWidth = levelData.width || 50;
  game.levelHeight = levelData.height || 20;
  game.tiles = levelData.tiles || {};

  game.enemies = [];
  game.spawn = { x: TILE_SIZE, y: TILE_SIZE };

  Object.entries(game.tiles).forEach(([key, type]) => {
    const [x, y] = key.split(',').map(Number);
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;

    if (type === 'spawn') {
      game.spawn = { x: px, y: py };
    }

    if (type === 'enemy') {
      game.enemies.push({
        x: px,
        y: py,
        width: 26,
        height: 26,
        velX: 1.2,
        direction: 1,
        active: false
      });
    }
  });

  resetPlayer();
}

function resetPlayer() {
  game.player.x = game.spawn.x + 4;
  game.player.y = game.spawn.y + 2;
  game.player.velX = 0;
  game.player.velY = 0;
  game.player.onGround = false;
}

let lastTime = 0;
const TIMESTEP = 1000 / 60;
let accumulator = 0;

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  accumulator += deltaTime;
  
  // Prevent spiral of death
  if (accumulator > 200) accumulator = 200;

  while (accumulator >= TIMESTEP) {
    update();
    accumulator -= TIMESTEP;
  }
  
  render();
  requestAnimationFrame(gameLoop);
}

function update() {
  updatePlayer();
  updateEnemies();
  checkPlayerHazards();
  updateCamera();
}

function updatePlayer() {
  const player = game.player;
  const speed = game.keys.run ? RUN_SPEED : WALK_SPEED;

  if (game.keys.left) {
    player.velX = -speed;
  } else if (game.keys.right) {
    player.velX = speed;
  } else {
    player.velX = 0;
  }

  if (game.keys.jump && player.onGround) {
    player.velY = JUMP_VELOCITY;
    player.onGround = false;
  }

  player.velY = Math.min(player.velY + GRAVITY, MAX_FALL_SPEED);

  movePlayer(player.velX, 0);
  movePlayer(0, player.velY);
}

function movePlayer(dx, dy) {
  const player = game.player;
  player.x += dx;

  const collisionsX = getCollidingTiles(player);
  collisionsX.forEach((tile) => {
    if (!isSolidTile(tile.type)) return;
    if (dx > 0) {
      player.x = tile.x - player.width;
    } else if (dx < 0) {
      player.x = tile.x + TILE_SIZE;
    }
  });

  player.y += dy;
  player.onGround = false;

  const collisionsY = getCollidingTiles(player);
  collisionsY.forEach((tile) => {
    if (!isSolidTile(tile.type)) return;
    if (dy > 0) {
      player.y = tile.y - player.height;
      player.velY = 0;
      player.onGround = true;
    } else if (dy < 0) {
      player.y = tile.y + TILE_SIZE;
      player.velY = 0;
    }
  });
}

function updateEnemies() {
  const view = {
    left: game.camera.x - 64,
    right: game.camera.x + game.width + 64,
    top: game.camera.y - 64,
    bottom: game.camera.y + game.height + 64
  };

  game.enemies.forEach((enemy) => {
    const inView = enemy.x + enemy.width > view.left && enemy.x < view.right && enemy.y + enemy.height > view.top && enemy.y < view.bottom;
    if (!enemy.active && inView) {
      enemy.active = true;
    }
    if (!enemy.active) return;

    enemy.x += enemy.velX * enemy.direction;

    const enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
    const collisions = getCollidingTiles(enemyBox).filter((tile) => isSolidTile(tile.type));
    if (collisions.length) {
      enemy.direction *= -1;
      enemy.x += enemy.velX * enemy.direction;
      return;
    }

    const frontX = enemy.direction > 0 ? enemy.x + enemy.width : enemy.x - 1;
    const footY = enemy.y + enemy.height + 1;
    if (!isSolidAt(frontX, footY)) {
      enemy.direction *= -1;
    }
  });
}

function checkPlayerHazards() {
  const player = game.player;

  const nearbyTiles = getCollidingTiles(player, true);
  const hitSpike = nearbyTiles.some((tile) => tile.type === 'spike' && rectsIntersect(player, tile));
  if (hitSpike) {
    resetPlayer();
    return;
  }

  const hitEnemy = game.enemies.some((enemy) => rectsIntersect(player, enemy));
  if (hitEnemy) {
    resetPlayer();
  }
}

function updateCamera() {
  const maxX = Math.max(0, game.levelWidth * TILE_SIZE - game.width);
  const maxY = Math.max(0, game.levelHeight * TILE_SIZE - game.height);

  game.camera.x = clamp(game.player.x + game.player.width / 2 - game.width / 2, 0, maxX);
  game.camera.y = clamp(game.player.y + game.player.height / 2 - game.height / 2, 0, maxY);
}

function render() {
  const ctx = game.ctx;
  ctx.clearRect(0, 0, game.width, game.height);

  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(0, 0, game.width, game.height);

  renderTiles();
  renderEnemies();
  renderPlayer();
  // Grid removed
}

function renderTiles() {
  const ctx = game.ctx;
  const startX = Math.max(0, Math.floor(game.camera.x / TILE_SIZE));
  const startY = Math.max(0, Math.floor(game.camera.y / TILE_SIZE));
  const endX = Math.min(game.levelWidth, Math.ceil((game.camera.x + game.width) / TILE_SIZE));
  const endY = Math.min(game.levelHeight, Math.ceil((game.camera.y + game.height) / TILE_SIZE));

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const key = `${x},${y}`;
      const type = game.tiles[key];
      // Skip spawn and enemy (enemies are rendered separately)
      if (!type || type === 'spawn' || type === 'enemy') continue;

      const screenX = x * TILE_SIZE - game.camera.x;
      const screenY = y * TILE_SIZE - game.camera.y;

      drawTile(ctx, type, screenX, screenY, TILE_SIZE);
    }
  }
}

function renderEnemies() {
  const ctx = game.ctx;
  game.enemies.forEach((enemy) => {
    const screenX = enemy.x - game.camera.x;
    const screenY = enemy.y - game.camera.y;
    // Draw enemy using shared graphics
    // Adjust position if needed, but for now drawing at top-left of hitbox
    drawTile(ctx, 'enemy', screenX, screenY, TILE_SIZE);
  });
}

function renderPlayer() {
  const ctx = game.ctx;
  const screenX = game.player.x - game.camera.x;
  const screenY = game.player.y - game.camera.y;
  ctx.fillStyle = '#212121';
  ctx.fillRect(screenX, screenY, game.player.width, game.player.height);
}

function getCollidingTiles(entity, includeHazards = false) {
  const tiles = [];
  const minX = Math.max(0, Math.floor(entity.x / TILE_SIZE));
  const minY = Math.max(0, Math.floor(entity.y / TILE_SIZE));
  const maxX = Math.min(game.levelWidth - 1, Math.floor((entity.x + entity.width - 0.01) / TILE_SIZE));
  const maxY = Math.min(game.levelHeight - 1, Math.floor((entity.y + entity.height - 0.01) / TILE_SIZE));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const key = `${x},${y}`;
      const type = game.tiles[key];
      if (!type) continue;
      if (!includeHazards && !isSolidTile(type)) continue;
      tiles.push({ x: x * TILE_SIZE, y: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE, type });
    }
  }

  return tiles;
}

function isSolidTile(type) {
  return type === 'ground' || type === 'tile' || type === 'goal';
}

function isSolidAt(px, py) {
  const x = Math.floor(px / TILE_SIZE);
  const y = Math.floor(py / TILE_SIZE);
  const type = game.tiles[`${x},${y}`];
  return isSolidTile(type);
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function showError(message) {
  const ctx = game.ctx;
  ctx.clearRect(0, 0, game.width, game.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, game.width, game.height);
  ctx.fillStyle = '#ff6b6b';
  ctx.font = '16px Roboto, sans-serif';
  ctx.fillText(message, 16, 32);
}

document.addEventListener('DOMContentLoaded', initGame);
