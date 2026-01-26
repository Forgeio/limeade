const TILE_SIZE = 32;
const GRAVITY = 0.8;
const JUMP_VELOCITY = -12;
const JUMP_VELOCITY_SPEED_BOOST = -2; // Additional jump power at max speed
const WALK_SPEED = 5;
const RUN_SPEED = 8;
const MAX_FALL_SPEED = 16;
const ACCELERATION = 0.5;
const FRICTION = 0.85;
const AIR_FRICTION = 0.95;
const STOMP_THRESHOLD = 10; // pixels for stomp detection
const STOMP_BOUNCE = 0.5; // multiplier for bounce height when stomping
const DEATH_DURATION = 90; // frames (~1.5 seconds at 60fps)
const DEATH_RISE_DURATION = 30; // frames for rise phase
const DEATH_SPIN_SPEED = 4; // rotation multiplier

// Jump mechanics constants
const JUMP_RELEASE_MULTIPLIER = 0.5; // Multiplier for early jump release
const MIN_JUMP_VELOCITY = -4; // Minimum velocity when releasing jump early

// Coyote time constants (in frames)
const COYOTE_TIME = 6; // Grace period for jumping after leaving ground
const WALL_COYOTE_TIME = 6; // Grace period for wall jumping after leaving wall

// Wall jump constants
const WALL_JUMP_VELOCITY_X = 7; // Horizontal boost when wall jumping
const WALL_JUMP_VELOCITY_Y = -11; // Vertical velocity for wall jump
const WALL_SLIDE_SPEED = 2; // Max fall speed when sliding on wall

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
    onGround: false,
    onWall: 0, // -1 for left wall, 1 for right wall, 0 for no wall
    coyoteTimer: 0, // Frames since leaving ground
    wallCoyoteTimer: 0, // Frames since leaving wall
    wallJumpedLeft: false, // Has jumped from left wall
    wallJumpedRight: false, // Has jumped from right wall
    jumpPressed: false, // Track if jump button was just pressed
    dead: false,
    deathTimer: 0,
    deathVelY: 0
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
  },
  timer: {
    started: false,
    startTime: 0,
    currentTime: 0,
    finalTime: 0
  },
  levelCompleted: false
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
  game.player.onWall = 0;
  game.player.coyoteTimer = 0;
  game.player.wallCoyoteTimer = 0;
  game.player.wallJumpedLeft = false;
  game.player.wallJumpedRight = false;
  game.player.jumpPressed = false;
  game.player.dead = false;
  game.player.deathTimer = 0;
  game.player.deathVelY = 0;
  
  // Reset timer
  game.timer.started = false;
  game.timer.startTime = 0;
  game.timer.currentTime = 0;
  game.levelCompleted = false;
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
  // Update timer if started and not completed
  if (game.timer.started && !game.levelCompleted && !game.player.dead) {
    game.timer.currentTime = performance.now() - game.timer.startTime;
  }
  
  // Handle death animation
  if (game.player.dead) {
    updateDeathAnimation();
    updateCamera();
    return;
  }
  
  updatePlayer();
  updateEnemies();
  checkPlayerHazards();
  checkGoalCollision();
  updateCamera();
}

function updatePlayer() {
  const player = game.player;
  const maxSpeed = game.keys.run ? RUN_SPEED : WALK_SPEED;

  // Start timer on first input
  if (!game.timer.started && (game.keys.left || game.keys.right || game.keys.jump)) {
    game.timer.started = true;
    game.timer.startTime = performance.now();
  }

  // Track previous jump state for edge detection
  const wasJumpPressed = player.jumpPressed;
  player.jumpPressed = game.keys.jump;
  const jumpJustPressed = player.jumpPressed && !wasJumpPressed;

  // Update coyote timers
  if (!player.onGround) {
    player.coyoteTimer++;
  } else {
    player.coyoteTimer = 0;
  }

  if (player.onWall === 0) {
    player.wallCoyoteTimer++;
  } else {
    player.wallCoyoteTimer = 0;
  }

  // Apply horizontal acceleration
  if (game.keys.left) {
    player.velX -= ACCELERATION;
  } else if (game.keys.right) {
    player.velX += ACCELERATION;
  } else {
    // Apply friction when no input
    const friction = player.onGround ? FRICTION : AIR_FRICTION;
    player.velX *= friction;
    // Stop completely at low speeds
    if (Math.abs(player.velX) < 0.1) player.velX = 0;
  }

  // Clamp velocity to max speed
  player.velX = Math.max(-maxSpeed, Math.min(maxSpeed, player.velX));

  // Variable jump height - release jump early to jump lower
  if (!game.keys.jump && player.velY < 0) {
    player.velY = Math.max(player.velY * JUMP_RELEASE_MULTIPLIER, MIN_JUMP_VELOCITY);
  }

  // Ground jump with coyote time
  const canGroundJump = player.onGround || player.coyoteTimer < COYOTE_TIME;
  if (jumpJustPressed && canGroundJump && player.onWall === 0) {
    // Calculate jump velocity based on horizontal speed
    const speedRatio = Math.abs(player.velX) / maxSpeed;
    const jumpBoost = JUMP_VELOCITY_SPEED_BOOST * speedRatio;
    player.velY = JUMP_VELOCITY + jumpBoost;
    player.onGround = false;
    player.coyoteTimer = COYOTE_TIME; // Prevent double jump
    
    // Reset wall jump flags when jumping from ground
    player.wallJumpedLeft = false;
    player.wallJumpedRight = false;
  }

  // Wall jump mechanic
  const canWallJump = player.wallCoyoteTimer < WALL_COYOTE_TIME;
  if (jumpJustPressed && !canGroundJump && canWallJump && player.onWall !== 0) {
    // Check if we can wall jump from this side
    const onLeftWall = player.onWall === -1;
    const onRightWall = player.onWall === 1;
    
    if ((onLeftWall && !player.wallJumpedLeft) || (onRightWall && !player.wallJumpedRight)) {
      // Perform wall jump
      player.velY = WALL_JUMP_VELOCITY_Y;
      player.velX = player.onWall === -1 ? WALL_JUMP_VELOCITY_X : -WALL_JUMP_VELOCITY_X;
      
      // Mark this side as used
      if (onLeftWall) {
        player.wallJumpedLeft = true;
        player.wallJumpedRight = false; // Reset opposite side
      } else {
        player.wallJumpedRight = true;
        player.wallJumpedLeft = false; // Reset opposite side
      }
      
      player.wallCoyoteTimer = WALL_COYOTE_TIME; // Prevent immediate re-wall jump
    }
  }

  // Apply gravity with wall slide
  if (player.onWall !== 0 && player.velY > 0 && !player.onGround) {
    // Wall sliding - slower fall speed
    player.velY = Math.min(player.velY + GRAVITY, WALL_SLIDE_SPEED);
  } else {
    player.velY = Math.min(player.velY + GRAVITY, MAX_FALL_SPEED);
  }

  movePlayer(player.velX, 0);
  movePlayer(0, player.velY);
}

function movePlayer(dx, dy) {
  const player = game.player;
  player.x += dx;

  // Apply level bounds (left and right)
  player.x = Math.max(0, Math.min(player.x, game.levelWidth * TILE_SIZE - player.width));

  player.onWall = 0; // Reset wall state
  
  const collisionsX = getCollidingTiles(player);
  collisionsX.forEach((tile) => {
    if (!isSolidTile(tile.type)) return;
    if (dx > 0) {
      player.x = tile.x - player.width;
      player.onWall = 1; // Right wall
    } else if (dx < 0) {
      player.x = tile.x + TILE_SIZE;
      player.onWall = -1; // Left wall
    }
  });

  player.y += dy;
  
  // Apply top bound
  player.y = Math.max(0, player.y);
  
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

function checkGoalCollision() {
  if (game.levelCompleted) return;
  
  const player = game.player;
  const nearbyTiles = getCollidingTiles(player, true);
  const hitGoal = nearbyTiles.some((tile) => tile.type === 'goal' && rectsIntersect(player, tile));
  
  if (hitGoal) {
    game.levelCompleted = true;
    game.timer.finalTime = game.timer.currentTime;
    showLevelCompleteDialog();
  }
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

function updateDeathAnimation() {
  const player = game.player;
  
  player.deathTimer++;
  
  if (player.deathTimer <= DEATH_RISE_DURATION) {
    // Rise up phase
    player.deathVelY = -8;
    player.y += player.deathVelY;
  } else {
    // Fall down phase
    player.deathVelY += GRAVITY * 1.5;
    player.y += player.deathVelY;
  }
  
  // Reset after animation completes
  if (player.deathTimer >= DEATH_DURATION) {
    resetPlayer();
  }
}

function checkPlayerHazards() {
  const player = game.player;

  // Check bottom bound (kills player)
  const bottomBound = game.levelHeight * TILE_SIZE;
  if (player.y + player.height > bottomBound) {
    killPlayer();
    return;
  }

  // Check spike collisions
  const nearbyTiles = getCollidingTiles(player, true);
  const hitSpike = nearbyTiles.some((tile) => tile.type === 'spike' && rectsIntersect(player, tile));
  if (hitSpike) {
    killPlayer();
    return;
  }

  // Check enemy collisions with stomping
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    if (!rectsIntersect(player, enemy)) continue;
    
    // Check if player is stomping (coming from above)
    const isStomping = player.velY > 0 && 
                       player.y + player.height - STOMP_THRESHOLD < enemy.y + enemy.height / 2;
    
    if (isStomping) {
      // Kill enemy and bounce player
      game.enemies.splice(i, 1);
      player.velY = JUMP_VELOCITY * STOMP_BOUNCE; // Bounce based on constant
      player.onGround = false;
    } else {
      // Hit enemy from side - die
      killPlayer();
      return;
    }
  }
}

function killPlayer() {
  game.player.dead = true;
  game.player.deathTimer = 0;
  game.player.deathVelY = 0;
  game.player.velX = 0;
  game.player.velY = 0;
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
  renderTimer();
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
  
  if (game.player.dead) {
    // Draw death animation - rotate player
    ctx.save();
    ctx.translate(screenX + game.player.width / 2, screenY + game.player.height / 2);
    ctx.rotate((game.player.deathTimer / DEATH_DURATION) * Math.PI * DEATH_SPIN_SPEED); // Spin during death
    ctx.fillStyle = '#212121';
    ctx.fillRect(-game.player.width / 2, -game.player.height / 2, game.player.width, game.player.height);
    ctx.restore();
  } else {
    ctx.fillStyle = '#212121';
    ctx.fillRect(screenX, screenY, game.player.width, game.player.height);
  }
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

function renderTimer() {
  if (!game.timer.started && !game.levelCompleted) return;
  
  const ctx = game.ctx;
  const time = game.levelCompleted ? game.timer.finalTime : game.timer.currentTime;
  const seconds = Math.floor(time / 1000);
  const ms = Math.floor((time % 1000) / 10);
  const timeString = `${seconds}.${ms.toString().padStart(2, '0')}`;
  
  ctx.save();
  ctx.font = 'bold 24px Roboto, sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(timeString, 12, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(timeString, 10, 30);
  ctx.restore();
}

function showLevelCompleteDialog() {
  const urlParams = new URLSearchParams(window.location.search);
  const fromEditor = urlParams.get('from') === 'editor';
  const levelId = urlParams.get('id');
  
  if (fromEditor) {
    // Return to editor after short delay
    setTimeout(() => {
      const target = levelId ? `editor.html?id=${levelId}` : 'editor.html';
      window.location.href = target;
    }, 1500);
  } else {
    // Show completion dialog for played levels
    const seconds = Math.floor(game.timer.finalTime / 1000);
    const ms = Math.floor((game.timer.finalTime % 1000) / 10);
    const timeString = `${seconds}.${ms.toString().padStart(2, '0')}`;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 32px;
      border-radius: 8px;
      text-align: center;
      max-width: 400px;
    `;
    
    dialog.innerHTML = `
      <h2 style="margin: 0 0 16px 0; font-size: 32px; color: #51cf66;">Level Complete!</h2>
      <p style="font-size: 24px; margin: 16px 0; color: #212121;">Time: ${timeString}s</p>
      <button id="closeDialog" style="
        background: #51cf66;
        color: white;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        border-radius: 4px;
        cursor: pointer;
        font-family: Roboto, sans-serif;
      ">Close</button>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    document.getElementById('closeDialog').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
  }
}

document.addEventListener('DOMContentLoaded', initGame);
