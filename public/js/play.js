const TILE_SIZE = 16;

// Physics constants (Scaled for 16px tiles)
const GRAVITY = 0.24;
const MAX_FALL_SPEED = 9;

// Movement constants
const PLAYER_SPEED = 4; // ~Half of 7.5
const GROUND_ACCELERATION = 0.3;
const AIR_ACCELERATION = 0.2;
const GROUND_FRICTION = 0.82;
const AIR_FRICTION = 0.94;
const TURN_MULTIPLIER = 1.8;

// Jump constants
const BASE_JUMP_VELOCITY = -5.8;
const SPEED_JUMP_BONUS = -1.5;
const JUMP_CUT_MULTIPLIER = 0.4;
const COYOTE_TIME = 8;
const JUMP_BUFFER = 6;

// Combat constants
const ATTACK_DURATION = 6;
const ATTACK_COOLDOWN = 14;
const ATTACK_RANGE = 12; // Adjusted range
const ATTACK_BOUNCE = 0.5;
const SPIKE_ATTACK_BOUNCE = 0.5;
const SPIKE_PERFECT_BONUS = 0.25;
const ATTACK_LUNGE_SPEED = 1.9;
const ATTACK_LUNGE_DOWN_SPEED = 1.3;
const ATTACK_LUNGE_DECAY = 0.86;
const DYNAMIC_BOUNCE_BONUS = 0.4;

// Wall jump constants
const WALL_SLIDE_SPEED = 1.5;
const WALL_JUMP_VELOCITY_X = 3.5;
const WALL_JUMP_VELOCITY_Y = -5.8;
const WALL_COYOTE_TIME = 6; // Frames of grace after leaving wall
const WALL_STICK_FRAMES = 3; // Brief stick to wall before sliding

// Death animation constants
const DEATH_DURATION = 60;
const DEATH_PAUSE_DURATION = 10;
const DEATH_RISE_DURATION = 3;
const DEATH_SPIN_SPEED = 0;

const game = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  levelWidth: 0,
  levelHeight: 0,
  tiles: {},
  levelData: null,
  enemies: [],
  spawn: { x: 32, y: 32 },
  player: {
    x: 32,
    y: 32,
    width: 16,
    height: 16,
    velX: 0,
    velY: 0,
    onGround: false,
    wasOnGround: false,
    dead: false,
    deathTimer: 0,
    deathVelY: 0,
    animFrame: 0,
    animTimer: 0,
    animState: 'idle',
    // Coyote time and jump buffer
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    // Wall jumping state
    touchingWallLeft: false,
    touchingWallRight: false,
    wallCoyoteTimer: 0,
    wallCoyoteDirection: 0, // -1 for left wall, 1 for right wall
    canWallJumpLeft: true,
    canWallJumpRight: true,
    wallStickTimer: 0,
    wasPressingWallLeft: false,
    wasPressingWallRight: false,
    // Variable jump
    isJumping: false,
    jumpHeld: false,
    // Attack state
    facing: 1,
    attackTimer: 0,
    attackCooldown: 0,
    attackDir: { x: 1, y: 0 },
    attackLungeVelX: 0,
    attackLungeVelY: 0
  },
  keys: {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    jumpPressed: false, // For detecting new jump press
    attack: false,
    attackPressed: false
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
  levelCompleted: false,
  assets: {
    playerWalk: null,
    playerJump: null,
    playerWallSlide: null,
    playerDie: null,
    playerIdle: null,
    spike: null,
    enemyWalk: null,
    tilesheet: null,
  }
};

function loadAssets() {
  return Promise.all([
    loadImage('graphics/player_walk.png').then(img => game.assets.playerWalk = img),
    loadImage('graphics/player_jump.png').then(img => game.assets.playerJump = img),
    loadImage('graphics/player_wall_slide.png').then(img => game.assets.playerWallSlide = img),
    loadImage('graphics/player_die.png').then(img => game.assets.playerDie = img),
    loadImage('graphics/player_idle.png').then(img => game.assets.playerIdle = img),
    loadImage('graphics/spike.png').then(img => game.assets.spike = img),
    loadImage('graphics/enemy1_walk.png').then(img => game.assets.enemyWalk = img),
    loadImage('graphics/tilesheet_1.png').then(img => {
      game.assets.tilesheet = img;
    }),
  ]);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load ${src}`);
      resolve(null);
    };
  });
}

function initGame() {
  game.canvas = document.getElementById('gameCanvas');
  game.ctx = game.canvas.getContext('2d');

  // Disable image smoothing for pixel art
  game.ctx.imageSmoothingEnabled = false;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  setupControls();
  setupBackButton();

  loadAssets().then(() => {
    loadLevelFromSource().then((loaded) => {
      if (!loaded) {
        showError('Unable to load level.');
        return;
      }
      requestAnimationFrame(gameLoop);
    });
  });
}

function resizeCanvas() {
  const container = document.querySelector('.game-container');
  // Set consistent vertical viewing area (e.g. 15 tiles height)
  // This scales the rendered area consistently regardless of window size
  // 15 tiles * 16px = 240px
  const TARGET_HEIGHT = 240; 
  const aspect = container.clientWidth / container.clientHeight;

  game.canvas.height = TARGET_HEIGHT;
  game.canvas.width = Math.ceil(TARGET_HEIGHT * aspect);

  game.width = game.canvas.width;
  game.height = game.canvas.height;
  
  // Re-disable smoothing after resize
  if (game.ctx) game.ctx.imageSmoothingEnabled = false;
}

function setupControls() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') game.keys.left = true;
    if (e.code === 'ArrowRight') game.keys.right = true;
    if (e.code === 'ArrowUp') {
      game.keys.up = true;
      if (!game.keys.jump) {
        game.keys.jumpPressed = true; // New press
      }
      game.keys.jump = true;
    }
    if (e.code === 'ArrowDown') game.keys.down = true;
    
    // Space for attack
    if (e.code === 'Space') {
      if (!game.keys.attack) {
        game.keys.attackPressed = true; // New attack press
      }
      game.keys.attack = true;
      // Prevent scrolling
      e.preventDefault(); 
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') game.keys.left = false;
    if (e.code === 'ArrowRight') game.keys.right = false;
    if (e.code === 'ArrowUp') {
      game.keys.up = false;
      game.keys.jump = false;
    }
    if (e.code === 'ArrowDown') game.keys.down = false;
    if (e.code === 'Space') game.keys.attack = false;
  });
}

function setupBackButton() {
  const backBtn = document.getElementById('backToEditorBtn');
  const urlParams = new URLSearchParams(window.location.search);
  const levelId = urlParams.get('id');
  const fromEditor = urlParams.get('from') === 'editor';
  const source = urlParams.get('source');

  // Only show the overlay button if testing from editor
  if (fromEditor || source === 'session') {
    backBtn.style.display = 'flex';
  }

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
  if (titleEl) {
    titleEl.textContent = level.title || 'Level';
  }

  game.levelData = level.level_data || {};
  resetLevelState();

  resetPlayer();
}

function resetLevelState() {
  const levelData = game.levelData || {};
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
        width: TILE_SIZE,
        height: TILE_SIZE,
        velX: 1.2,
        velY: 0,
        direction: 1,
        onGround: false,
        active: false
      });
    }
  });
}

function resetPlayer() {
  game.player.x = game.spawn.x; // Spawn is top-left
  game.player.y = game.spawn.y;
  game.player.velX = 0;
  game.player.velY = 0;
  game.player.onGround = false;
  game.player.wasOnGround = false;
  game.player.dead = false;

  // Clear all inputs on respawn
  game.keys.left = false;
  game.keys.right = false;
  game.keys.up = false;
  game.keys.down = false;
  game.keys.jump = false;
  game.keys.jumpPressed = false;
  game.keys.attack = false;
  game.keys.attackPressed = false;

  game.player.deathTimer = 0;
  game.player.deathVelY = 0;
  
  // Reset coyote time and jump buffer
  game.player.coyoteTimer = 0;
  game.player.jumpBufferTimer = 0;
  
  // Reset wall jump state
  game.player.touchingWallLeft = false;
  game.player.touchingWallRight = false;
  game.player.wallCoyoteTimer = 0;
  game.player.wallCoyoteDirection = 0;
  game.player.canWallJumpLeft = true;
  game.player.canWallJumpRight = true;
  game.player.wallStickTimer = 0;
  game.player.wasPressingWallLeft = false;
  game.player.wasPressingWallRight = false;
  
  // Reset variable jump state
  game.player.isJumping = false;
  game.player.jumpHeld = false;
  game.player.facing = 1;
  game.player.attackTimer = 0;
  game.player.attackCooldown = 0;
  game.player.attackDir = { x: 1, y: 0 };
  game.player.attackLungeVelX = 0;
  game.player.attackLungeVelY = 0;
  
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
  handleAttack();
  checkPlayerHazards();
  checkGoalCollision();
  updateCamera();
}

function updatePlayer() {
  const player = game.player;
  const maxSpeed = PLAYER_SPEED;

  // Start timer on first input
  if (!game.timer.started && (game.keys.left || game.keys.right || game.keys.jump)) {
    game.timer.started = true;
    game.timer.startTime = performance.now();
  }

  // Track previous ground state for coyote time
  player.wasOnGround = player.onGround;

  // Detect walls before movement
  detectWalls(player);

  // Handle horizontal movement with acceleration and friction
  updateHorizontalMovement(player, maxSpeed);

  // Update coyote timers
  updateCoyoteTimers(player);

  // Handle jump buffer
  if (game.keys.jumpPressed) {
    player.jumpBufferTimer = JUMP_BUFFER;
    game.keys.jumpPressed = false;
  }
  if (player.jumpBufferTimer > 0) {
    player.jumpBufferTimer--;
  }

  // Handle jumping (ground jump, coyote jump, wall jump)
  handleJumping(player, maxSpeed);

  // Variable jump height - cut jump short when releasing
  if (player.isJumping && !game.keys.jump && player.velY < 0) {
    player.velY *= JUMP_CUT_MULTIPLIER;
    player.isJumping = false;
  }

  // Track if jump is held
  player.jumpHeld = game.keys.jump;

  // Handle wall sliding
  handleWallSlide(player);
  
  // Track wall press state for next frame's coyote logic
  player.wasPressingWallLeft = game.keys.left && player.touchingWallLeft;
  player.wasPressingWallRight = game.keys.right && player.touchingWallRight;

  // Apply gravity
  player.velY = Math.min(player.velY + GRAVITY, MAX_FALL_SPEED);

  // Move player with collision detection
  movePlayerX(player.velX);
  movePlayerY(player.velY);

  // Reset wall jump ability when landing
  if (player.onGround) {
    player.canWallJumpLeft = true;
    player.canWallJumpRight = true;
    player.wallStickTimer = 0;
  }
}

// Helper functions for improved readability
function isWallAtX(x, topY, midY, bottomY) {
  return isSolidAt(x, topY) || isSolidAt(x, midY) || isSolidAt(x, bottomY);
}

function isPlayerTurning(inputDir, velX) {
  return (inputDir > 0 && velX < 0) || (inputDir < 0 && velX > 0);
}

function canPerformLeftWallJump(player) {
  const touchingOrCoyote = player.touchingWallLeft || 
    (player.wallCoyoteTimer > 0 && player.wallCoyoteDirection === -1);
  return touchingOrCoyote && player.canWallJumpLeft;
}

function canPerformRightWallJump(player) {
  const touchingOrCoyote = player.touchingWallRight || 
    (player.wallCoyoteTimer > 0 && player.wallCoyoteDirection === 1);
  return touchingOrCoyote && player.canWallJumpRight;
}

function isPlayerSlidingOnWall(player) {
  return (player.touchingWallLeft && game.keys.left) || 
         (player.touchingWallRight && game.keys.right);
}

function detectWalls(player) {
  // Store previous wall state
  const wasTouchingLeft = player.touchingWallLeft;
  const wasTouchingRight = player.touchingWallRight;

  player.touchingWallLeft = false;
  player.touchingWallRight = false;

  if (player.onGround) return; // Don't detect walls when grounded

  // Calculate check positions
  const leftCheckX = player.x - 1;
  const rightCheckX = player.x + player.width + 1;
  const topY = player.y + 2;
  const midY = player.y + player.height / 2;
  const bottomY = player.y + player.height - 2;

  // Check for walls on each side
  player.touchingWallLeft = isWallAtX(leftCheckX, topY, midY, bottomY);
  player.touchingWallRight = isWallAtX(rightCheckX, topY, midY, bottomY);

  // Update wall coyote time
  // ONLY grant coyote time if we were actively pressing against the wall (sliding)
  if (wasTouchingLeft && !player.touchingWallLeft && !player.onGround && player.wasPressingWallLeft) {
    player.wallCoyoteTimer = WALL_COYOTE_TIME;
    player.wallCoyoteDirection = -1;
  }
  if (wasTouchingRight && !player.touchingWallRight && !player.onGround && player.wasPressingWallRight) {
    player.wallCoyoteTimer = WALL_COYOTE_TIME;
    player.wallCoyoteDirection = 1;
  }

  // Reset wall jump ability when touching opposite wall
  if (player.touchingWallLeft) {
    player.canWallJumpRight = true;
  }
  if (player.touchingWallRight) {
    player.canWallJumpLeft = true;
  }
}

function updateHorizontalMovement(player, maxSpeed) {
  const onGround = player.onGround;
  const acceleration = onGround ? GROUND_ACCELERATION : AIR_ACCELERATION;
  const friction = onGround ? GROUND_FRICTION : AIR_FRICTION;

  let inputDir = 0;
  if (game.keys.left) inputDir = -1;
  if (game.keys.right) inputDir = 1;

  if (inputDir !== 0) {
    player.facing = inputDir;
    const turning = isPlayerTurning(inputDir, player.velX);
    const accel = turning ? acceleration * TURN_MULTIPLIER : acceleration;

    player.velX += inputDir * accel;

    // Clamp to max speed
    if (Math.abs(player.velX) > maxSpeed) {
      player.velX = Math.sign(player.velX) * maxSpeed;
    }
  } else {
    // Apply friction when no input
    player.velX *= friction;
    if (Math.abs(player.velX) < 0.1) {
      player.velX = 0;
    }
  }
}

function getAttackBox(player) {
  const padding = 4;
  if (player.attackDir.y !== 0) {
    return {
      x: player.x + padding,
      y: player.attackDir.y > 0 ? player.y + player.height : player.y - ATTACK_RANGE,
      width: player.width - padding * 2,
      height: ATTACK_RANGE
    };
  }

  return {
    x: player.attackDir.x > 0 ? player.x + player.width : player.x - ATTACK_RANGE,
    y: player.y + padding,
    width: ATTACK_RANGE,
    height: player.height - padding * 2
  };
}

function handleAttack() {
  const player = game.player;

  if (player.attackCooldown > 0) player.attackCooldown--;
  if (player.attackTimer > 0) player.attackTimer--;

  if (game.keys.attackPressed && player.attackCooldown === 0) {
    let dirX = 0;
    let dirY = 0;

    if (game.keys.up) {
      dirY = -1;
    } else if (game.keys.down) {
      dirY = 1;
    } else if (game.keys.left) {
      dirX = -1;
    } else if (game.keys.right) {
      dirX = 1;
    } else {
      dirX = player.facing || 1;
    }

    player.attackDir = { x: dirX, y: dirY };
    player.attackTimer = ATTACK_DURATION;
    player.attackCooldown = ATTACK_COOLDOWN;

    if (dirY > 0) {
      if (!player.onGround) player.velY = ATTACK_LUNGE_DOWN_SPEED; // Override velocity
    } else if (dirY === 0) {
      player.velX = ATTACK_LUNGE_SPEED * dirX; // Set velocity directly for consistency
    }
  }
  game.keys.attackPressed = false;

  if (player.attackTimer <= 0) return;

  const hurtbox = getHurtbox(player);

  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    if (!rectsIntersect(hurtbox, enemy)) continue;

    game.enemies.splice(i, 1);

    if (player.attackDir.y > 0 && player.y + player.height <= enemy.y + enemy.height * 0.6) {
      // Calculate bounce based on distance (Tip of sword = higher bounce)
      // enemy.y - hurtbox.y is approx 0 for deep hit, 32 for max tip hit
      const dist = enemy.y - hurtbox.y; 
      
      // REQUIREMENT: Only bounce if hitting with the edge (bottom 40%)
      if (dist > hurtbox.height * 0.60) {
        const ratio = Math.max(0, Math.min(1, dist / (hurtbox.height * 0.8)));

        player.velY = BASE_JUMP_VELOCITY * (ATTACK_BOUNCE + (DYNAMIC_BOUNCE_BONUS * ratio));
        player.onGround = false;
        player.isJumping = false; 
      }
    }
  }

  if (player.attackDir.y > 0) {
    const nearbyTiles = getCollidingTiles(hurtbox, true);
    // Find the lowest spiked tile we are hitting (furthest away)
    let maxDist = -Infinity;
    let hitSpike = false;

    nearbyTiles.forEach(tile => {
      if (tile.type === 'spike' && rectsIntersect(hurtbox, tile)) {
        hitSpike = true;
        const d = tile.y - hurtbox.y;
        if (d > maxDist) maxDist = d;
      }
    });

    if (hitSpike) {
       // Deep hit (close to player) -> Small bounce
       // Tip hit (far from player) -> Big bounce
       
       // REQUIREMENT: Only bounce if hitting with the edge (bottom 40%)
       if (maxDist > hurtbox.height * 0.60) {
          const ratio = Math.max(0, Math.min(1, maxDist / (hurtbox.height * 0.8)));
          
          // If the ratio is very high (perfect spacing), add the extra bonus
          const extra = ratio > 0.9 ? SPIKE_PERFECT_BONUS : 0;
          
          player.velY = BASE_JUMP_VELOCITY * (SPIKE_ATTACK_BOUNCE + (DYNAMIC_BOUNCE_BONUS * ratio) + extra);
          player.onGround = false;
          player.isJumping = false;
       }
    }
  }
}

function updateCoyoteTimers(player) {
  // Ground coyote time
  if (player.wasOnGround && !player.onGround && player.velY >= 0) {
    // Just left ground (not from jumping)
    player.coyoteTimer = COYOTE_TIME;
  }
  if (player.coyoteTimer > 0) {
    player.coyoteTimer--;
  }

  // Wall coyote time
  if (player.wallCoyoteTimer > 0) {
    player.wallCoyoteTimer--;
  }
}

function handleJumping(player, maxSpeed) {
  const wantsToJump = player.jumpBufferTimer > 0 || game.keys.jumpPressed;
  
  if (!wantsToJump) return;

  // Ground jump (or coyote jump)
  const canGroundJump = player.onGround || player.coyoteTimer > 0;
  if (canGroundJump) {
    performGroundJump(player, maxSpeed);
    player.jumpBufferTimer = 0;
    player.coyoteTimer = 0;
    return;
  }

  // Wall jump
  const canWallJump = tryWallJump(player);
  if (canWallJump) {
    player.jumpBufferTimer = 0;
  }
}

function performGroundJump(player, maxSpeed) {
  // Calculate speed-based jump bonus
  const speedRatio = Math.abs(player.velX) / PLAYER_SPEED;
  const jumpBonus = SPEED_JUMP_BONUS * speedRatio;

  player.velY = BASE_JUMP_VELOCITY + jumpBonus;
  player.onGround = false;
  player.isJumping = true;
}

function tryWallJump(player) {
  if (canPerformLeftWallJump(player)) {
    // Wall is on left, jump to the right
    player.velX = WALL_JUMP_VELOCITY_X;
    player.velY = WALL_JUMP_VELOCITY_Y;
    player.canWallJumpLeft = false;
    player.isJumping = true;
    player.wallCoyoteTimer = 0;
    player.touchingWallLeft = false;
    return true;
  }

  if (canPerformRightWallJump(player)) {
    // Wall is on right, jump to the left
    player.velX = -WALL_JUMP_VELOCITY_X;
    player.velY = WALL_JUMP_VELOCITY_Y;
    player.canWallJumpRight = false;
    player.isJumping = true;
    player.wallCoyoteTimer = 0;
    player.touchingWallRight = false;
    return true;
  }

  return false;
}

function handleWallSlide(player) {
  if (player.onGround) {
    player.wallStickTimer = 0;
    return;
  }
  
  if (isPlayerSlidingOnWall(player) && player.velY > 0) {
    // Apply wall stick for a brief moment
    if (player.wallStickTimer < WALL_STICK_FRAMES) {
      player.wallStickTimer++;
      player.velY = 0;
    } else {
      // Slow descent while wall sliding
      if (player.velY > WALL_SLIDE_SPEED) {
        player.velY = WALL_SLIDE_SPEED;
      }
    }
  } else {
    player.wallStickTimer = 0;
  }
}

function movePlayerX(dx) {
  const player = game.player;
  player.x += dx;

  // Apply level bounds (left and right)
  player.x = Math.max(0, Math.min(player.x, game.levelWidth * TILE_SIZE - player.width));

  const collisionsX = getCollidingTiles(player);
  collisionsX.forEach((tile) => {
    if (!isSolidTile(tile.type)) return;
    if (dx > 0) {
      player.x = tile.x - player.width;
      player.velX = 0;
    } else if (dx < 0) {
      player.x = tile.x + TILE_SIZE;
      player.velX = 0;
    }
  });
}

function movePlayerY(dy) {
  const player = game.player;
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
      player.isJumping = false; // Hit ceiling, stop variable jump
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

    enemy.onGround = false;
    enemy.velY = Math.min(enemy.velY + GRAVITY, MAX_FALL_SPEED);

    // Horizontal movement
    enemy.x += enemy.velX * enemy.direction;

    let enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
    const collisionsX = getCollidingTiles(enemyBox).filter((tile) => isSolidTile(tile.type));
    if (collisionsX.length) {
      enemy.direction *= -1;
      enemy.x += enemy.velX * enemy.direction;
    }

    // Vertical movement
    enemy.y += enemy.velY;
    enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
    const collisionsY = getCollidingTiles(enemyBox).filter((tile) => isSolidTile(tile.type));
    collisionsY.forEach((tile) => {
      if (enemy.velY > 0) {
        enemy.y = tile.y - enemy.height;
        enemy.velY = 0;
        enemy.onGround = true;
      } else if (enemy.velY < 0) {
        enemy.y = tile.y + TILE_SIZE;
        enemy.velY = 0;
      }
    });

    // Edge detection (only when grounded)
    if (enemy.onGround) {
      const frontX = enemy.direction > 0 ? enemy.x + enemy.width : enemy.x - 1;
      const footY = enemy.y + enemy.height + 1;
      if (!isSolidAt(frontX, footY)) {
        enemy.direction *= -1;
      }
    }
  });
}

function updateDeathAnimation() {
  const player = game.player;
  
  player.deathTimer++;
  
  if (player.deathTimer <= DEATH_PAUSE_DURATION) {
    // Pause phase - freeze in place
    player.velX = 0;
    player.velY = 0;
  } else if (player.deathTimer <= DEATH_PAUSE_DURATION + DEATH_RISE_DURATION) {
    // Rise up phase (Quick Pop)
    player.deathVelY = -8;
    player.y += player.deathVelY;
  } else {
    // Fall down phase
    player.deathVelY += GRAVITY * 1.5;
    player.y += player.deathVelY;
  }
  
  // Reset after animation completes
  if (player.deathTimer >= DEATH_DURATION) {
    resetLevelState();
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

  // Check enemy collisions (no stomp mechanic)
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    if (!rectsIntersect(player, enemy)) continue;
    killPlayer();
    return;
  }
}

function killPlayer() {
  game.player.dead = true;
  game.player.deathTimer = 0;
  game.player.deathVelY = 0;
  game.player.velX = 0;
  game.player.velY = 0;
  
  // Clear attack state
  game.player.attackTimer = 0;
  game.player.attackCooldown = 0;
}

function updateCamera() {
  // Don't update camera if dead
  if (game.player.dead) return;

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
  renderHurtbox();
  renderTimer();
  // Grid removed
}

function getHurtbox(player) {
  const size = TILE_SIZE;
  const baseX = player.x + player.width / 2 - size / 2;
  const baseY = player.y + player.height / 2 - size / 2;

  return {
    x: baseX + player.attackDir.x * size,
    y: baseY + player.attackDir.y * size,
    width: size,
    height: size
  };
}

function renderHurtbox() {
  if (game.player.attackTimer <= 0) return;
  const ctx = game.ctx;
  const hurtbox = getHurtbox(game.player);
  const screenX = hurtbox.x - game.camera.x;
  const screenY = hurtbox.y - game.camera.y;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(screenX, screenY, hurtbox.width, hurtbox.height);
  ctx.restore();
}

/**
 * Check if a tile at the given grid coordinates is solid (ground or tile).
 */
function isSolidTile(x, y) {
  const key = `${x},${y}`;
  const t = game.tiles[key];
  return t === 'ground' || t === 'tile';
}

/**
 * Get the autotile index for a tile based on its neighbors.
 * Uses a simple 4-neighbor system (top, right, bottom, left).
 * Returns an index from 0-15 that maps to the tilesheet.
 */
function getAutotileIndex(x, y) {
  let index = 0;
  
  // Check 4 cardinal directions
  if (isSolidTile(x, y - 1)) index |= 1;  // Top
  if (isSolidTile(x + 1, y)) index |= 2;  // Right
  if (isSolidTile(x, y + 1)) index |= 4;  // Bottom
  if (isSolidTile(x - 1, y)) index |= 8;  // Left
  
  return index;
}

/**
 * Render all tiles in the level.
 * Ground/tile blocks use autotiling, other tiles use simple sprites.
 */
function renderTiles() {
  const ctx = game.ctx;
  
  // Calculate visible tile range with 1-tile buffer for smooth scrolling
  const startX = Math.floor(game.camera.x / TILE_SIZE) - 1;
  const startY = Math.floor(game.camera.y / TILE_SIZE) - 1;
  const endX = Math.ceil((game.camera.x + game.width) / TILE_SIZE) + 1;
  const endY = Math.ceil((game.camera.y + game.height) / TILE_SIZE) + 1;

  const tilesheet = game.assets.tilesheet;
  const useTilesheet = tilesheet && tilesheet.width > 0;

  // First pass: render non-ground tiles (spikes, goals, coins, etc.)
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const type = game.tiles[`${x},${y}`];
      if (!type) continue;
      
      const screenX = x * TILE_SIZE - game.camera.x;
      const screenY = y * TILE_SIZE - game.camera.y;
      
      if (type === 'spike' && game.assets.spike) {
        drawTile(ctx, type, screenX, screenY, TILE_SIZE, 0, 0, game.assets.spike);
      } else if (type === 'goal' || type === 'coin' || type === 'diamond') {
        drawTile(ctx, type, screenX, screenY, TILE_SIZE);
      }
    }
  }

  // Second pass: render ground/tile blocks with autotiling
  for (const key of Object.keys(game.tiles)) {
    const type = game.tiles[key];
    if (type !== 'ground' && type !== 'tile') continue;

    const [x, y] = key.split(',').map(Number);
    const screenX = x * TILE_SIZE - game.camera.x;
    const screenY = y * TILE_SIZE - game.camera.y;

    // Skip if off-screen
    if (screenX < -TILE_SIZE || screenX > game.width ||
        screenY < -TILE_SIZE || screenY > game.height) continue;

    if (useTilesheet) {
      // Get the autotile index based on neighbors
      const tileIndex = getAutotileIndex(x, y);
      
      // Calculate position in tilesheet (4x4 grid of 16x16 tiles)
      const col = tileIndex % 4;
      const row = Math.floor(tileIndex / 4);
      const srcX = col * 16;
      const srcY = row * 16;
      
      // Draw the full 16x16 tile from the tilesheet
      ctx.drawImage(tilesheet, srcX, srcY, 16, 16, screenX, screenY, TILE_SIZE, TILE_SIZE);
    } else {
      // Fallback when tilesheet is not loaded
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
    }
  }
}

function renderEnemies() {
  const ctx = game.ctx;
  const frameRate = 12; // Animation speed for enemies

  game.enemies.forEach((enemy) => {
    // Only animate if active/close
    if (!enemy.active) return;
    
    // Use game timer as animation clock for all enemies to stay in sync (or give them individual timers if preferred)
    // For now simple sync is fine
    const frame = Math.floor(game.timer.currentTime / (1000/frameRate)) % 2; // Assuming 2 frames for walk
    
    const screenX = Math.round(enemy.x - game.camera.x);
    const screenY = Math.round(enemy.y - game.camera.y);
    
    if (game.assets.enemyWalk) {
        ctx.save();
        ctx.translate(screenX + enemy.width/2, screenY + enemy.height/2);
        
        // Sprite likely faces RIGHT by default.
        // If moving LEFT (-1), FLIP it.
        if (enemy.direction < 0) ctx.scale(-1, 1);
        
        // Draw 16x16 sprite
        // Offset by -8 to center
        ctx.drawImage(game.assets.enemyWalk, frame * 16, 0, 16, 16, -8, -8, 16, 16);
        ctx.restore();
    } else {
        // Fallback
        drawTile(ctx, 'enemy', screenX, screenY, TILE_SIZE);
    }
  });
}

function renderPlayer() {
  const ctx = game.ctx;
  const p = game.player;

  // Update Animation Timer
  p.animTimer++;

  let sprite = game.assets.playerWalk;
  let frame = 0;
  let flip = p.facing === -1;
  const frameRate = 10;

  if (p.dead) {
    sprite = game.assets.playerDie;
  } else if ((!p.onGround && ((p.touchingWallLeft && game.keys.left) || (p.touchingWallRight && game.keys.right))) || 
             p.wallStickTimer > 0 || 
             (p.wallCoyoteTimer > 0 && p.velY > 0)) {
     sprite = game.assets.playerWallSlide;
     // Face towards the wall if sliding/clinging
     if (p.touchingWallLeft || (p.wallCoyoteTimer > 0 && p.wallCoyoteDirection === -1)) flip = true;
     if (p.touchingWallRight || (p.wallCoyoteTimer > 0 && p.wallCoyoteDirection === 1)) flip = false;
  } else if (!p.onGround) {
    sprite = game.assets.playerJump;
    if (p.velY >= 0) frame = 1; // Fall
    else frame = 0; // Jump
  } else if (Math.abs(p.velX) > 0.1) {
    sprite = game.assets.playerWalk;
    // 3 frames loop
    const runFrameRate = 5; // Faster animation
    frame = Math.floor(p.animTimer / runFrameRate) % 3;
  } else {
    // Idle
    sprite = game.assets.playerIdle;
    const idleFrameRate = 40; // Slow animation
    frame = Math.floor(p.animTimer / idleFrameRate) % 2; 
  }

  const screenX = Math.round(p.x - game.camera.x);
  const screenY = Math.round(p.y - game.camera.y);

  if (sprite) {
    ctx.save();
    
    // Draw relative to player center (16x16 hitbox vs 16x16 sprite)
    // Center the sprite on the hitbox center.
    const cx = Math.floor(screenX + p.width / 2);
    const cy = Math.floor(screenY + p.height / 2);
    
    ctx.translate(cx, cy);
    if (flip) ctx.scale(-1, 1);
    
    // Draw centered 16x16 sprite
    // Offset by -8 to center 16px sprite on 0,0
    ctx.drawImage(sprite, frame * 16, 0, 16, 16, -8, -8, 16, 16);
    
    ctx.restore();
  } else {
    // Fallback if assets not loaded
    ctx.fillStyle = '#212121';
    ctx.fillRect(screenX, screenY, p.width, p.height);
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
  ctx.font = 'bold 12px Roboto, sans-serif'; // Reduced font size
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(timeString, game.width / 2 + 1, 16); // Shadow position
  ctx.fillStyle = '#ffffff';
  ctx.fillText(timeString, game.width / 2, 16); // Text position (same Y as shadow base, skewed X)
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
