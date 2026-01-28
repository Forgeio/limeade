const TILE_SIZE = 16;

// Physics constants
const GRAVITY = 0.25;
const MAX_FALL_SPEED = 7;

// Movement constants
const PLAYER_SPEED = 4; 
const GROUND_ACCELERATION = 0.3;
const AIR_ACCELERATION = 0.2;
const GROUND_FRICTION = 0.8;
const AIR_FRICTION = 0.9;
const TURN_MULTIPLIER = 1.8;

// Jump constants
const BASE_JUMP_VELOCITY = -7;
const BOUNCE_VELOCITY = -4;
const SPEED_JUMP_BONUS = 0;
const JUMP_CUT_MULTIPLIER = 0.4;
const COYOTE_TIME = 8;
const JUMP_BUFFER = 6;

// Combat constants
const ATTACK_DURATION = 6;
const ATTACK_COOLDOWN = 16;
const ATTACK_RANGE = 16;

// Wall jump constants
const WALL_SLIDE_SPEED = 1.5;
const WALL_JUMP_VELOCITY_X = 3;
const WALL_JUMP_VELOCITY_Y = -5;
const WALL_COYOTE_TIME = 4; // Frames of grace after leaving wall
const WALL_STICK_FRAMES = 2; // Brief stick to wall before sliding
const WALL_JUMP_COOLDOWN = 15; // Cooldown between wall jumps

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
    width: 14,
    height: 14,
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
    wallJumpCooldown: 0,
    wallStickTimer: 0,
    wasPressingWallLeft: false,
    wasPressingWallRight: false,
    // Variable jump
    isJumping: false,
    jumpHeld: false,
    // Attack state
    facing: 1,
    attackTimer: 0,
    attackAnimTimer: 0,
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
    playerPunch: null,
    spike: null,
    coin: null,
    token: null,
    enemyWalk: null,
    tilesheet: null,
    tilesheet2: null,
    timerFont: null,
    soundSwish: null,
    soundPunch: null,
    soundCoin: null,
    soundToken: null,
    soundJump: null,
    soundLand: null
  }
};

function loadAssets() {
  return Promise.all([
    loadImage('graphics/player_walk.png').then(img => game.assets.playerWalk = img),
    loadImage('graphics/player_jump.png').then(img => game.assets.playerJump = img),
    loadImage('graphics/player_wall_slide.png').then(img => game.assets.playerWallSlide = img),
    loadImage('graphics/player_die.png').then(img => game.assets.playerDie = img),
    loadImage('graphics/player_idle.png').then(img => game.assets.playerIdle = img),
    loadImage('graphics/player_hand_punch.png').then(img => game.assets.playerPunch = img),
    loadImage('graphics/spike.png').then(img => game.assets.spike = img),
    loadImage('graphics/coin.png').then(img => game.assets.coin = img),
    loadImage('graphics/token.png').then(img => game.assets.token = img),
    loadImage('graphics/enemy1_walk.png').then(img => game.assets.enemyWalk = img),
    loadImage('graphics/goal.png').then(img => game.assets.goal = img),
    loadImage('graphics/timer_font.png').then(img => game.assets.timerFont = img),
    loadImage('graphics/tilesheet_1.png').then(img => {
      game.assets.tilesheet = img;
    }),
    loadImage('graphics/tilesheet_2.png').then(img => {
      game.assets.tilesheet2 = img;
    }),
    loadAudio('sounds/swish.ogg').then(audio => game.assets.soundSwish = audio),
    loadAudio('sounds/punch.ogg').then(audio => game.assets.soundPunch = audio),
    loadAudio('sounds/coin.ogg').then(audio => game.assets.soundCoin = audio),
    loadAudio('sounds/token_get.ogg').then(audio => game.assets.soundToken = audio),
    loadAudio('sounds/jump.ogg').then(audio => game.assets.soundJump = audio),
    loadAudio('sounds/land.ogg').then(audio => game.assets.soundLand = audio),
  ]);
}

function loadAudio(src) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = src;
    audio.oncanplaythrough = () => resolve(audio);
    audio.onerror = () => {
        console.warn(`Failed to load audio ${src}`);
        resolve(null);
    };
    // Fallback for some browsers that don't fire canplaythrough immediately without interaction
    // Just resolving immediately for now to prevent hanging, audio won't play until loaded anyway
    setTimeout(() => resolve(audio), 100);
  });
}

function playSound(audio) {
  if (audio) {
    // Clone to ensure overlapping sounds play correctly
    const clone = audio.cloneNode();
    clone.volume = 0.4;
    clone.play().catch(e => console.log('Sound effect play failed', e));
  }
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

  // Ensure window has focus for key events
  window.focus();

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
  
  // Handle background music
  const newMusic = levelData.music;
  const newMusicPath = newMusic ? (newMusic.startsWith('http') ? newMusic : `/music/${newMusic}`) : null;

  if (newMusicPath) {
    // Only change music if it's different from what's playing
    if (!game.bgm || game.currentMusicPath !== newMusicPath) {
      if (game.bgm) {
        game.bgm.pause();
      }
      
      game.bgm = new Audio(newMusicPath);
      game.bgm.loop = true;
      game.bgm.volume = 0.5;
      game.currentMusicPath = newMusicPath;
      
      const playPromise = game.bgm.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log('Audio autoplay prevented:', e);
          // Add a one-time click listener to start music if autoplay failed
          const startAudio = () => {
            if (game.bgm && game.bgm.paused) {
              game.bgm.play().then(() => {
                // Remove listeners only after successful play
                document.removeEventListener('click', startAudio);
                document.removeEventListener('keydown', startAudio);
              }).catch(e => console.log('Retry play failed', e));
            } else {
               // Already playing or stopped
               document.removeEventListener('click', startAudio);
               document.removeEventListener('keydown', startAudio);
            }
          };
          document.addEventListener('click', startAudio);
          document.addEventListener('keydown', startAudio);
        });
      }
    } else {
        // Music is already playing and matches, ensure it's actually playing
        if (game.bgm && game.bgm.paused) {
             game.bgm.play().catch(e => console.log('Resume failed:', e));
        }
    }
  } else {
    // No music requested, stop current if exists
    if (game.bgm) {
      game.bgm.pause();
      game.bgm = null;
      game.currentMusicPath = null;
    }
  }

  game.levelWidth = levelData.width || 50;
  game.levelHeight = levelData.height || 20;
  game.tiles = levelData.tiles || {};
  game.animTime = 0;

  game.enemies = [];
  game.collectedCoins = new Set(); // Track collected coins for animation
  game.coinAnims = []; // Active coin animations

  game.collectedTokens = new Set();
  game.tokenAnims = [];

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
        width: 14,
        height: 14,
        velX: 1.2,
        velY: 0,
        direction: -1,
        onGround: false,
        active: false,
        dead: false
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

  // Clear pulse inputs on respawn, but keep held inputs (left, right, jump hold) active
  // This allows seamless movement if keys are held during respawn
  game.keys.jumpPressed = false;
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
  game.player.wallJumpCooldown = 0;
  game.player.wallStickTimer = 0;
  game.player.wasPressingWallLeft = false;
  game.player.wasPressingWallRight = false;
  
  // Reset variable jump state
  game.player.isJumping = false;
  game.player.jumpHeld = false;
  game.player.facing = 1;
  game.player.attackTimer = 0;
  game.player.attackAnimTimer = 0;
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
  game.animTime = (game.animTime || 0) + TIMESTEP;

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
  updateCoins();
  handleAttack();
  checkPlayerHazards();
  checkGoalCollision();
  updateCamera();
}

function updateCoins() {
  const p = game.player;
  const cx = p.x + p.width/2;
  const cy = p.y + p.height/2;
  const radius = 16; // Pickup radius

  // Check for coin collection
  Object.entries(game.tiles).forEach(([key, type]) => {
     if (type === 'coin' && !game.collectedCoins.has(key)) {
         const [tx, ty] = key.split(',').map(Number);
         const tileX = tx * TILE_SIZE + TILE_SIZE/2;
         const tileY = ty * TILE_SIZE + TILE_SIZE/2;
         
         const dist = Math.abs(tileX - cx) + Math.abs(tileY - cy);
         if (dist < radius) {
             game.collectedCoins.add(key);
             playSound(game.assets.soundCoin);
             // Start collection animation
             game.coinAnims.push({
                 x: tx * TILE_SIZE,
                 y: ty * TILE_SIZE,
                 timer: 0
             });
         }
     } else if (type === 'diamond' && !game.collectedTokens.has(key)) { // Using existing 'diamond' type from map for tokens
         const [tx, ty] = key.split(',').map(Number);
         const tileX = tx * TILE_SIZE + TILE_SIZE/2;
         const tileY = ty * TILE_SIZE + TILE_SIZE/2;
         
         const dist = Math.abs(tileX - cx) + Math.abs(tileY - cy);
         if (dist < radius) {
             game.collectedTokens.add(key);
             playSound(game.assets.soundToken);
             // Start token animation
             game.tokenAnims.push({
                 x: tx * TILE_SIZE,
                 y: ty * TILE_SIZE,
                 timer: 0
             });
         }
     }
  });

  // Update animations
  for (let i = game.coinAnims.length - 1; i >= 0; i--) {
      game.coinAnims[i].timer++;
      // 3 frames of animation, maybe 5 ticks per frame = 15 ticks total
      if (game.coinAnims[i].timer > 15) {
          game.coinAnims.splice(i, 1);
      }
  }

  // Update token animations
  for (let i = game.tokenAnims.length - 1; i >= 0; i--) {
      game.tokenAnims[i].timer++;
      // Extended duration: 7 frames (28 ticks) + linger + fade (total 60)
      if (game.tokenAnims[i].timer > 60) {
          game.tokenAnims.splice(i, 1);
      }
  }
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

  if (player.wallJumpCooldown > 0) {
    player.wallJumpCooldown--;
  }

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
    // Don't reset wallJumpCooldown instantly, let it expire
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
  // Must be pressing into the wall (left key)
  return touchingOrCoyote && player.wallJumpCooldown === 0 && game.keys.left;
}

function canPerformRightWallJump(player) {
  const touchingOrCoyote = player.touchingWallRight || 
    (player.wallCoyoteTimer > 0 && player.wallCoyoteDirection === 1);
  // Must be pressing into the wall (right key)
  return touchingOrCoyote && player.wallJumpCooldown === 0 && game.keys.right;
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
  if (player.attackAnimTimer > 0) player.attackAnimTimer--;

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
    player.attackAnimTimer = ATTACK_DURATION; // Keep decoupled from hitbox logic
    player.attackCooldown = ATTACK_COOLDOWN;
    playSound(game.assets.soundSwish);
  }
  game.keys.attackPressed = false;

  if (player.attackTimer <= 0) return;

  const hurtbox = getHurtbox(player);
  
  // 0. Check Collectibles (Coins/Tokens) - pass through interaction
  const collectibles = getCollidingTiles(hurtbox, true).filter(t => t.type === 'coin' || t.type === 'diamond');
  collectibles.forEach(tile => {
    // Reconstruct key from tile coordinates (which come from x*TILE_SIZE)
    const tx = Math.round(tile.x / TILE_SIZE);
    const ty = Math.round(tile.y / TILE_SIZE);
    const key = `${tx},${ty}`;

    if (tile.type === 'coin' && !game.collectedCoins.has(key)) {
       game.collectedCoins.add(key);
       playSound(game.assets.soundCoin);
       game.coinAnims.push({ x: tile.x, y: tile.y, timer: 0 });
    } else if (tile.type === 'diamond' && !game.collectedTokens.has(key)) {
       game.collectedTokens.add(key);
       playSound(game.assets.soundToken);
       game.tokenAnims.push({ x: tile.x, y: tile.y, timer: 0 });
    }
  });

  // Consider the first two frames as "impact frames" for pogo purposes
  // logic executes frame 0 (timer=DURATION) and frame 1 (timer=DURATION-1)
  // ATTACK_DURATION usually 6. 
  // If timer started at 6, loop runs with 6, then 5. Impact needs to be checked on these logic frames.
  const isImpactFrame = player.attackTimer >= ATTACK_DURATION - 1;

  let hitData = null; // { type: 'enemy' | 'wall' | 'spike', obj: any, dist: number }
  const cx = player.x + player.width / 2;
  const cy = player.y + player.height / 2;

  // 1. Check Enemies
  for (const enemy of game.enemies) {
    if (rectsIntersect(hurtbox, enemy)) {
      const dist = Math.abs((enemy.x + enemy.width / 2) - cx) + Math.abs((enemy.y + enemy.height / 2) - cy);
      if (!hitData || dist < hitData.dist) {
        hitData = { type: 'enemy', obj: enemy, dist: dist };
      }
    }
  }

  // 2. Check Walls (Solid Blocks) & Spikes
  // Must pass true to includeHazards so spikes are returned by getCollidingTiles
  const walls = getCollidingTiles(hurtbox, true).filter(t => {
    if (isSolidTile(t.type)) return true;
    if (t.type === 'spike') return spikeIntersect(hurtbox, t);
    return false;
  });
  for (const wall of walls) {
    const dist = Math.abs((wall.x + wall.width / 2) - cx) + Math.abs((wall.y + wall.height / 2) - cy);
    if (!hitData || dist < hitData.dist) {
      // Correctly label the type so pogo logic works
      const hitType = wall.type === 'spike' ? 'spike' : 'wall';
      hitData = { type: hitType, obj: wall, dist: dist };
    }
  }

  // 3. Process Closest Hit
  if (hitData) {
    // End attack immediately on hit
    player.attackTimer = 0;
    playSound(game.assets.soundPunch);

    if (hitData.type === 'enemy') {
       const enemy = hitData.obj;
       if (!enemy.dead) {
         enemy.dead = true;
         // Small hop when killed, then gravity takes over in updateEnemies
         enemy.velY = -3;
         // Ensure they stay active for the death fall
         enemy.active = true;
       }
    }

    // Check pogo on suitable targets (Enemy or Spike ONLY)
    // We explicitly exclude 'wall' to prevent boosting off normal ground/walls
    const canPogo = hitData.type === 'enemy' || hitData.type === 'spike';
    if (canPogo && player.attackDir.y > 0 && isImpactFrame) {
         player.velY = BOUNCE_VELOCITY;
         player.onGround = false;
         player.isJumping = false;
    }

    return; // Stop processing frame
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
  playSound(game.assets.soundJump);
}

function tryWallJump(player) {
  if (canPerformLeftWallJump(player)) {
    // Wall is on left, jump to the right
    player.velX = WALL_JUMP_VELOCITY_X;
    player.velY = WALL_JUMP_VELOCITY_Y;
    player.wallJumpCooldown = WALL_JUMP_COOLDOWN;
    player.isJumping = true;
    player.wallCoyoteTimer = 0;
    player.touchingWallLeft = false;
    playSound(game.assets.soundJump);
    return true;
  }

  if (canPerformRightWallJump(player)) {
    // Wall is on right, jump to the left
    player.velX = -WALL_JUMP_VELOCITY_X;
    player.velY = WALL_JUMP_VELOCITY_Y;
    player.wallJumpCooldown = WALL_JUMP_COOLDOWN;
    player.isJumping = true;
    player.wallCoyoteTimer = 0;
    player.touchingWallRight = false;
    playSound(game.assets.soundJump);
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
  const wasOnGround = player.onGround;

  player.y += dy;
  
  // No top bound - player can go above level
  
  player.onGround = false;
  let landedThisFrame = false;

  const collisionsY = getCollidingTiles(player);
  collisionsY.forEach((tile) => {
    if (!isSolidTile(tile.type)) return;
    if (dy > 0) {
      player.y = tile.y - player.height;
      player.velY = 0;
      player.onGround = true;
      
      if (!landedThisFrame && !game.player.wasOnGround && dy > 1) { // Only play if falling with some speed
         playSound(game.assets.soundLand);
         landedThisFrame = true;
      }
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
    
    // Always process dead enemies (falling off screen)
    if (!enemy.active && !enemy.dead) return;

    if (enemy.dead) {
        enemy.velY = Math.min(enemy.velY + GRAVITY, MAX_FALL_SPEED);
        enemy.y += enemy.velY;
        return;
    }

    enemy.onGround = false;
    enemy.velY = Math.min(enemy.velY + GRAVITY, MAX_FALL_SPEED);

    // Horizontal movement
    enemy.x += enemy.velX * enemy.direction;

    let enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };

    // Check tiles (Solid AND Spikes)
    const collisionsX = getCollidingTiles(enemyBox, true).filter((tile) => {
        return isSolidTile(tile.type) || tile.type === 'spike';
    });
    
    // Check other enemies
    const hitEnemy = game.enemies.find(e => e !== enemy && e.active && !e.dead && rectsIntersect(enemyBox, e));

    if (collisionsX.length || hitEnemy) {
      enemy.direction *= -1;
      enemy.x += enemy.velX * enemy.direction;
    }

    // Vertical movement
    enemy.y += enemy.velY;
    enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
    // Enemies treat spikes as solid ground
    const collisionsY = getCollidingTiles(enemyBox, true).filter((tile) => isSolidTile(tile.type) || tile.type === 'spike');
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
      // Check if there is solid ground OR a spike at foot position
      if (!isSolidAt(frontX, footY) && !isSpikeAt(frontX, footY)) {
        enemy.direction *= -1;
      }
    }
  });

  // Remove enemies that have fallen far off the map
  game.enemies = game.enemies.filter(e => e.y < (game.levelHeight + 5) * TILE_SIZE);
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

  // Check bottom bound (kills player only when completely out of bounds)
  const bottomBound = game.levelHeight * TILE_SIZE;
  if (player.y > bottomBound) {
    killPlayer();
    return;
  }

  // Check spike collisions
  const nearbyTiles = getCollidingTiles(player, true);
  const hitSpike = nearbyTiles.some((tile) => tile.type === 'spike' && spikeIntersect(player, tile));
  if (hitSpike) {
    killPlayer();
    return;
  }

  // Check enemy collisions (no stomp mechanic)
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    if (enemy.dead) continue;
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
  game.player.attackAnimTimer = 0;
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
  const p = game.player;
  if (p.attackAnimTimer <= 0) return;
  const ctx = game.ctx;
  const hurtbox = getHurtbox(p);
  const screenX = hurtbox.x - game.camera.x;
  const screenY = hurtbox.y - game.camera.y;

  const sprite = game.assets.playerPunch;
  
  if (sprite) {
    const centerX = screenX + hurtbox.width / 2;
    const centerY = screenY + hurtbox.height / 2;

    // Animation frame logic
    const totalFrames = 3;
    const progress = ATTACK_DURATION - p.attackAnimTimer; 
    let frame = Math.floor(progress / (ATTACK_DURATION / totalFrames));
    if (frame >= totalFrames) frame = totalFrames - 1;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Rotation/Flip logic
    if (p.attackDir.y < 0) { // Up
        ctx.rotate(-Math.PI / 2);
    } else if (p.attackDir.y > 0) { // Down
        ctx.rotate(Math.PI / 2);
    } else if (p.attackDir.x < 0) { // Left
        ctx.scale(-1, 1);
    }
    // Right is default

    // Draw centered 16x16 sprite
    ctx.drawImage(sprite, frame * 16, 0, 16, 16, -8, -8, 16, 16);
    ctx.restore();
  } else {
    // Fallback debug rect
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX, screenY, hurtbox.width, hurtbox.height);
    ctx.restore();
  }
}

function getVertexMask(vx, vy, tileType) {
  // Check the 4 tiles around vertex (vx, vy)
  // Returns a 4-bit mask: bit0=TL, bit1=TR, bit2=BL, bit3=BR
  let mask = 0;
  if (isTileSolidAtCoords(vx - 1, vy - 1, tileType)) mask |= 1; // TL
  if (isTileSolidAtCoords(vx, vy - 1, tileType))     mask |= 2; // TR
  if (isTileSolidAtCoords(vx - 1, vy, tileType))     mask |= 4; // BL
  if (isTileSolidAtCoords(vx, vy, tileType))         mask |= 8; // BR
  return mask;
}

function isTileSolidAtCoords(x, y, tileType) {
  // Treat out of bounds as solid on left, right, and bottom (but not top)
  if (x < 0 || x >= game.levelWidth || y >= game.levelHeight) return true;
  if (y < 0) return false; // Top is open
  
  const key = `${x},${y}`;
  const t = game.tiles[key];
  // Only match the same tile type for autotiling
  return t === tileType;
}

function renderTiles() {
  const ctx = game.ctx;
  
  // Calculate visible tile range
  const startX = Math.floor(game.camera.x / TILE_SIZE) - 1;
  const startY = Math.floor(game.camera.y / TILE_SIZE) - 1;
  const endX = Math.ceil((game.camera.x + game.width) / TILE_SIZE) + 1;
  const endY = Math.ceil((game.camera.y + game.height) / TILE_SIZE) + 1;

  const tilesheet = game.assets.tilesheet;
  const useTilesheet = tilesheet && tilesheet.width > 0;

  // First pass: render non-ground tiles (spikes, goals, etc.)
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const type = game.tiles[`${x},${y}`];
      if (!type) continue;
      
      const screenX = Math.round(x * TILE_SIZE - game.camera.x);
      const screenY = Math.round(y * TILE_SIZE - game.camera.y);
      
      if (type === 'spike' && game.assets.spike) {
        drawTile(ctx, type, screenX, screenY, TILE_SIZE, 0, 0, game.assets.spike);
      } else if (type === 'coin') { 
        if (!game.collectedCoins.has(`${x},${y}`) && game.assets.coin) {
             // frame 0 is default state
             ctx.drawImage(game.assets.coin, 0, 0, 16, 16, screenX, screenY, 16, 16);
        }
      } else if (type === 'diamond') { // Token logic
        if (!game.collectedTokens.has(`${x},${y}`) && game.assets.token) {
             // frame 0 is default state
             ctx.drawImage(game.assets.token, 0, 0, 16, 16, screenX, screenY, 16, 16);
        }
      } else if (type === 'goal') {
        if (game.assets.goal) {
          // Draw full goal image with origin at bottom-left 16x16 tile
          const goalWidth = game.assets.goal.width;
          const goalHeight = game.assets.goal.height;
          // Position so bottom-left aligns with the tile
          const drawX = screenX;
          const drawY = screenY + TILE_SIZE - goalHeight;
          ctx.drawImage(game.assets.goal, 0, 0, goalWidth, goalHeight, drawX, drawY, goalWidth, goalHeight);
        } else {
          drawTile(ctx, type, screenX, screenY, TILE_SIZE);
        }
      }
    }
  }

  // Draw Coin Animations (overlay)
  game.coinAnims.forEach(anim => {
      const screenX = Math.round(anim.x - game.camera.x);
      const screenY = Math.round(anim.y - game.camera.y);
      // Anim frames 1, 2, 3
      const frameIndex = 1 + Math.floor(anim.timer / 5); 
      if (frameIndex <= 3 && game.assets.coin) {
          ctx.drawImage(game.assets.coin, frameIndex * 16, 0, 16, 16, screenX, screenY, 16, 16);
      }
  });

  // Draw Token Animations (overlay)
  game.tokenAnims.forEach(anim => {
      const screenX = Math.round(anim.x - game.camera.x);
      let screenY = Math.round(anim.y - game.camera.y);
      let frameIndex = 1 + Math.floor(anim.timer / 4); 
      let alpha = 1.0;

      // Linger on last frame (frame 7)
      if (anim.timer >= 28) {
          frameIndex = 7;
      }

      // Rise and fade phase (starts after lag)
      if (anim.timer > 40) {
          const rise = anim.timer - 40;
          screenY -= rise * 0.5;
          alpha = Math.max(0, 1 - (rise / 20));
      }

      if (game.assets.token && alpha > 0) {
          ctx.save();
          ctx.globalAlpha = alpha;
          // Clamp frame just in case
          if (frameIndex > 7) frameIndex = 7; 
          ctx.drawImage(game.assets.token, frameIndex * 16, 0, 16, 16, screenX, screenY, 16, 16);
          ctx.restore();
      }
  });

  // Second pass: render ground tiles with autotiling
  // Iterate over all tiles in game.tiles instead of the full grid
  const tilesheet1 = game.assets.tilesheet;
  const tilesheet2 = game.assets.tilesheet2;
  
  for (const key of Object.keys(game.tiles)) {
    const type = game.tiles[key];
    if (type !== 'ground' && type !== 'tile') continue;
    
    // Use tilesheet2 for ground, tilesheet1 for tile
    const tilesheet = type === 'ground' ? tilesheet2 : tilesheet1;
    const useTilesheet = tilesheet && tilesheet.width > 0;

    const [x, y] = key.split(',').map(Number);
    const screenX = Math.round(x * TILE_SIZE - game.camera.x);
    const screenY = Math.round(y * TILE_SIZE - game.camera.y);

    // Skip if off-screen
    if (screenX < -TILE_SIZE || screenX > game.width ||
        screenY < -TILE_SIZE || screenY > game.height) continue;

    if (useTilesheet) {
      // Calculate masks for each corner of this tile (Vertices)
      
      const maskTL = getVertexMask(x, y, type);         // TL corner of tile is vertex (x,y)
      const maskTR = getVertexMask(x + 1, y, type);     // TR corner of tile is vertex (x+1,y)
      const maskBL = getVertexMask(x, y + 1, type);     // BL corner of tile is vertex (x,y+1)
      const maskBR = getVertexMask(x + 1, y + 1, type); // BR corner of tile is vertex (x+1,y+1)

      // Draw 4 sub-tiles (8x8 each) for this tile
      drawAutoTileQuadrant(ctx, tilesheet, maskTL, 3, screenX,     screenY);
      drawAutoTileQuadrant(ctx, tilesheet, maskTR, 2, screenX + 8, screenY);
      drawAutoTileQuadrant(ctx, tilesheet, maskBL, 1, screenX,     screenY + 8);
      drawAutoTileQuadrant(ctx, tilesheet, maskBR, 0, screenX + 8, screenY + 8);
    } else {
      // Fallback: simple brown rectangle
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
    }

  }
}

// Draw a single 8x8 quadrant from the autotile sheet
function drawAutoTileQuadrant(ctx, tilesheet, mask, quadrant, destX, destY) {
  if (mask === 0) return;

  // Mapping bitmask value to tilesheet coordinates (col, row)
  const mapping = [
    { c: 0, r: 3 }, // 0
    { c: 3, r: 3 }, // 1
    { c: 0, r: 2 }, // 2
    { c: 1, r: 2 }, // 3
    { c: 0, r: 0 }, // 4
    { c: 3, r: 2 }, // 5
    { c: 2, r: 3 }, // 6
    { c: 3, r: 1 }, // 7
    { c: 1, r: 3 }, // 8
    { c: 0, r: 1 }, // 9
    { c: 1, r: 0 }, // 10
    { c: 2, r: 2 }, // 11
    { c: 3, r: 0 }, // 12
    { c: 2, r: 0 }, // 13
    { c: 1, r: 1 }, // 14
    { c: 2, r: 1 }  // 15
  ];

  const pos = mapping[mask] || mapping[0];
  const tileX = pos.c * 16;
  const tileY = pos.r * 16;

  // quadrant determines which 8x8 portion: 0=TL, 1=TR, 2=BL, 3=BR
  const qx = (quadrant % 2) * 8;
  const qy = Math.floor(quadrant / 2) * 8;

  ctx.drawImage(tilesheet, tileX + qx, tileY + qy, 8, 8, destX, destY, 8, 8);
}

// Fallback when no tilesheet is available
function drawFallbackQuadrant(ctx, mask, destX, destY) {
  if (mask === 0) return;
  ctx.fillStyle = '#8b4513'; // Brown for ground
  ctx.fillRect(destX, destY, 8, 8);
}

function renderEnemies() {
  const ctx = game.ctx;
  const frameRate = 12; // Animation speed for enemies

  game.enemies.forEach((enemy) => {
    // Only animate if active/close
    if (!enemy.active && !enemy.dead) return;
    
    // Use global animation time for sync
    let frame = Math.floor(game.animTime / (1000/frameRate)) % 2; 

    if (enemy.dead) {
      frame = 1; // Use second frame for dead state
    }
    
    const screenX = Math.round(enemy.x - game.camera.x);
    const screenY = Math.round(enemy.y - game.camera.y);
    
    if (game.assets.enemyWalk) {
        ctx.save();
        ctx.translate(screenX + enemy.width/2, screenY + enemy.height/2);
        
        // Sprite likely faces RIGHT by default.
        // If moving LEFT (-1), FLIP it.
        if (enemy.direction < 0) ctx.scale(-1, 1);
        
        // If dead, maybe flip vertically too? Optional. User just said "second frame... fall off".
        if (enemy.dead) {
            ctx.scale(1, -1); // Upside down fall? "fall off the map"
        }

        // Draw 16x16 sprite, offset up 1 pixel
        // Offset by -8 to center, and -1 to move up
        ctx.drawImage(game.assets.enemyWalk, frame * 16, 0, 16, 16, -8, -9, 16, 16);
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
    
    // Draw centered 16x16 sprite, offset up 1 pixel
    // Offset by -8 to center 16px sprite on 0,0, and -1 to move up
    ctx.drawImage(sprite, frame * 16, 0, 16, 16, -8, -9, 16, 16);
    
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
      
      // For solid collision, skip non-solid tiles
      if (!includeHazards && !isSolidTile(type)) continue;
      // For hazard/goal detection, include everything when includeHazards is true
      if (includeHazards || isSolidTile(type)) {
        // Custom hitbox for goal: 3x40 pixels, centered horizontally, aligned to bottom
        if (type === 'goal') {
          const goalX = x * TILE_SIZE + (TILE_SIZE - 3) / 2; // Center horizontally
          const goalY = y * TILE_SIZE + TILE_SIZE - 40; // Align to bottom
          tiles.push({ x: goalX, y: goalY, width: 3, height: 40, type });
        } else {
          tiles.push({ x: x * TILE_SIZE, y: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE, type });
        }
      }
    }
  }

  return tiles;
}

function isSolidTile(type) {
  return type === 'ground' || type === 'tile';
}

function isSolidAt(px, py) {
  const x = Math.floor(px / TILE_SIZE);
  const y = Math.floor(py / TILE_SIZE);
  const type = game.tiles[`${x},${y}`];
  return isSolidTile(type);
}

function isSpikeAt(px, py) {
  const x = Math.floor(px / TILE_SIZE);
  const y = Math.floor(py / TILE_SIZE);
  const type = game.tiles[`${x},${y}`];
  return type === 'spike';
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function spikeIntersect(rect, tile) {
  const tx = tile.x;
  const ty = tile.y;
  
  // Rect relative to Tile
  const rx = rect.x - tx;
  const ry = rect.y - ty;
  const rw = rect.width;
  const rh = rect.height;

  // 1. Precise Bounding Box Check (Triangle width 14px, height 16px)
  // X range: [1, 15], Y range: [0, 16]
  if (rx > 15 || rx + rw < 1 || ry > 16 || ry + rh < 0) return false;

  // 2. Left Slope Separation Check (P1-P2 Edge)
  // Triangle is to the right/down of line 16x + 7y = 128
  // If entire rect is left/up (value < 128), no collision.
  // Maximize 16x + 7y (Bottom-Right corner)
  if (16 * (rx + rw) + 7 * (ry + rh) < 128) return false;

  // 3. Right Slope Separation Check (P2-P3 Edge)
  // Triangle is to the left/down of line 16x - 7y = 128
  // If entire rect is right/up (value > 128), no collision.
  // Minimize 16x - 7y (Bottom-Left corner)
  if (16 * rx - 7 * (ry + rh) > 128) return false;

  return true;
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
  
  // Center alignment calculation
  // 8px width per char (monospaced from sprite sheet)
  const scale = 1;
  const charWidth = 8 * scale;
  const totalWidth = timeString.length * charWidth;
  const startX = Math.floor(game.width / 2 - totalWidth / 2);
  const startY = 8; // Top padding

  if (game.assets.timerFont) {
    drawBitmapText(ctx, timeString, startX, startY, scale);
  }
}

function drawBitmapText(ctx, text, startX, startY, scale) {
  const img = game.assets.timerFont;
  if (!img) return;

  let cursorX = startX;
  const charSize = 8;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    let index = -1;

    if (char >= '0' && char <= '9') {
      index = char.charCodeAt(0) - 48; // 0-9
    } else if (char === '.') {
      index = 10; // 10th sprite
    }
    
    if (index !== -1) {
       ctx.drawImage(
         img, 
         index * charSize, 0, charSize, charSize, 
         cursorX, startY, charSize * scale, charSize * scale
       );
    }
    cursorX += charSize * scale;
  }
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
