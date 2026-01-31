const TILE_SIZE = 16;

// Physics constants
const GRAVITY = 0.25;
const MAX_FALL_SPEED = 6;

// Bubble mode physics
const BUBBLE_GRAVITY = 0.1;
const BUBBLE_MAX_FALL_SPEED = 2;
const BUBBLE_GROUND_ACCELERATION = 0.08;
const BUBBLE_AIR_ACCELERATION = 0.05;
const BUBBLE_GROUND_FRICTION = 0.92;
const BUBBLE_AIR_FRICTION = 0.95;
const BUBBLE_ATTACK_FLOAT_SPEED = 3.5;
const BUBBLE_PLAYER_SPEED = 1;
const BUBBLE_JUMP_VELOCITY = -4;

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
const ATTACK_DURATION = 10;
const ATTACK_COOLDOWN = 14;
const ATTACK_RANGE = 16;
const MAX_HEALTH = 3;
const INVULN_FRAMES = 90;
const ENEMY_BASE_SPEED = 0.9;
const ENEMY_INVULN_FRAMES = 30;
const HEALTH_DISPLAY_FRAMES = 120;
const HEALTH_FADE_FRAMES = 50;

// Wall jump constants
const WALL_SLIDE_SPEED = 1.5;
const WALL_JUMP_VELOCITY_X = 3;
const WALL_JUMP_VELOCITY_Y = -5;
const WALL_COYOTE_TIME = 8; // Frames of grace after leaving wall
const WALL_STICK_FRAMES = 0; // Brief stick to wall before sliding
const WALL_JUMP_COOLDOWN = 15; // Cooldown between wall jumps

// Death animation constants
const DEATH_DURATION = 60;
const DEATH_PAUSE_DURATION = 10;
const DEATH_RISE_DURATION = 3;
const DEATH_SPIN_SPEED = 0;

// On/Off switch defaults
const SWITCH_DEFAULT_STATE = false;

// Gamepad constants (Standard Gamepad layout)
const GAMEPAD_DEADZONE = 0.25;
const GAMEPAD_AXIS_X = 0;
const GAMEPAD_AXIS_Y = 1;
const GAMEPAD_BUTTON_JUMP = 0;   // A
const GAMEPAD_BUTTON_ATTACK = 7; // RT (Right Trigger)
const GAMEPAD_DPAD_UP = 12;
const GAMEPAD_DPAD_DOWN = 13;
const GAMEPAD_DPAD_LEFT = 14;
const GAMEPAD_DPAD_RIGHT = 15;

// Tile rotation support
const ROTATABLE_TILES = new Set(['spike']);

function isRotatableTile(type) {
  return ROTATABLE_TILES.has(type);
}

function normalizeRotation(rot) {
  const step = Math.round((Number(rot) || 0) / 90) % 4;
  return ((step + 4) % 4) * 90;
}

function parseTileEntry(tile) {
  if (typeof tile === 'string') return { type: tile, rotation: 0 };
  if (tile && typeof tile === 'object') {
    return {
      type: tile.type || '',
      rotation: normalizeRotation(tile.rotation)
    };
  }
  return { type: '', rotation: 0 };
}

function normalizeTiles(rawTiles) {
  const normalized = {};
  Object.entries(rawTiles || {}).forEach(([key, value]) => {
    const info = parseTileEntry(value);
    if (!info.type) return;
    normalized[key] = isRotatableTile(info.type) ? { type: info.type, rotation: info.rotation } : info.type;
  });
  return normalized;
}

// Initialize Web Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const game = {
  canvas: null,
  ctx: null,
  paused: true, // Start paused
  started: false, // Has the level started?
  levelInfo: {}, // Metadata (title, desc, creator)
  userStatus: { has_beaten: false, has_liked: null }, // User interactions
  vibrationsEnabled: true, // Controller vibration preference
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
    health: 1,
    maxHealth: MAX_HEALTH,
    invulnTimer: 0,
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
    isWallSliding: false,
    // Variable jump
    isJumping: false,
    jumpHeld: false,
    // Attack state
    facing: 1,
    attackTimer: 0,
    attackAnimTimer: 0,
    attackCooldown: 0,
    attackQueued: false,
    attackDir: { x: 1, y: 0 },
    attackLungeVelX: 0,
    attackLungeVelY: 0,
    // Bubble powerup
    bubbleMode: false
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
  keyboard: {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    attack: false
  },
  gamepad: {
    connected: false,
    index: null,
    prevButtons: [],
    mapping: {
      dpadLeft: GAMEPAD_DPAD_LEFT,
      dpadRight: GAMEPAD_DPAD_RIGHT,
      dpadUp: GAMEPAD_DPAD_UP,
      dpadDown: GAMEPAD_DPAD_DOWN,
      buttonJump: GAMEPAD_BUTTON_JUMP,
      buttonAttack: GAMEPAD_BUTTON_ATTACK
    },
    state: {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      attack: false
    }
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
  healthDisplayTimer: 0,
  healthFadeTimer: 0,
  switchState: SWITCH_DEFAULT_STATE,
  switchCooldown: 0,
  levelCompleted: false,
  background: null,
  surpriseAnims: [],
  confetti: [],
  assets: {
    playerWalk: null,
    playerJump: null,
    playerWallSlide: null,
    playerDie: null,
    playerIdle: null,
    playerPunch: null,
    fingerGun: null,
    bullet: null,
    spike: null,
    coin: null,
    token: null,
    healthToken: null,
    surpriseToken: null,
    handPowerup: null,
    confetti: null,
    onBlock: null,
    offBlock: null,
    onoffSwitch: null,
    playerHealth: null,
    enemyHealth: null,
    enemyWalk: null,
    spikeEnemy: null,
    tilesheet: null,
    tilesheet2: null,
    stoneBrickTilesheet: null,
    plankTilesheet: null,
    timerFont: null,
    soundSwish: null,
    soundShoot: null,
    soundPunch: null,
    soundCoin: null,
    soundToken: null,
    soundSurprisePop: null,
    soundPop: null,
    soundTurnOn: null,
    soundTurnOff: null,
    bgNight1: null,
    bgNight2: null,
    bgNight3: null,
    bgForest1: null,
    bgForest2: null,
    bgForest3: null,
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
    loadImage('graphics/finger_gun.png').then(img => game.assets.fingerGun = img),
    loadImage('graphics/bullet.png').then(img => game.assets.bullet = img),
    loadImage('graphics/spike.png').then(img => game.assets.spike = img),
    loadImage('graphics/coin.png').then(img => game.assets.coin = img),
    loadImage('graphics/token.png').then(img => game.assets.token = img),
    loadImage('graphics/health_token.png').then(img => game.assets.healthToken = img),
    loadImage('graphics/surprise_token.png').then(img => game.assets.surpriseToken = img),
    loadImage('graphics/bubble_powerup.png').then(img => game.assets.bubblePowerup = img),
    loadImage('graphics/hand_powerup.png').then(img => game.assets.handPowerup = img),
    loadImage('graphics/bubble.png').then(img => game.assets.bubble = img),
    loadImage('graphics/confetti.png').then(img => game.assets.confetti = img),
    loadImage('graphics/bgs/night/layer_1.png').then(img => game.assets.bgNight1 = img),
    loadImage('graphics/bgs/night/layer_2.png').then(img => game.assets.bgNight2 = img),
    loadImage('graphics/bgs/night/layer_3.png').then(img => game.assets.bgNight3 = img),
    loadImage('graphics/bgs/forest/layer_1.png').then(img => game.assets.bgForest1 = img),
    loadImage('graphics/bgs/forest/layer_2.png').then(img => game.assets.bgForest2 = img),
    loadImage('graphics/bgs/forest/layer_3.png').then(img => game.assets.bgForest3 = img),
    loadImage('graphics/on_block.png').then(img => game.assets.onBlock = img),
    loadImage('graphics/off_block.png').then(img => game.assets.offBlock = img),
    loadImage('graphics/onoff_switch.png').then(img => game.assets.onoffSwitch = img),
    loadImage('graphics/player_health.png').then(img => game.assets.playerHealth = img),
    loadImage('graphics/enemy_health.png').then(img => game.assets.enemyHealth = img),
    loadImage('graphics/enemy1_walk.png').then(img => game.assets.enemyWalk = img),
    loadImage('graphics/spike_enemy.png').then(img => game.assets.spikeEnemy = img),
    loadImage('graphics/goal.png').then(img => game.assets.goal = img),
    loadImage('graphics/timer_font.png').then(img => game.assets.timerFont = img),
    loadImage('graphics/tilesheet_1.png').then(img => {
      game.assets.tilesheet = img;
    }),
    loadImage('graphics/tilesheet_2.png').then(img => {
      game.assets.tilesheet2 = img;
    }),
    loadImage('graphics/stone_brick_tilesheet.png').then(img => {
      game.assets.stoneBrickTilesheet = img;
    }),
    loadImage('graphics/plank_tilesheet.png').then(img => {
      game.assets.plankTilesheet = img;
    }),
    loadAudio('sounds/swish.ogg').then(audio => game.assets.soundSwish = audio),
    loadAudio('sounds/shoot.ogg').then(audio => game.assets.soundShoot = audio),
    loadAudio('sounds/punch.ogg').then(audio => game.assets.soundPunch = audio),
    loadAudio('sounds/coin.ogg').then(audio => game.assets.soundCoin = audio),
    loadAudio('sounds/token_get.ogg').then(audio => game.assets.soundToken = audio),
    loadAudio('sounds/surprise_pop.ogg').then(audio => game.assets.soundSurprisePop = audio),
    loadAudio('sounds/pop.ogg').then(audio => game.assets.soundPop = audio),
    loadAudio('sounds/turn_on.ogg').then(audio => game.assets.soundTurnOn = audio),
    loadAudio('sounds/turn_off.ogg').then(audio => game.assets.soundTurnOff = audio),
    loadAudio('sounds/jump.ogg').then(audio => game.assets.soundJump = audio),
    loadAudio('sounds/land.ogg').then(audio => game.assets.soundLand = audio),
    loadAudio('sounds/hurt.ogg').then(audio => game.assets.soundHurt = audio),
    loadAudio('sounds/dead.ogg').then(audio => game.assets.soundDead = audio),
    loadAudio('sounds/slide_init.ogg').then(audio => game.assets.soundSlideInit = audio),
    loadAudio('sounds/slide.ogg').then(audio => game.assets.soundSlide = audio),
  ]);
}

function loadAudio(src) {
  return new Promise(async (resolve) => {
    try {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      resolve(audioBuffer);
    } catch (e) {
      console.warn(`Failed to load audio ${src}`, e);
      resolve(null);
    }
  });
}

function playSound(buffer, loop = false) {
  if (!buffer) return null;
  
  // Try to resume context if suspended (autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(e => console.log('Audio resume failed', e));
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.4;
  
  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  source.start(0);
  
  return source; // Return source for stopping (looping sounds)
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

async function initGame() {
  game.canvas = document.getElementById('gameCanvas');
  game.ctx = game.canvas.getContext('2d');

  // Disable image smoothing for pixel art
  game.ctx.imageSmoothingEnabled = false;

  // Ensure window has focus for key events
  window.focus();
  
  // Try to resume audio context early (might work on navigation)
  if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {}); // Ignore error on initial load
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  await setupControls();
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
  // Base height fixed at 224 (14 tiles), width adjusts to aspect ratio
  const BASE_HEIGHT = 224;
  const MIN_WIDTH = 256;   // 16 tiles, ~8:7 aspect
  const MAX_WIDTH = 528;   // 33 tiles, extra buffer for edge coverage
  
  // Aspect ratio limits
  const MIN_ASPECT = 1.33; // ~4:3
  const MAX_ASPECT = 2.33; // ~21:9
  
  // Calculate level dimensions in pixels
  const levelPixelWidth = game.levelWidth * TILE_SIZE;
  const levelPixelHeight = game.levelHeight * TILE_SIZE;
  
  // Get container dimensions
  const container = document.querySelector('.game-container');
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const containerAspect = containerWidth / containerHeight;
  
  // Clamp container aspect to limits
  const clampedAspect = Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, containerAspect));
  
  // Calculate canvas width based on clamped aspect, round UP to next tile to avoid gaps
  let canvasHeight = BASE_HEIGHT;
  let canvasWidth = Math.ceil((BASE_HEIGHT * clampedAspect) / TILE_SIZE) * TILE_SIZE;
  
  // Clamp width to min/max
  canvasWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, canvasWidth));
  
  // If level is smaller than view, shrink canvas to level size (in tile increments)
  if (levelPixelWidth > 0 && levelPixelWidth < canvasWidth) {
    canvasWidth = Math.max(MIN_WIDTH, Math.floor(levelPixelWidth / TILE_SIZE) * TILE_SIZE);
  }
  if (levelPixelHeight > 0 && levelPixelHeight < canvasHeight) {
    canvasHeight = Math.max(176, Math.floor(levelPixelHeight / TILE_SIZE) * TILE_SIZE);
  }

  game.canvas.width = canvasWidth;
  game.canvas.height = canvasHeight;

  game.width = game.canvas.width;
  game.height = game.canvas.height;
  
  // Scale canvas to FILL container (may crop edges slightly but no gaps)
  const canvasAspect = canvasWidth / canvasHeight;
  
  let displayWidth, displayHeight;
  
  // Always fill the container completely
  if (containerAspect > canvasAspect) {
    // Container is wider - fit to width, may overflow height slightly
    displayWidth = containerWidth;
    displayHeight = displayWidth / canvasAspect;
  } else {
    // Container is taller - fit to height, may overflow width slightly
    displayHeight = containerHeight;
    displayWidth = displayHeight * canvasAspect;
  }
  
  // Apply CSS sizing for uniform scaling
  game.canvas.style.width = `${Math.floor(displayWidth)}px`;
  game.canvas.style.height = `${Math.floor(displayHeight)}px`;
  
  // Re-disable smoothing after resize
  if (game.ctx) game.ctx.imageSmoothingEnabled = false;
}

async function setupControls() {
  // Load user's control scheme
  const userControls = await loadUserControls();
  
  // Default controls
  const defaultsKeyboard = {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    jump: 'ArrowUp',
    attack: 'Space'
  };

  const defaultsGamepad = {
    dpadLeft: GAMEPAD_DPAD_LEFT,
    dpadRight: GAMEPAD_DPAD_RIGHT,
    dpadUp: GAMEPAD_DPAD_UP,
    dpadDown: GAMEPAD_DPAD_DOWN,
    buttonJump: GAMEPAD_BUTTON_JUMP,
    buttonAttack: GAMEPAD_BUTTON_ATTACK
  };
  
  // Use user controls or fall back to defaults
  let keyMap = defaultsKeyboard;
  let gamepadMap = defaultsGamepad;
  if (userControls) {
    if (userControls.keyboard || userControls.gamepad) {
      keyMap = { ...defaultsKeyboard, ...(userControls.keyboard || {}) };
      gamepadMap = { ...defaultsGamepad, ...(userControls.gamepad || {}) };
    } else {
      // Legacy shape: flat keyboard map
      keyMap = { ...defaultsKeyboard, ...userControls };
    }
  }
  game.gamepad.mapping = gamepadMap;
  
  window.addEventListener('keydown', (e) => {
    // Correctly ignore inputs when typing
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Check for first input to start the game
    if (game.waitingForFirstInput && !game.levelCompleted) {
      // Start on any gameplay key
      if (e.code === keyMap.left || e.code === keyMap.right || e.code === keyMap.up || 
          e.code === keyMap.down || e.code === keyMap.jump || e.code === keyMap.attack) {
        resumeGame();
        return; // Don't process this input frame
      }
    }

    // Ignore game controls if level is completed (except possibly navigation keys if used for menus, but here we want to stop movement)
    if (game.levelCompleted || game.paused) return;

    if (e.code === keyMap.left) game.keyboard.left = true;
    if (e.code === keyMap.right) game.keyboard.right = true;
    if (e.code === keyMap.up) game.keyboard.up = true;
    if (e.code === keyMap.down) game.keyboard.down = true;
    if (e.code === keyMap.jump) {
      if (!game.keyboard.jump) {
        game.keys.jumpPressed = true; // New press
      }
      game.keyboard.jump = true;
    }
    
    // Attack key
    if (e.code === keyMap.attack) {
      if (!game.keyboard.attack) {
        game.keys.attackPressed = true; // New attack press
      }
      game.keyboard.attack = true;
      // Prevent scrolling
      e.preventDefault(); 
    }

    updateCombinedInputState();
  });

  window.addEventListener('keyup', (e) => {
    // Also handle Enter to start if on start menu, and Esc to pause
    if (e.code === 'Enter') {
        if (game.paused) {
            hidePauseMenu();
            resumeGame();
        }
    }
    
    if (e.code === 'Escape') {
        if (!game.paused && !game.levelCompleted) {
            pauseGame();
        } else if (game.paused) {
            hidePauseMenu();
            resumeGame();
        }
    }

    if (e.code === keyMap.left) game.keyboard.left = false;
    if (e.code === keyMap.right) game.keyboard.right = false;
    if (e.code === keyMap.up) game.keyboard.up = false;
    if (e.code === keyMap.jump) game.keyboard.jump = false;
    if (e.code === keyMap.down) game.keyboard.down = false;
    if (e.code === keyMap.attack) game.keyboard.attack = false;

    updateCombinedInputState();
  });

  window.addEventListener('gamepadconnected', (e) => {
    game.gamepad.connected = true;
    game.gamepad.index = e.gamepad.index;
  });

  window.addEventListener('gamepaddisconnected', () => {
    game.gamepad.connected = false;
    game.gamepad.index = null;
    game.gamepad.prevButtons = [];
    game.gamepad.state = { left: false, right: false, up: false, down: false, jump: false, attack: false };
    updateCombinedInputState();
  });
}

// Load user's control scheme from the server
async function loadUserControls() {
  try {
    const response = await fetch('/auth/user');
    if (!response.ok) {
      return null;
    }
    const user = await response.json();
    game.vibrationsEnabled = user.vibrations_enabled !== false;
    return user.control_scheme || null;
  } catch (err) {
    console.error('Error loading user controls:', err);
    return null;
  }
}

function updateCombinedInputState() {
  const gp = game.gamepad.state || {};
  const kb = game.keyboard;

  game.keys.left = !!(kb.left || gp.left);
  game.keys.right = !!(kb.right || gp.right);
  game.keys.up = !!(kb.up || gp.up);
  game.keys.down = !!(kb.down || gp.down);
  game.keys.jump = !!(kb.jump || gp.jump);
  game.keys.attack = !!(kb.attack || gp.attack);
}

function vibrateGamepad(duration = 200, weakMagnitude = 0.5, strongMagnitude = 0.5) {
  if (!game.vibrationsEnabled || !game.gamepad.connected || game.gamepad.index === null) return;
  
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads[game.gamepad.index];
  
  if (pad && pad.vibrationActuator) {
    pad.vibrationActuator.playEffect('dual-rumble', {
      duration: duration,
      weakMagnitude: weakMagnitude,
      strongMagnitude: strongMagnitude
    }).catch(() => {});
  }
}

function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;

  if (game.gamepad.index !== null && pads[game.gamepad.index]) {
    pad = pads[game.gamepad.index];
  } else {
    for (const p of pads) {
      if (p) {
        pad = p;
        game.gamepad.index = p.index;
        break;
      }
    }
  }

  if (!pad) {
    game.gamepad.connected = false;
    game.gamepad.state = { left: false, right: false, up: false, down: false, jump: false, attack: false };
    updateCombinedInputState();
    return;
  }

  game.gamepad.connected = true;

  const buttonPressed = (idx) => {
    const b = pad.buttons[idx];
    if (!b) return false;
    
    // If button has both pressed and value properties, prefer pressed
    // Only use value threshold for analog-only buttons (triggers on some controllers)
    if (b.pressed !== undefined) {
      return b.pressed;
    }
    
    // Fallback to value threshold for analog-only buttons
    if (typeof b.value === 'number') {
      return b.value > 0.5;
    }
    
    return false;
  };

  const axisX = pad.axes[GAMEPAD_AXIS_X] || 0;
  const axisY = pad.axes[GAMEPAD_AXIS_Y] || 0;

  const m = game.gamepad.mapping || {};
  const prev = game.gamepad.prevButtons || [];

  // Check both axes and buttons for directional input
  // Some controllers (Switch) may have D-pad on axes 6-9 or just buttons
  const dpadAxisX = pad.axes[6] || 0;  // Some controllers use axis 6 for D-pad horizontal
  const dpadAxisY = pad.axes[7] || 0;  // Some controllers use axis 7 for D-pad vertical

  const left = axisX < -GAMEPAD_DEADZONE || dpadAxisX < -0.5 || buttonPressed(m.dpadLeft ?? GAMEPAD_DPAD_LEFT);
  const right = axisX > GAMEPAD_DEADZONE || dpadAxisX > 0.5 || buttonPressed(m.dpadRight ?? GAMEPAD_DPAD_RIGHT);
  const up = axisY < -GAMEPAD_DEADZONE || dpadAxisY < -0.5 || buttonPressed(m.dpadUp ?? GAMEPAD_DPAD_UP);
  const down = axisY > GAMEPAD_DEADZONE || dpadAxisY > 0.5 || buttonPressed(m.dpadDown ?? GAMEPAD_DPAD_DOWN);

  const jumpIdx = m.buttonJump ?? GAMEPAD_BUTTON_JUMP;
  const attackIdx = m.buttonAttack ?? GAMEPAD_BUTTON_ATTACK;
  
  const jumpNow = buttonPressed(jumpIdx);
  const attackNow = buttonPressed(attackIdx);

  // Check for first input to start the game
  if (game.waitingForFirstInput && !game.levelCompleted) {
    if (left || right || up || down || jumpNow || attackNow) {
      resumeGame();
      return; // Don't process this input frame
    }
  }

  const justJump = jumpNow && !prev[jumpIdx];
  const justAttack = attackNow && !prev[attackIdx];

  if (justJump) game.keys.jumpPressed = true;
  if (justAttack) game.keys.attackPressed = true;

  // Store current button state using same logic as buttonPressed for analog triggers
  game.gamepad.prevButtons = pad.buttons.map(b => {
    if (!b) return false;
    if (b.pressed !== undefined) return b.pressed;
    if (typeof b.value === 'number') return b.value > 0.5;
    return false;
  });
  game.gamepad.state = { left, right, up, down, jump: jumpNow, attack: attackNow };

  updateCombinedInputState();
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
      const target = levelId ? `/editor?id=${levelId}` : '/editor';
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

  game.currentLevelTitle = level.title || '';
  game.levelData = level.level_data || {};
  game.levelInfo = level; // Store full metadata
  game.background = (level.level_data && level.level_data.background) || null;
  
  // Check if level is published and if we're in publish mode
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const isPublished = level.published === true || level.published === 1;
  
  // Only show start menu for published levels that aren't being tested for publishing
  const shouldShowStartMenu = isPublished && mode !== 'publish';
  
  // Set initial state - always start paused, unpause on first input
  game.paused = true;
  game.started = false;
  game.waitingForFirstInput = true;
  
  resetLevelState();
  resetPlayer();
  
  // Show start menu only for published levels (not in test/publish mode)
  if (shouldShowStartMenu) {
    showPauseMenu();
  }
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
          
          // Try resuming the WebAudio context as well, just in case
          if (audioCtx.state === 'suspended') audioCtx.resume();

          // Add a one-time click listener to start music if autoplay failed
          const startAudio = () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            
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
  // Clone & normalize tiles so runtime mutations (e.g., surprise tokens) do not alter the source level data
  game.tiles = normalizeTiles(levelData.tiles || {});
  game.background = levelData.background || null;
  game.switchState = SWITCH_DEFAULT_STATE;
  game.switchCooldown = 0;
  game.animTime = 0;

  // Precomputed tile buckets to reduce per-frame iteration
  game.coinList = [];
  game.tokenList = [];
  game.healthList = [];
  game.bubblePowerupList = [];
  game.handPowerupList = [];
  game.bullets = [];
  game.groundTiles = [];
  game.surpriseAnims = [];
  game.confetti = [];

  game.enemies = [];
  game.collectedCoins = new Set(); // Track collected coins for animation
  game.coinAnims = []; // Active coin animations

  game.collectedTokens = new Set();
  game.tokenAnims = [];
  game.collectedHealth = new Set();
  game.healthAnims = [];
  game.collectedBubblePowerups = new Set();
  game.collectedHandPowerups = new Set();

  game.spawn = { x: TILE_SIZE, y: TILE_SIZE };

  Object.entries(game.tiles).forEach(([key, value]) => {
    const { type } = parseTileEntry(value);
    if (!type) return;

    const [x, y] = key.split(',').map(Number);
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;

    if (type === 'spawn') {
      game.spawn = { x: px, y: py };
    }

    if (type === 'enemy' || type === 'spike_enemy') {
      const isSpikeEnemy = type === 'spike_enemy';
      const height = isSpikeEnemy ? 20 : 14;
      const width = 14;
      const originOffsetY = isSpikeEnemy ? (height - TILE_SIZE) : 0; // anchor bottom 16px to tile grid
      
      game.enemies.push({
        type,
        x: px,
        y: py - originOffsetY,
        width,
        height,
        velX: ENEMY_BASE_SPEED,
        velY: 0,
        direction: -1,
        onGround: false,
        active: false,
        dead: false,
        health: isSpikeEnemy ? 2 : 1,
        maxHealth: isSpikeEnemy ? 2 : 1,
        invulnTimer: 0,
        healthDisplayTimer: 0,
        healthFadeTimer: 0,
        knockbackTimer: 0,
        knockbackVelX: 0,
        turnTimer: 0
      });
    }

    // Cache tile positions by type for faster per-frame scans
    if (type === 'coin') {
      game.coinList.push({ key, x: px, y: py, cx: px + TILE_SIZE / 2, cy: py + TILE_SIZE / 2 });
    } else if (type === 'diamond') {
      game.tokenList.push({ key, x: px, y: py, cx: px + TILE_SIZE / 2, cy: py + TILE_SIZE / 2 });
    } else if (type === 'health') {
      game.healthList.push({ key, x: px, y: py, cx: px + TILE_SIZE / 2, cy: py + TILE_SIZE / 2 });
    } else if (type === 'bubble_powerup') {
      game.bubblePowerupList.push({ key, x: px, y: py, cx: px + TILE_SIZE / 2, cy: py + TILE_SIZE / 2 });
    } else if (type === 'hand_powerup') {
      game.handPowerupList.push({ key, x: px, y: py, cx: px + TILE_SIZE / 2, cy: py + TILE_SIZE / 2 });
    } else if (type === 'ground' || type === 'tile' || type === 'stone_brick' || type === 'plank') {
      game.groundTiles.push({ key, x, y, type });
    }
  });
  
  // Separate overlapping enemies after all have been spawned
  separateOverlappingEnemies();
}

function separateOverlappingEnemies() {
  // Run multiple iterations to resolve all overlaps
  const maxIterations = 20;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let hadOverlap = false;
    
    for (let i = 0; i < game.enemies.length; i++) {
      for (let j = i + 1; j < game.enemies.length; j++) {
        const enemyA = game.enemies[i];
        const enemyB = game.enemies[j];
        
        if (rectsIntersect(enemyA, enemyB)) {
          hadOverlap = true;
          
          // Calculate overlap amounts
          const overlapX = Math.min(enemyA.x + enemyA.width, enemyB.x + enemyB.width) - Math.max(enemyA.x, enemyB.x);
          const overlapY = Math.min(enemyA.y + enemyA.height, enemyB.y + enemyB.height) - Math.max(enemyA.y, enemyB.y);
          
          // Small gradual push amount per iteration for smooth separation
          const pushStrength = 1.5;
          
          // Push apart on the axis with smaller overlap (easier to separate)
          if (overlapX < overlapY) {
            // Separate horizontally
            const pushAmount = Math.min(overlapX / 2, pushStrength);
            const oldAX = enemyA.x;
            const oldBX = enemyB.x;
            
            if (enemyA.x < enemyB.x) {
              enemyA.x -= pushAmount;
              enemyB.x += pushAmount;
            } else {
              enemyA.x += pushAmount;
              enemyB.x -= pushAmount;
            }
            
            // Check if push would put enemies in walls - if so, revert
            const aInWall = getCollidingTiles(enemyA, true).some(t => isSolidTile(t.type));
            const bInWall = getCollidingTiles(enemyB, true).some(t => isSolidTile(t.type));
            
            if (aInWall && bInWall) {
              // Both would hit walls, revert both
              enemyA.x = oldAX;
              enemyB.x = oldBX;
            } else if (aInWall) {
              // Only A hit wall, push B more
              enemyA.x = oldAX;
              enemyB.x = oldBX + (pushAmount * 2);
            } else if (bInWall) {
              // Only B hit wall, push A more
              enemyB.x = oldBX;
              enemyA.x = oldAX - (pushAmount * 2);
            }
          } else {
            // Prefer horizontal separation for stacked enemies (so they can stand on each other)
            // Only separate vertically if horizontal overlap is minimal
            if (overlapX > 2) {
              // Still some horizontal overlap, push horizontally instead
              const pushAmount = Math.min(overlapX / 2, pushStrength);
              const oldAX = enemyA.x;
              const oldBX = enemyB.x;
              
              if (enemyA.x < enemyB.x) {
                enemyA.x -= pushAmount;
                enemyB.x += pushAmount;
              } else {
                enemyA.x += pushAmount;
                enemyB.x -= pushAmount;
              }
              
              // Check walls
              const aInWall = getCollidingTiles(enemyA, true).some(t => isSolidTile(t.type));
              const bInWall = getCollidingTiles(enemyB, true).some(t => isSolidTile(t.type));
              
              if (aInWall && bInWall) {
                enemyA.x = oldAX;
                enemyB.x = oldBX;
              } else if (aInWall) {
                enemyA.x = oldAX;
                enemyB.x = oldBX + (pushAmount * 2);
              } else if (bInWall) {
                enemyB.x = oldBX;
                enemyA.x = oldAX - (pushAmount * 2);
              }
            }
            // If horizontally aligned (stacked), allow it - they can stand on each other
          }
        }
      }
    }
    
    // If no overlaps found, we're done
    if (!hadOverlap) break;
  }
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
  game.player.health = 1;
  game.player.maxHealth = MAX_HEALTH;
  game.player.invulnTimer = 0;
  game.player.bubbleMode = false;
  game.player.handPowerupMode = false;
  
  // Reset coyote time and jump buffer
  game.player.coyoteTimer = 0;
  game.player.jumpBufferTimer = 0;
  
  // Reset wall jump state
  game.player.touchingWallLeft = false;
  game.player.touchingWallRight = false;
  game.player.wallCoyoteTimer = 0;
  game.player.wallCoyoteDirection = 0; // -1 for left wall, 1 for right wall
  game.player.canWallJumpLeft = true;
  game.player.canWallJumpRight = true;
  game.player.wallJumpCooldown = 0;
  game.player.wallStickTimer = 0;
  game.player.wasPressingWallLeft = false;
  game.player.wasPressingWallRight = false;
  game.player.isWallSliding = false;
  
  // Reset variable jump state
  game.player.isJumping = false;
  game.player.jumpHeld = false;
  
  // Reset bubble mode
  game.player.bubbleMode = false;
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

  // Check for gamepad input to close pause menu (runs even when paused)
  if (game.paused) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    
    // Find connected gamepad
    for (const p of pads) {
      if (p) {
        pad = p;
        break;
      }
    }
    
    if (pad && pad.buttons) {
      // Check if any button was just pressed
      const anyButtonPressed = pad.buttons.some((btn, idx) => {
        if (!btn) return false;
        const isPressed = btn.pressed || (typeof btn.value === 'number' && btn.value > 0.5);
        const wasPressedBefore = game.gamepad.prevPauseButtons && game.gamepad.prevPauseButtons[idx];
        return isPressed && !wasPressedBefore;
      });
      
      if (anyButtonPressed) {
        hidePauseMenu();
        resumeGame();
      }
      
      // Store current button state for next frame
      game.gamepad.prevPauseButtons = pad.buttons.map(b => {
        if (!b) return false;
        if (b.pressed !== undefined) return b.pressed;
        if (typeof b.value === 'number') return b.value > 0.5;
        return false;
      });
    }
  }

  if (!game.paused) {
    accumulator += deltaTime;
    
    // Prevent spiral of death
    if (accumulator > 200) accumulator = 200;

    while (accumulator >= TIMESTEP) {
      update();
      accumulator -= TIMESTEP;
    }
  }
  
  render();
  // If paused, render opacity overlay or menu?
  // The menu itself is HTML overlay so canvas render underneath is fine.
  
  requestAnimationFrame(gameLoop);
}

function update() {
  pollGamepad();

  game.animTime = (game.animTime || 0) + TIMESTEP;

  // Update timer if started and not completed
  if (game.timer.started && !game.levelCompleted && !game.player.dead) {
    game.timer.currentTime = performance.now() - game.timer.startTime;
  }

  // Tick down invulnerability frames
  if (game.player.invulnTimer > 0) {
    game.player.invulnTimer--;
  }

  // Tick down health display timer
  if (game.healthDisplayTimer > 0) {
    game.healthDisplayTimer--;
    if (game.healthDisplayTimer <= HEALTH_FADE_FRAMES) {
      game.healthFadeTimer = game.healthDisplayTimer;
    } else {
      game.healthFadeTimer = HEALTH_FADE_FRAMES; // keep alpha at 1 until fade window
    }
  }

  if (game.switchCooldown > 0) {
    game.switchCooldown--;
  }
  
  // Handle death animation
  if (game.player.dead) {
    updateDeathAnimation();
    updateCamera();
    return;
  }
  
  updatePlayer();
  updateEnemies();
  updateBullets();
  updateCoins();
  updateConfetti();
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

  // Check for coin collection using cached lists
  for (const coin of game.coinList) {
    if (game.collectedCoins.has(coin.key)) continue;
    const dist = Math.abs(coin.cx - cx) + Math.abs(coin.cy - cy);
    if (dist < radius) {
      game.collectedCoins.add(coin.key);
      playSound(game.assets.soundCoin);
      game.coinAnims.push({ x: coin.x, y: coin.y, timer: 0 });
    }
  }

  // Token collection (diamonds)
  for (const token of game.tokenList) {
    if (game.collectedTokens.has(token.key)) continue;
    const dist = Math.abs(token.cx - cx) + Math.abs(token.cy - cy);
    if (dist < radius) {
      game.collectedTokens.add(token.key);
      playSound(game.assets.soundToken);
      game.tokenAnims.push({ x: token.x, y: token.y, timer: 0 });
    }
  }

  // Health pickups
  for (const heart of game.healthList) {
    if (game.collectedHealth.has(heart.key)) continue;
    if (game.player.health >= game.player.maxHealth) continue;
    const dist = Math.abs(heart.cx - cx) + Math.abs(heart.cy - cy);
    if (dist < radius) {
      game.collectedHealth.add(heart.key);
      game.player.health = Math.min(game.player.maxHealth, game.player.health + 1);
      game.healthDisplayTimer = HEALTH_DISPLAY_FRAMES;
      game.healthFadeTimer = HEALTH_FADE_FRAMES;
      playSound(game.assets.soundPop || game.assets.soundCoin);
      game.healthAnims.push({ x: heart.x, y: heart.y, timer: 0 });
    }
  }
  
  // Bubble powerup collection
  for (const bubble of game.bubblePowerupList) {
    if (game.collectedBubblePowerups.has(bubble.key)) continue;
    const dist = Math.abs(bubble.cx - cx) + Math.abs(bubble.cy - cy);
    if (dist < radius) {
      game.collectedBubblePowerups.add(bubble.key);
      game.player.bubbleMode = true;
      playSound(game.assets.soundPop || game.assets.soundCoin);
    }
  }
  
  // Hand powerup collection
  for (const hand of game.handPowerupList) {
    if (game.collectedHandPowerups.has(hand.key)) continue;
    const dist = Math.abs(hand.cx - cx) + Math.abs(hand.cy - cy);
    if (dist < radius) {
      game.collectedHandPowerups.add(hand.key);
      game.player.handPowerupMode = true;
      playSound(game.assets.soundCoin);
    }
  }

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

    // Update health pickup animations (4 frames after base frame)
    for (let i = game.healthAnims.length - 1; i >= 0; i--) {
      game.healthAnims[i].timer++;
      if (game.healthAnims[i].timer > 20) {
        game.healthAnims.splice(i, 1);
      }
    }

  // Surprise token collection animations
  for (let i = game.surpriseAnims.length - 1; i >= 0; i--) {
    game.surpriseAnims[i].timer++;
    if (game.surpriseAnims[i].timer > 28) {
      game.surpriseAnims.splice(i, 1);
    }
  }
}

function updateConfetti() {
  for (let i = game.confetti.length - 1; i >= 0; i--) {
    const p = game.confetti[i];
    p.life++;

    // Gentle gravity so pieces float down after popping up
    p.vy += 0.08;
    p.vx *= 0.99;
    p.vy = Math.min(p.vy, 2.2);

    p.x += p.vx;
    p.y += p.vy;

    // Cull when faded or far off-screen
    if (p.life > 90 || p.y - game.camera.y > game.height + 40) {
      game.confetti.splice(i, 1);
    }
  }
}

function spawnConfetti(cx, cy, count = 10) {
  const angleSpread = Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * angleSpread;
    const speed = 1 + Math.random() * 1.5;
    game.confetti.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: -Math.abs(Math.sin(angle) * speed) - 1.2,
      life: 0,
      face: Math.random() < 0.5 ? -1 : 1
    });
  }
}

function updatePlayer() {
  if (game.levelCompleted) return;

  const player = game.player;
  const maxSpeed = player.bubbleMode ? BUBBLE_PLAYER_SPEED : PLAYER_SPEED;

  //Start timer on first input (keyboard or controller)
  const hasKeyboardInput = game.keys.left || game.keys.right || game.keys.jump;
  
  // Check for gamepad input
  let hasControllerInput = false;
  if (game.gamepad.connected) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = game.gamepad.index !== null ? pads[game.gamepad.index] : null;
    if (pad) {
      const hasStickMovement = Math.abs(pad.axes[0] || 0) > 0.2 || Math.abs(pad.axes[1] || 0) > 0.2;
      const hasButtonPress = pad.buttons && pad.buttons.some(btn => btn && btn.pressed);
      hasControllerInput = hasStickMovement || hasButtonPress;
    }
  }
  
  if (!game.timer.started && (hasKeyboardInput || hasControllerInput)) {
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
  const gravity = player.bubbleMode ? BUBBLE_GRAVITY : GRAVITY;
  const maxFall = player.bubbleMode ? BUBBLE_MAX_FALL_SPEED : MAX_FALL_SPEED;
  player.velY = Math.min(player.velY + gravity, maxFall);

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
  // Currently touching wall - must be pressing into it
  if (player.touchingWallLeft && game.keys.left && player.wallJumpCooldown === 0) {
    return true;
  }
  // Coyote time - don't require direction key since we just left the wall
  if (player.wallCoyoteTimer > 0 && player.wallCoyoteDirection === -1 && player.wallJumpCooldown === 0) {
    return true;
  }
  return false;
}

function canPerformRightWallJump(player) {
  // Currently touching wall - must be pressing into it
  if (player.touchingWallRight && game.keys.right && player.wallJumpCooldown === 0) {
    return true;
  }
  // Coyote time - don't require direction key since we just left the wall
  if (player.wallCoyoteTimer > 0 && player.wallCoyoteDirection === 1 && player.wallJumpCooldown === 0) {
    return true;
  }
  return false;
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
  // Grant coyote time when we leave a wall (not touching anymore but were before)
  if (wasTouchingLeft && !player.touchingWallLeft && !player.onGround) {
    // Only if we have no coyote timer running OR if this is a new wall
    if (player.wallCoyoteTimer === 0 || player.wallCoyoteDirection !== -1) {
      player.wallCoyoteTimer = WALL_COYOTE_TIME;
      player.wallCoyoteDirection = -1;
    }
  }
  if (wasTouchingRight && !player.touchingWallRight && !player.onGround) {
    // Only if we have no coyote timer running OR if this is a new wall
    if (player.wallCoyoteTimer === 0 || player.wallCoyoteDirection !== 1) {
      player.wallCoyoteTimer = WALL_COYOTE_TIME;
      player.wallCoyoteDirection = 1;
    }
  }
}

function updateHorizontalMovement(player, maxSpeed) {
  const onGround = player.onGround;
  
  // Use bubble mode physics if active
  const acceleration = player.bubbleMode 
    ? (onGround ? BUBBLE_GROUND_ACCELERATION : BUBBLE_AIR_ACCELERATION)
    : (onGround ? GROUND_ACCELERATION : AIR_ACCELERATION);
  const friction = player.bubbleMode
    ? (onGround ? BUBBLE_GROUND_FRICTION : BUBBLE_AIR_FRICTION)
    : (onGround ? GROUND_FRICTION : AIR_FRICTION);

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
  if (game.levelCompleted) return;

  const player = game.player;

  if (player.attackCooldown > 0) player.attackCooldown--;
  if (player.attackTimer > 0) player.attackTimer--;
  if (player.attackAnimTimer > 0) player.attackAnimTimer--;

  // Queue attack if pressed during cooldown; fire when cooldown hits zero
  if (game.keys.attackPressed && player.attackCooldown > 0) {
    player.attackQueued = true;
  }

  const shouldAttack = (game.keys.attackPressed || player.attackQueued) && player.attackCooldown === 0;

  if (shouldAttack) {
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
    
    // Create bullet projectile if in hand powerup mode
    if (player.handPowerupMode) {
      const bulletSpeed = 4; // Slower bullets
      const spawnOffset = 16;
      const bullet = {
        x: player.x + player.width / 2 - 4 + (dirX * spawnOffset), // Spawn 16px in shot direction
        y: player.y + player.height / 2 - 4 + (dirY * spawnOffset),
        width: 8,
        height: 8,
        velX: dirX * bulletSpeed,
        velY: dirY * bulletSpeed,
        dirX: dirX,
        dirY: dirY
      };
      game.bullets.push(bullet);
      player.attackCooldown = 24; // Slower shooting animation
      playSound(game.assets.soundShoot);
    } else {
      player.attackCooldown = ATTACK_COOLDOWN;
      playSound(game.assets.soundSwish);
    }
    
    player.attackQueued = false;
    
    // In bubble mode, apply floating velocity
    if (player.bubbleMode) {
      // If both powerups are active, push in OPPOSITE direction (recoil)
      // If only bubble powerup, push in attack direction (normal)
      const multiplier = player.handPowerupMode ? -1 : 1;
      
      if (dirX !== 0) {
        player.velX = dirX * BUBBLE_ATTACK_FLOAT_SPEED * multiplier;
      }
      if (dirY !== 0) {
        player.velY = dirY * BUBBLE_ATTACK_FLOAT_SPEED * multiplier;
      }
    }
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

  // Toggle on/off switches via attack hit
  const switches = getCollidingTiles(hurtbox, true).filter(t => t.type === 'onoff_switch');
  if (switches.length && game.switchCooldown === 0) {
    game.switchState = !game.switchState;
    game.switchCooldown = 15;
    playSound(game.switchState ? game.assets.soundTurnOn : game.assets.soundTurnOff);
    // Bounce only on downward-facing attack (spike-like)
    if (player.attackDir.y > 0) {
      player.velY = BOUNCE_VELOCITY;
      player.onGround = false;
    }
  }

  // Surprise tokens: break into a health pickup, play animation, and spawn confetti
  const surpriseHits = getCollidingTiles(hurtbox, true).filter(t => t.type === 'surprise_token');
  let pogoFromSurprise = false;
  surpriseHits.forEach(tile => {
    const tx = Math.round(tile.x / TILE_SIZE);
    const ty = Math.round(tile.y / TILE_SIZE);
    const key = `${tx},${ty}`;
    // Guard against duplicate processing if already converted this frame
    if (game.tiles[key] !== 'surprise_token') return;

    game.tiles[key] = 'health';
    game.healthList.push({ key, x: tile.x, y: tile.y, cx: tile.x + TILE_SIZE / 2, cy: tile.y + TILE_SIZE / 2 });
    game.surpriseAnims.push({ x: tile.x, y: tile.y, timer: 0 });
    spawnConfetti(tile.x + TILE_SIZE / 2, tile.y + TILE_SIZE / 2, 12);
    playSound(game.assets.soundSurprisePop || game.assets.soundToken);

    if (player.attackDir.y > 0) pogoFromSurprise = true;
  });

  if (pogoFromSurprise) {
    player.velY = BOUNCE_VELOCITY;
    player.onGround = false;
  }

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

    // Damage enemies only if not using hand powerup (bullets do the damage instead)
    if (hitData.type === 'enemy' && !player.handPowerupMode) {
       const enemy = hitData.obj;
       damageEnemy(enemy, player.attackDir);
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

  const baseJump = player.bubbleMode ? BUBBLE_JUMP_VELOCITY : BASE_JUMP_VELOCITY;
  player.velY = baseJump + jumpBonus;
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
    player.isWallSliding = false;
    stopSlideSound();
    return;
  }
  
  if (isPlayerSlidingOnWall(player) && player.velY > 0) {
    player.isWallSliding = true;
    // Start playback if just started sliding
    if (!game.sliding) {
        game.sliding = true;
        playSound(game.assets.soundSlideInit);
        playSlideLoop();
    }

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
    player.isWallSliding = false;
    player.wallStickTimer = 0;
    stopSlideSound();
  }
}

function playSlideLoop() {
  if (game.slideLoopPlaying) return;
  
  if (game.assets.soundSlide) {
      // Use new playSound which handles WebAudio source creation
      game.slideLoopNode = playSound(game.assets.soundSlide, true);
      game.slideLoopPlaying = true;
  }
}

function stopSlideSound() {
    game.sliding = false;
    if (game.slideLoopPlaying && game.slideLoopNode) {
        try {
          game.slideLoopNode.stop();
        } catch (e) {
          // Ignore if already stopped
        }
        game.slideLoopNode = null;
        game.slideLoopPlaying = false;
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
  
  // Check if player is stuck/embedded inside a block (e.g., from onoff blocks activating)
  const playerBox = { x: player.x, y: player.y, width: player.width, height: player.height };
  const stuck = getCollidingTiles(playerBox).some((tile) => {
    if (!isSolidTile(tile.type)) return false;
    const overlapW = Math.min(playerBox.x + playerBox.width, tile.x + TILE_SIZE) - Math.max(playerBox.x, tile.x);
    const overlapH = Math.min(playerBox.y + playerBox.height, tile.y + TILE_SIZE) - Math.max(playerBox.y, tile.y);
    // Kill if significantly embedded (more than 3/4 of player's size)
    return overlapW > player.width * 0.75 && overlapH > player.height * 0.75;
  });
  
  if (stuck && !player.dead) {
    player.dead = true;
    playSound(game.assets.soundDeath);
  }
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

    if (enemy.invulnTimer > 0) {
      enemy.invulnTimer--;
    }
    if (enemy.healthDisplayTimer > 0) {
      enemy.healthDisplayTimer--;
      if (enemy.healthDisplayTimer <= HEALTH_FADE_FRAMES) {
        enemy.healthFadeTimer = enemy.healthDisplayTimer;
      } else {
        enemy.healthFadeTimer = HEALTH_FADE_FRAMES;
      }
    }

    if (enemy.dead) {
        enemy.velY = Math.min(enemy.velY + GRAVITY, MAX_FALL_SPEED);
        enemy.y += enemy.velY;
        return;
    }

    enemy.onGround = false;
    enemy.velY = Math.min(enemy.velY + GRAVITY, MAX_FALL_SPEED);

    // Horizontal movement (pause AI when in knockback)
    if (enemy.knockbackTimer > 0) {
      enemy.x += enemy.knockbackVelX;

      // Bounce off walls/spikes during knockback
      let enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
      const wallHits = getCollidingTiles(enemyBox, true).filter((tile) => isSolidTile(tile.type) || tile.type === 'spike');
      if (wallHits.length) {
        enemy.x -= enemy.knockbackVelX; // revert
        enemy.knockbackVelX *= -0.6;    // bounce and dampen
        enemy.x += enemy.knockbackVelX;
        enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
      }

      // Bounce off other enemies during knockback
      const hitEnemy = game.enemies.find(e => e !== enemy && e.active && !e.dead && rectsIntersect(enemyBox, e));
      if (hitEnemy) {
        enemy.x -= enemy.knockbackVelX;
        enemy.knockbackVelX *= -0.6;
        enemy.x += enemy.knockbackVelX;
        enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
      }

      enemy.knockbackVelX *= 0.82;
      enemy.knockbackTimer--;
    } else {
      // Handle turn timer
      if (enemy.turnTimer > 0) {
        enemy.turnTimer--;
        // Slow down during turn (20% speed)
        enemy.x += enemy.velX * enemy.direction * 0.2;
      } else {
        // Normal movement
        enemy.x += enemy.velX * enemy.direction;
      }
    }

    let enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };

    // Check tiles (Solid AND Spikes)
    const collisionsX = getCollidingTiles(enemyBox, true).filter((tile) => {
        return isSolidTile(tile.type) || tile.type === 'spike';
    });
    
    // Check other enemies
    const hitEnemy = game.enemies.find(e => e !== enemy && e.active && !e.dead && rectsIntersect(enemyBox, e));

    if (collisionsX.length || hitEnemy) {
      enemy.direction *= -1;
      enemy.turnTimer = 8; // 8 frames for turn animation
      // Move at full speed to get out of collision, then slow down will happen next frame
      enemy.x += enemy.velX * enemy.direction;
    }

    // Vertical movement
    enemy.y += enemy.velY;
    enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
    
    // Check for landing on other enemies (stand on top)
    if (enemy.velY > 0) {
      const enemyBelow = game.enemies.find(e => {
        if (e === enemy || !e.active || e.dead) return false;
        // Check if this enemy is directly below
        const horizontalOverlap = enemy.x < e.x + e.width && enemy.x + enemy.width > e.x;
        const verticalContact = enemy.y + enemy.height >= e.y && enemy.y + enemy.height <= e.y + 4;
        return horizontalOverlap && verticalContact;
      });
      
      if (enemyBelow) {
        enemy.y = enemyBelow.y - enemy.height;
        enemy.velY = 0;
        enemy.onGround = true;
      }
    }
    
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
    
    // Gentle horizontal separation if enemies overlap (but allow vertical stacking)
    enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
    const overlappingEnemy = game.enemies.find(e => e !== enemy && e.active && !e.dead && rectsIntersect(enemyBox, e));
    if (overlappingEnemy) {
      const overlapX = Math.min(enemy.x + enemy.width, overlappingEnemy.x + overlappingEnemy.width) - Math.max(enemy.x, overlappingEnemy.x);
      const overlapY = Math.min(enemy.y + enemy.height, overlappingEnemy.y + overlappingEnemy.height) - Math.max(enemy.y, overlappingEnemy.y);
      
      // Only push horizontally if there's significant side-by-side overlap
      // Allow vertical stacking (one on top of another)
      if (overlapX > 2 && overlapY < enemy.height - 2) {
        // Side-by-side collision, push apart gently
        const pushAmount = Math.min(overlapX * 0.3, 1.5); // Gentle push
        const oldX = enemy.x;
        
        if (enemy.x < overlappingEnemy.x) {
          enemy.x -= pushAmount;
        } else {
          enemy.x += pushAmount;
        }
        
        // Don't push into walls
        enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
        const inWall = getCollidingTiles(enemyBox, true).some(t => isSolidTile(t.type));
        if (inWall) {
          enemy.x = oldX; // Revert if pushed into wall
        }
      }
    }

    // Kill enemies embedded inside solids (avoid soft-locks)
    enemyBox = { x: enemy.x, y: enemy.y, width: enemy.width, height: enemy.height };
    const embedded = getCollidingTiles(enemyBox, true).some((tile) => {
      if (!isSolidTile(tile.type)) return false;
      const overlapW = Math.min(enemyBox.x + enemyBox.width, tile.x + TILE_SIZE) - Math.max(enemyBox.x, tile.x);
      const overlapH = Math.min(enemyBox.y + enemyBox.height, tile.y + TILE_SIZE) - Math.max(enemyBox.y, tile.y);
      // Kill only if deeply embedded (more than 80% of the enemy's size)
      return overlapW > enemy.width * 0.8 && overlapH > enemy.height * 0.8;
    });
    if (embedded) {
      enemy.dead = true;
      enemy.healthDisplayTimer = 0;
      enemy.healthFadeTimer = 0;
      return;
    }

    // Edge detection (only when grounded)
    if (enemy.onGround) {
      const frontX = enemy.direction > 0 ? enemy.x + enemy.width : enemy.x - 1;
      const footY = enemy.y + enemy.height + 1;
      // Check if there is solid ground OR a spike at foot position
      if (!isSolidAt(frontX, footY) && !isSpikeAt(frontX, footY)) {
        enemy.direction *= -1;
        enemy.turnTimer = 8; // 8 frames for turn animation
      }
    }
  });

  // Remove enemies that have fallen far off the map
  game.enemies = game.enemies.filter(e => e.y < (game.levelHeight + 5) * TILE_SIZE);
}

function updateBullets() {
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const bullet = game.bullets[i];
    
    // Move bullet
    bullet.x += bullet.velX;
    bullet.y += bullet.velY;
    
    let destroyed = false;
    
    // Check collision with enemies
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      if (rectsIntersect(bullet, enemy)) {
        // Damage enemy
        const attackDir = { x: Math.sign(bullet.velX) || 0, y: Math.sign(bullet.velY) || 0 };
        damageEnemy(enemy, attackDir);
        playSound(game.assets.soundPunch);
        destroyed = true;
        break;
      }
    }
    
    if (destroyed) {
      game.bullets.splice(i, 1);
      continue;
    }
    
    // Check collision with tiles
    const bulletBox = { x: bullet.x, y: bullet.y, width: bullet.width, height: bullet.height };
    const tiles = getCollidingTiles(bulletBox, true);
    
    for (const tile of tiles) {
      // Destroy on solid tiles
      if (isSolidTile(tile.type)) {
        destroyed = true;
        break;
      }
      
      // Destroy on spikes
      if (tile.type === 'spike' && spikeIntersect(bulletBox, tile)) {
        destroyed = true;
        break;
      }
      
      // Toggle switches
      if (tile.type === 'onoff_switch' && game.switchCooldown === 0) {
        game.switchState = !game.switchState;
        game.switchCooldown = 15;
        playSound(game.switchState ? game.assets.soundTurnOn : game.assets.soundTurnOff);
        destroyed = true;
        break;
      }
      
      // Pop surprise tokens
      if (tile.type === 'surprise_token') {
        const tx = Math.round(tile.x / TILE_SIZE);
        const ty = Math.round(tile.y / TILE_SIZE);
        const key = `${tx},${ty}`;
        
        if (game.tiles[key] === 'surprise_token') {
          game.tiles[key] = 'health';
          game.healthList.push({ key, x: tile.x, y: tile.y, cx: tile.x + TILE_SIZE / 2, cy: tile.y + TILE_SIZE / 2 });
          game.surpriseAnims.push({ x: tile.x, y: tile.y, timer: 0 });
          spawnConfetti(tile.x + TILE_SIZE / 2, tile.y + TILE_SIZE / 2, 12);
          playSound(game.assets.soundSurprisePop || game.assets.soundToken);
          destroyed = true;
          break;
        }
      }
    }
    
    if (destroyed) {
      game.bullets.splice(i, 1);
      continue;
    }
    
    // Remove bullets that are off screen
    if (bullet.x < -100 || bullet.x > game.levelWidth * TILE_SIZE + 100 ||
        bullet.y < -100 || bullet.y > game.levelHeight * TILE_SIZE + 100) {
      game.bullets.splice(i, 1);
    }
  }
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
  // Can't die if you've already won or are already dead
  if (game.player.dead || game.levelCompleted) return;

  const player = game.player;

  // Check bottom bound (kills player only when completely out of bounds)
  const bottomBound = game.levelHeight * TILE_SIZE;
  if (player.y > bottomBound) {
    killPlayer();
    return;
  }

  // Check spike collisions
  const nearbyTiles = getCollidingTiles(player, true);
  const spike = nearbyTiles.find((tile) => tile.type === 'spike' && spikeIntersect(player, tile));
  if (spike) {
    if (player.bubbleMode) {
      // Bounce up from spikes in bubble mode, but lose the powerup
      player.velY = BOUNCE_VELOCITY;
      player.onGround = false;
      player.bubbleMode = false;
      player.invulnTimer = INVULN_FRAMES;
      playSound(game.assets.soundPop || game.assets.soundHurt);
      vibrateGamepad(150, 0.4, 0.6);
    } else if (player.handPowerupMode) {
      // Lose hand powerup and get iframes
      player.handPowerupMode = false;
      player.invulnTimer = INVULN_FRAMES;
      playSound(game.assets.soundHurt);
      vibrateGamepad(150, 0.4, 0.6);
    } else {
      damagePlayer(spike);
    }
    return;
  }


  // Check enemy collisions
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    if (enemy.dead) continue;
    if (!rectsIntersect(player, enemy)) continue;
    
    // Check if stomping enemy (attacking from above)
    const isStomping = player.velY > 0 && player.y + player.height / 2 < enemy.y + enemy.height / 2;
    
    if (isStomping) {
      if (player.bubbleMode) {
        // Bubble mode: bounce off all enemies
        player.velY = BOUNCE_VELOCITY;
        player.onGround = false;
        // Kill regular enemies when stomping in bubble mode
        if (enemy.type !== 'spike_enemy') {
          enemy.dead = true;
          playSound(game.assets.soundPunch);
        } else {
          // Spike enemies: lose bubble powerup and get iframes
          player.bubbleMode = false;
          player.invulnTimer = INVULN_FRAMES;
          playSound(game.assets.soundPop || game.assets.soundHurt);
          vibrateGamepad(150, 0.4, 0.6);
        }
      } else if (player.handPowerupMode) {
        // Hand powerup: lose it and get iframes
        player.handPowerupMode = false;
        player.invulnTimer = INVULN_FRAMES;
        playSound(game.assets.soundHurt);
        vibrateGamepad(150, 0.4, 0.6);
      } else {
        // Regular mode: take damage (no stomp mechanic, must use attack to pogo)
        damagePlayer(enemy);
      }
    } else {
      // Side collision - take damage or lose powerup
      if (player.bubbleMode) {
        player.bubbleMode = false;
        player.invulnTimer = INVULN_FRAMES;
        playSound(game.assets.soundPop || game.assets.soundHurt);
        vibrateGamepad(150, 0.4, 0.6);
      } else if (player.handPowerupMode) {
        player.handPowerupMode = false;
        player.invulnTimer = INVULN_FRAMES;
        playSound(game.assets.soundHurt);
        vibrateGamepad(150, 0.4, 0.6);
      } else {
        damagePlayer(enemy);
      }
    }
    return;
  }
}

function killPlayer() {
  playSound(game.assets.soundHurt);
  playSound(game.assets.soundDead);
  game.player.dead = true;
  game.player.deathTimer = 0;
  game.player.deathVelY = 0;
  
  vibrateGamepad(400, 0.8, 1.0);
  
  stopSlideSound();
  game.player.velX = 0;
  game.player.velY = 0;
  
  // Clear attack state
  game.player.attackTimer = 0;
  game.player.attackAnimTimer = 0;
  game.player.attackCooldown = 0;
}

// Apply damage with invulnerability and knockback
function damagePlayer(source) {
  if (game.player.dead || game.levelCompleted) return;
  if (game.player.invulnTimer > 0) return;

  // Instant death if already at 1 HP
  if (game.player.health <= 1) {
    killPlayer();
    return;
  }

  game.player.health -= 1;
  game.player.invulnTimer = INVULN_FRAMES;
  game.healthDisplayTimer = HEALTH_DISPLAY_FRAMES;
  game.healthFadeTimer = HEALTH_FADE_FRAMES;
  playSound(game.assets.soundHurt);
  vibrateGamepad(150, 0.4, 0.6);

  // Knockback away from source
  let dir = 1;
  if (source && source.x !== undefined) {
    const srcCenter = (source.x + (source.width || TILE_SIZE) / 2);
    const playerCenter = game.player.x + game.player.width / 2;
    dir = playerCenter >= srcCenter ? 1 : -1;
  }
  if (dir === 0) dir = 1;
  game.player.velX = 4 * dir;
  game.player.velY = -4;
  game.player.onGround = false;
}

function damageEnemy(enemy, attackDir) {
  if (!enemy || enemy.dead) return { damaged: false };

  const downwardStrike = attackDir && attackDir.y > 0;

  // Spike enemies cannot be damaged from above, but still allow pogo elsewhere
  if (enemy.type === 'spike_enemy' && downwardStrike) {
    return { damaged: false, blocked: true };
  }

  if (enemy.invulnTimer > 0) {
    return { damaged: false, blocked: true };
  }

  // Knockback follows attack direction (horizontal only)
  let dir = attackDir && attackDir.x !== 0 ? Math.sign(attackDir.x) : 0;
  if (dir === 0) {
    const playerCenter = game.player.x + game.player.width / 2;
    const enemyCenter = enemy.x + enemy.width / 2;
    dir = playerCenter >= enemyCenter ? 1 : -1;
  }

  const knockback = 5.5;
  enemy.x += knockback * dir; // small instant push
  enemy.knockbackVelX = knockback * dir;
  enemy.knockbackTimer = 12;
  enemy.velX = ENEMY_BASE_SPEED + 0.3; // resume speed after knockback decays
  enemy.velY = 0;
  // Keep movement direction unchanged after hit; movement is paused while knockback runs
  enemy.onGround = false;
  enemy.active = true;

  enemy.invulnTimer = ENEMY_INVULN_FRAMES;
  enemy.healthDisplayTimer = HEALTH_DISPLAY_FRAMES;
  enemy.healthFadeTimer = HEALTH_FADE_FRAMES;

  enemy.health -= 1;
  if (enemy.health <= 0) {
    enemy.dead = true;
    enemy.velY = -3;
    enemy.invulnTimer = 0;
    enemy.healthDisplayTimer = 0;
    enemy.healthFadeTimer = 0;
    return { damaged: true, killed: true };
  }

  return { damaged: true, killed: false };
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

  renderBackgrounds();
  renderTiles();
  renderConfetti();
  renderEnemies();
  renderBullets();
  renderPlayer();
  renderHurtbox();
  renderTimer();
  // Grid removed
}

function renderBackgrounds() {
  const ctx = game.ctx;

  // Base clear color behind all layers
  const baseColor = game.background === 'forest' ? '#477238' : '#33272a';
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, game.width, game.height);

  if (game.background === 'night') {
    drawBgLayer(game.assets.bgNight3, 0.1, 0.1);          // far static
    drawBgLayer(game.assets.bgNight2, 0.2, 0.2);     // gentle parallax
    drawBgLayer(game.assets.bgNight1, 0.3, 0.25);    // closer, still subtle
  } else if (game.background === 'forest') {
    drawBgLayer(game.assets.bgForest3, 0.1, 0.2);
    drawBgLayer(game.assets.bgForest2, 0.2, 0.3);
    drawBgLayer(game.assets.bgForest1, 0.3, 0.4);
  }
}

function drawBgLayer(img, parallaxX, parallaxY) {
  if (!img) return;

  const ctx = game.ctx;

  // Horizontal parallax with looping (tile repeat)
  let startX = Math.floor(-(game.camera.x * parallaxX) % img.width);
  if (startX > 0) startX -= img.width;

  // Vertical parallax: use per-layer factor and clamp travel so tiny levels don't scroll too fast
  let offsetY;
  const verticalTravel = img.height - game.height;
  if (verticalTravel <= 0) {
    // Background shorter than view: pin to bottom
    offsetY = game.height - img.height;
  } else {
    const targetOffset = -game.camera.y * parallaxY;
    offsetY = clamp(targetOffset, -verticalTravel, 0);
  }

  for (let x = startX; x < game.width + img.width; x += img.width) {
    ctx.drawImage(img, Math.round(x), offsetY, img.width, img.height);
  }
}

function drawSpriteWithRotation(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, rotationDegrees = 0) {
  const rotation = normalizeRotation(rotationDegrees);
  if (!rotation) {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }

  const cx = dx + dw / 2;
  const cy = dy + dh / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function getHurtbox(player) {
  const reach = TILE_SIZE; // 16
  const thickness = 10; // Reduced from 16 to avoid grazing ground/walls
  const cx = player.x + player.width / 2;
  const cy = player.y + player.height / 2;

  if (player.attackDir.y !== 0) {
    // Vertical Attack
    return {
      x: cx - thickness / 2,
      y: cy - reach / 2 + (player.attackDir.y * reach),
      width: thickness,
      height: reach
    };
  } else {
    // Horizontal Attack
    return {
      x: cx - reach / 2 + (player.attackDir.x * reach),
      y: cy - thickness / 2,
      width: reach,
      height: thickness
    };
  }
}

function renderHurtbox() {
  const p = game.player;
  if (p.attackAnimTimer <= 0) return;
  const ctx = game.ctx;
  const hurtbox = getHurtbox(p);
  const screenX = hurtbox.x - game.camera.x;
  const screenY = hurtbox.y - game.camera.y;

  // Use finger gun sprite if in hand powerup mode, otherwise use regular punch
  const sprite = p.handPowerupMode ? game.assets.fingerGun : game.assets.playerPunch;
  
  if (sprite) {
    const centerX = screenX + hurtbox.width / 2;
    const centerY = screenY + hurtbox.height / 2;

    // Animation frame logic
    const totalFrames = 4;
    const progress = ATTACK_DURATION - p.attackAnimTimer; 
    let frame = Math.floor(progress / (ATTACK_DURATION / totalFrames));
    if (frame >= totalFrames) frame = totalFrames - 1;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Flip first based on player facing direction
    if (p.facing === -1 && p.attackDir.x === 0) {
      // Only flip for vertical attacks when facing left
      ctx.scale(-1, 1);
    }

    // Rotation logic
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
  return parseTileEntry(t).type === tileType;
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
      const tileEntry = game.tiles[`${x},${y}`];
      const { type, rotation } = parseTileEntry(tileEntry);
      if (!type) continue;
      
      const screenX = Math.round(x * TILE_SIZE - game.camera.x);
      const screenY = Math.round(y * TILE_SIZE - game.camera.y);
      
      if (type === 'spike' && game.assets.spike) {
        drawSpriteWithRotation(ctx, game.assets.spike, 0, 0, 16, 16, screenX, screenY, TILE_SIZE, TILE_SIZE, rotation);
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
      } else if (type === 'health') {
        if (!game.collectedHealth.has(`${x},${y}`) && game.assets.healthToken) {
             ctx.drawImage(game.assets.healthToken, 0, 0, 16, 16, screenX, screenY, 16, 16);
        }
      } else if (type === 'bubble_powerup') {
        if (!game.collectedBubblePowerups.has(`${x},${y}`) && game.assets.bubblePowerup) {
             ctx.drawImage(game.assets.bubblePowerup, 0, 0, 16, 16, screenX, screenY, 16, 16);
        }
      } else if (type === 'hand_powerup') {
        if (!game.collectedHandPowerups.has(`${x},${y}`) && game.assets.handPowerup) {
             ctx.drawImage(game.assets.handPowerup, 0, 0, 16, 16, screenX, screenY, 16, 16);
        }
      } else if (type === 'surprise_token') {
        if (game.assets.surpriseToken) {
          ctx.drawImage(game.assets.surpriseToken, 0, 0, 16, 16, screenX, screenY, 16, 16);
        }
      } else if (type === 'on_block') {
        if (game.assets.onBlock) {
          const frame = game.switchState ? 0 : 1; // solid/visible when switch is ON
          ctx.drawImage(game.assets.onBlock, frame * 16, 0, 16, 16, screenX, screenY, 16, 16);
        }
      } else if (type === 'off_block') {
        if (game.assets.offBlock) {
          const frame = game.switchState ? 1 : 0; // solid/visible when switch is OFF
          ctx.drawImage(game.assets.offBlock, frame * 16, 0, 16, 16, screenX, screenY, 16, 16);
        }
      } else if (type === 'onoff_switch') {
        if (game.assets.onoffSwitch) {
          // Frame 0 = OFF, Frame 1 = ON (per sprite sheet)
          const frame = game.switchState ? 1 : 0;
          ctx.drawImage(game.assets.onoffSwitch, frame * 16, 0, 16, 16, screenX, screenY, 16, 16);
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

        // Draw Health Animations (overlay) using last 4 frames of spritesheet
        game.healthAnims.forEach(anim => {
          if (!game.assets.healthToken) return;
          const screenX = Math.round(anim.x - game.camera.x);
          const screenY = Math.round(anim.y - game.camera.y);
          const frame = Math.min(3, Math.floor(anim.timer / 5)); // 4 frames
          const spriteFrame = 1 + frame; // skip idle frame 0
          ctx.drawImage(game.assets.healthToken, spriteFrame * 16, 0, 16, 16, screenX, screenY, 16, 16);
        });

        // Surprise token shatter animations
        if (game.assets.surpriseToken) {
          const frames = Math.max(1, Math.floor(game.assets.surpriseToken.width / 16));
          game.surpriseAnims.forEach(anim => {
            const screenX = Math.round(anim.x - game.camera.x);
            const screenY = Math.round(anim.y - game.camera.y);
            const frameIndex = Math.min(frames - 1, Math.floor(anim.timer / 4));
            const alpha = Math.max(0, 1 - anim.timer / 28);
            if (alpha <= 0) return;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.drawImage(game.assets.surpriseToken, frameIndex * 16, 0, 16, 16, screenX, screenY, 16, 16);
            ctx.restore();
          });
        }

  // Second pass: render ground tiles with autotiling
  // Iterate over all tiles in game.tiles instead of the full grid
  const tilesheet1 = game.assets.tilesheet;
  const tilesheet2 = game.assets.tilesheet2;
  const stoneBrickTilesheet = game.assets.stoneBrickTilesheet;
  const plankTilesheet = game.assets.plankTilesheet;
  
  for (const tile of game.groundTiles) {
    const { x, y, type } = tile;
    // Select the appropriate tilesheet based on tile type
    let tilesheet;
    if (type === 'ground') tilesheet = tilesheet2;
    else if (type === 'tile') tilesheet = tilesheet1;
    else if (type === 'stone_brick') tilesheet = stoneBrickTilesheet;
    else if (type === 'plank') tilesheet = plankTilesheet;
    
    const useTilesheet = tilesheet && tilesheet.width > 0;

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

function renderConfetti() {
  const ctx = game.ctx;
  const sprite = game.assets.confetti;

  game.confetti.forEach(p => {
    const screenX = Math.round(p.x - game.camera.x);
    const screenY = Math.round(p.y - game.camera.y);
    const alpha = Math.max(0, 1 - p.life / 90);
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(screenX, screenY);
    if (p.face && p.face < 0) ctx.scale(-1, 1);

    if (sprite) {
      const size = 8;
      ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(-2, -2, 4, 4);
    }
    ctx.restore();
  });
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
    
    const sprite = enemy.type === 'spike_enemy' ? game.assets.spikeEnemy : game.assets.enemyWalk;

    // Use global animation time for sync; honor full sprite sheet width (16px per frame)
    const frameCount = sprite && sprite.width ? Math.max(1, Math.floor(sprite.width / 16)) : 2;
    let frame = Math.floor(game.animTime / (1000 / frameRate)) % frameCount;

    if (enemy.dead) {
      frame = Math.min(frameCount - 1, 1); // prefer second frame for dead, clamp to available frames
    }
    
    const screenX = Math.round(enemy.x - game.camera.x);
    const screenY = Math.round(enemy.y - game.camera.y);
    
    if (sprite) {
      ctx.save();
      ctx.translate(screenX + enemy.width / 2, screenY + enemy.height);

      if (enemy.invulnTimer > 0) {
        ctx.globalAlpha = 0.6;
      }
      if (enemy.direction < 0) ctx.scale(-1, 1);
      if (enemy.dead) ctx.scale(1, -1);

      const frameHeight = enemy.type === 'spike_enemy' ? 20 : 16;
      const destW = enemy.width;
      const destH = enemy.height;
      ctx.drawImage(sprite, frame * 16, 0, 16, frameHeight, -destW / 2, -destH, destW, destH);
      ctx.restore();
    } else {
      drawTile(ctx, 'enemy', screenX, screenY, TILE_SIZE);
    }

    // Render enemy health pips when visible
    if (game.assets.enemyHealth && enemy.healthDisplayTimer > 0 && !enemy.dead) {
      const pipW = 6;
      const pipH = 6;
      const padding = -1;
      const totalWidth = enemy.maxHealth * (pipW + padding) - padding;
      const startX = Math.round(screenX + enemy.width / 2 - totalWidth / 2);
      const startY = Math.round(screenY - pipH - 6);

      const alpha = enemy.healthFadeTimer > 0 ? Math.max(0, enemy.healthFadeTimer / HEALTH_FADE_FRAMES) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      for (let i = 0; i < enemy.maxHealth; i++) {
      const filled = i < enemy.health;
      const frameX = filled ? 0 : 6;
      ctx.drawImage(game.assets.enemyHealth, frameX, 0, pipW, pipH, startX + i * (pipW + padding), startY, pipW, pipH);
      }
      ctx.restore();
    }
  });
}

function renderBullets() {
  const ctx = game.ctx;
  
  for (const bullet of game.bullets) {
    const screenX = Math.round(bullet.x - game.camera.x);
    const screenY = Math.round(bullet.y - game.camera.y);
    
    if (game.assets.bullet) {
      ctx.save();
      const centerX = screenX + bullet.width / 2;
      const centerY = screenY + bullet.height / 2;
      ctx.translate(centerX, centerY);
      
      // Rotate based on direction
      if (bullet.dirY < 0) { // Up
        ctx.rotate(-Math.PI / 2);
      } else if (bullet.dirY > 0) { // Down
        ctx.rotate(Math.PI / 2);
      } else if (bullet.dirX < 0) { // Left
        ctx.rotate(Math.PI);
      }
      // Right (dirX > 0) is default, no rotation needed
      
      ctx.drawImage(game.assets.bullet, 0, 0, 8, 8, -4, -4, 8, 8);
      ctx.restore();
    } else {
      // Fallback
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(screenX, screenY, bullet.width, bullet.height);
    }
  }
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
             p.wallStickTimer > 0) {
     sprite = game.assets.playerWallSlide;
     // Face towards the wall if sliding/clinging
     if (p.touchingWallLeft) flip = true;
     if (p.touchingWallRight) flip = false;
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
    if (p.invulnTimer > 0) {
      ctx.globalAlpha = 0.6;
    }
    
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
  
  // Render bubble overlay if in bubble mode
  if (p.bubbleMode && game.assets.bubble) {
    ctx.save();
    const cx = Math.floor(screenX + p.width / 2);
    const cy = Math.floor(screenY + p.height / 2);
    ctx.translate(cx, cy);
    // Draw 32x32 bubble centered on player
    ctx.drawImage(game.assets.bubble, 0, 0, 32, 32, -16, -16, 32, 32);
    ctx.restore();
  }
  
  // Render finger gun if in hand powerup mode (when not attacking)
  if (p.handPowerupMode && game.assets.fingerGun && p.attackAnimTimer <= 0) {
    ctx.save();
    const cx = Math.floor(screenX + p.width / 2);
    const cy = Math.floor(screenY + p.height / 2);
    ctx.translate(cx, cy);
    
    // Position gun 16 pixels in the direction the player is facing
    if (p.facing === -1) {
      ctx.scale(-1, 1);
      // When flipped, draw at 16 pixels (which becomes -16 after flip)
      ctx.drawImage(game.assets.fingerGun, 0, 0, 16, 16, 16 - 8, -8, 16, 16);
    } else {
      // Facing right, draw at 16 pixels
      ctx.drawImage(game.assets.fingerGun, 0, 0, 16, 16, 16 - 8, -8, 16, 16);
    }
    
    ctx.restore();
  }

  // Render health above the player
  if (game.assets.playerHealth && game.healthDisplayTimer > 0) {
    const heartW = 6;
    const heartH = 6;
    const padding = -1; // 3px closer than previous spacing
    const totalWidth = p.maxHealth * (heartW + padding) - padding;
    const startX = Math.round(screenX + p.width / 2 - totalWidth / 2);
    const startY = Math.round(screenY - heartH - 6);

    // Fade out near end
    const alpha = game.healthFadeTimer > 0 ? Math.max(0, game.healthFadeTimer / HEALTH_FADE_FRAMES) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    for (let i = 0; i < p.maxHealth; i++) {
      const filled = i < p.health;
      const frameX = filled ? 0 : 6; // two frames: filled then grey
      ctx.drawImage(game.assets.playerHealth, frameX, 0, heartW, heartH, startX + i * (heartW + padding), startY, heartW, heartH);
    }
    ctx.restore();
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
      const entry = game.tiles[key];
      const { type, rotation } = parseTileEntry(entry);
      if (!type) continue;
      const solid = isSolidTile(type);
      
      // For solid collision, skip non-solid tiles
      if (!includeHazards && !solid) continue;
      // For hazard/goal detection, include everything when includeHazards is true
      if (includeHazards || solid) {
        // Custom hitbox for goal: 3x40 pixels (2.5 tiles tall), centered horizontally, aligned to bottom
        if (type === 'goal') {
          const goalX = x * TILE_SIZE + (TILE_SIZE - 3) / 2; // Center horizontally
          const goalY = y * TILE_SIZE + TILE_SIZE - 40; // Align to bottom (40 pixels = 2.5 tiles)
          tiles.push({ x: goalX, y: goalY, width: 3, height: 40, type, rotation: 0 });
        } else {
          tiles.push({ x: x * TILE_SIZE, y: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE, type, rotation });
        }
      }
    }
  }
  
  // Additional check for goals that might be slightly outside the scan range
  // (goal is 40px tall but anchored to a single grid tile)
  if (includeHazards) {
    const expandMinY = Math.max(0, minY - 2);
    const expandMaxY = Math.min(game.levelHeight - 1, maxY + 2);
    
    for (let y = expandMinY; y <= expandMaxY; y++) {
      // Skip already-scanned rows
      if (y >= minY && y <= maxY) continue;
      
      for (let x = minX; x <= maxX; x++) {
        const key = `${x},${y}`;
        const entry = game.tiles[key];
        const { type, rotation } = parseTileEntry(entry);
        
        if (type === 'goal') {
          const goalX = x * TILE_SIZE + (TILE_SIZE - 3) / 2;
          const goalY = y * TILE_SIZE + TILE_SIZE - 40;
          const goalBox = { x: goalX, y: goalY, width: 3, height: 40, type, rotation: 0 };
          // Only add if it actually intersects with the entity
          if (rectsIntersect(entity, goalBox)) {
            tiles.push(goalBox);
          }
        }
      }
    }
  }

  return tiles;
}

function isSolidTile(type) {
  // Standard mapping: switch ON makes on_block solid; switch OFF makes off_block solid
  if (type === 'on_block') return game.switchState;
  if (type === 'off_block') return !game.switchState;
  return type === 'ground' || type === 'tile' || type === 'stone_brick' || type === 'plank';
}

function isSolidAt(px, py) {
  const x = Math.floor(px / TILE_SIZE);
  const y = Math.floor(py / TILE_SIZE);
  const { type } = parseTileEntry(game.tiles[`${x},${y}`]);
  return isSolidTile(type);
}

function isSpikeAt(px, py) {
  const x = Math.floor(px / TILE_SIZE);
  const y = Math.floor(py / TILE_SIZE);
  const { type } = parseTileEntry(game.tiles[`${x},${y}`]);
  return type === 'spike';
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function spikeIntersect(rect, tile) {
  const rotation = normalizeRotation(tile.rotation || 0);
  const triangle = getSpikeTriangle(tile.x, tile.y, rotation);
  return polygonIntersectsRect(triangle, rect);
}

const SPIKE_TRIANGLE = [
  { x: 8, y: 0 },
  { x: 1, y: 16 },
  { x: 15, y: 16 }
];

const SPIKE_ROT_CENTER = { x: 8, y: 8 };

function getSpikeTriangle(tx, ty, rotation) {
  const rad = (rotation * Math.PI) / 180;
  return SPIKE_TRIANGLE.map(p => rotatePoint(p, SPIKE_ROT_CENTER, rad)).map(p => ({ x: p.x + tx, y: p.y + ty }));
}

function rotatePoint(point, center, rad) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

function polygonIntersectsRect(polygon, rect) {
  const rectPoly = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];

  return polygonsOverlap(polygon, rectPoly);
}

function polygonsOverlap(a, b) {
  const axes = [...getAxes(a), ...getAxes(b)];
  for (const axis of axes) {
    const projA = projectPolygon(a, axis);
    const projB = projectPolygon(b, axis);
    if (projA.max < projB.min || projB.max < projA.min) return false;
  }
  return true;
}

function getAxes(poly) {
  const axes = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    const normal = { x: -edge.y, y: edge.x };
    const len = Math.hypot(normal.x, normal.y) || 1;
    axes.push({ x: normal.x / len, y: normal.y / len });
  }
  return axes;
}

function projectPolygon(poly, axis) {
  let min = poly[0].x * axis.x + poly[0].y * axis.y;
  let max = min;
  for (let i = 1; i < poly.length; i++) {
    const proj = poly[i].x * axis.x + poly[i].y * axis.y;
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }
  return { min, max };
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
  const mode = urlParams.get('mode');
  
  if (fromEditor) {
    // Return to editor after short delay
    setTimeout(() => {
      const target = levelId ? `/editor?id=${levelId}` : '/editor';
      window.location.href = target;
    }, 1500);
  } else if (mode === 'publish') {
    // If in publish mode, show completion message and allow publishing
    showPublishCompleteDialog(levelId);
  } else {
    // Show completion dialog for played levels and record stats
    recordLevelCompletion(levelId);
    
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
      <button id="continueBtn" style="
        background: #51cf66;
        color: white;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        border-radius: 4px;
        cursor: pointer;
        font-family: Roboto, sans-serif;
        margin-right: 8px;
      ">Continue to Level Page</button>
      <button id="closeDialog" style="
        background: #ddd;
        color: #333;
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
    
    document.getElementById('continueBtn').addEventListener('click', () => {
      window.location.href = `/level?id=${levelId}`;
    });
    
    document.getElementById('closeDialog').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
  }
}

// Record level completion
async function recordLevelCompletion(levelId) {
  if (!levelId) return;
  
  const completionTime = Math.floor(game.timer.finalTime / 1000);
  
  try {
    await fetch(`/api/levels/${levelId}/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        completed: true,
        completion_time: completionTime
      })
    });
  } catch (err) {
    console.error('Error recording completion:', err);
  }
}

// Show publish dialog
function showPublishDialog(levelId) {
  // This function is now deprecated - publishing happens from editor
  // Redirect back to editor for publishing
  window.location.href = `/editor?id=${levelId}`;
}

function showPublishCompleteDialog(levelId) {
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
  
  const seconds = Math.floor(game.timer.finalTime / 1000);
  const ms = Math.floor((game.timer.finalTime % 1000) / 10);
  const timeString = `${seconds}.${ms.toString().padStart(2, '0')}`;
  
  dialog.innerHTML = `
    <h2 style="margin: 0 0 16px 0; font-size: 32px; color: #51cf66;">Test Complete!</h2>
    <p style="font-size: 24px; margin: 16px 0; color: #212121;">Time: ${timeString}s</p>
    <p style="margin: 16px 0; color: #666;">Your level is ready to publish!</p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="backToEditor" style="
        background: #ddd;
        color: #333;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        border-radius: 4px;
        cursor: pointer;
        font-family: Roboto, sans-serif;
      ">Back to Editor</button>
      <button id="publishNow" style="
        background: #51cf66;
        color: white;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        border-radius: 4px;
        cursor: pointer;
        font-family: Roboto, sans-serif;
      ">Publish Now</button>
    </div>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  document.getElementById('backToEditor').addEventListener('click', () => {
    window.location.href = `/editor?id=${levelId}`;
  });
  
  document.getElementById('publishNow').addEventListener('click', async () => {
    // Attempt to publish using stored data from sessionStorage (set by editor)
    const publishData = sessionStorage.getItem('publishData');
    if (!publishData) {
      alert('Missing publish data. Please return to the editor and try again.');
      window.location.href = `/editor?id=${levelId}`;
      return;
    }
    
    const { title, description, thumbnail } = JSON.parse(publishData);
    
    try {
      const response = await fetch(`/api/levels/${levelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          description,
          published: true,
          thumbnail
        })
      });
      
      if (response.ok) {
        // Clear stored data
        sessionStorage.removeItem('publishData');
        
        // Show success message
        document.body.removeChild(overlay);
        const successOverlay = document.createElement('div');
        successOverlay.style.cssText = overlay.style.cssText;
        successOverlay.innerHTML = `
          <div style="${dialog.style.cssText}">
            <h2 style="margin: 0 0 16px 0; font-size: 32px; color: #4CAF50;">Level Published!</h2>
            <p style="margin: 16px 0;">Your level is now available for everyone to play.</p>
            <button onclick="window.location.href='/profile'" style="
              background: #4CAF50;
              color: white;
              border: none;
              padding: 12px 24px;
              font-size: 16px;
              border-radius: 4px;
              cursor: pointer;
              font-family: Roboto, sans-serif;
            ">View Profile</button>
          </div>
        `;
        document.body.appendChild(successOverlay);
      } else {
        const error = await response.json();
        alert(`Failed to publish: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error publishing level:', err);
      alert('Error publishing level. Please try again.');
    }
  });
}

// --- Pause Menu Handling ---

function pauseGame() {
  game.paused = true;
  game.pauseStartTime = Date.now();
  if (game.bgm && !game.bgm.paused) {
    game.bgm.pause();
  }
  showPauseMenu();
}

function resumeGame() {
  game.paused = false;
  game.waitingForFirstInput = false;
  
  // Clear all input states to prevent button presses from transferring to gameplay
  game.keys.jumpPressed = false;
  game.keys.attackPressed = false;
  
  // Clear keyboard state
  game.keyboard.left = false;
  game.keyboard.right = false;
  game.keyboard.up = false;
  game.keyboard.down = false;
  game.keyboard.jump = false;
  game.keyboard.attack = false;
  
  // Clear gamepad state
  game.gamepad.state = { left: false, right: false, up: false, down: false, jump: false, attack: false };
  
  // Sync gamepad prevButtons with current state to prevent button bleed-through
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (const p of pads) {
    if (p) {
      pad = p;
      break;
    }
  }
  
  if (pad && pad.buttons) {
    // Store actual current button state so next poll won't see them as "new" presses
    game.gamepad.prevButtons = pad.buttons.map(b => {
      if (!b) return false;
      if (b.pressed !== undefined) return b.pressed;
      if (typeof b.value === 'number') return b.value > 0.5;
      return false;
    });
  }
  
  // Update combined input state to reflect cleared inputs
  updateCombinedInputState();
  
  // If this is the very first start
  if (!game.started) {
      game.started = true;
      // Reset timer start point so we don't count the time spent in menu
      game.startTime = Date.now(); 
  } else if (game.pauseStartTime) {
      // Adjust start time to account for pause duration so the timer effectively stops
      const pauseDuration = Date.now() - game.pauseStartTime;
      game.startTime += pauseDuration;
      game.pauseStartTime = null;
  }

  // Also try to start music if not playing (unlock audio context)
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  if (game.bgm && game.bgm.paused) {
      game.bgm.play().catch(e => {});
  }
}

function showPauseMenu() {
  // If menu already exists, just show it
  let menu = document.getElementById('pauseMenu');
  
  if (!menu) {
    createPauseMenu();
    menu = document.getElementById('pauseMenu');
  }
  
  // Update content just in case
  updatePauseMenuContent();
  
  menu.style.display = 'flex';
}

function hidePauseMenu() {
  const menu = document.getElementById('pauseMenu');
  if (menu) {
    menu.style.display = 'none';
  }
}

function createPauseMenu() {
  const menu = document.createElement('div');
  menu.id = 'pauseMenu';
  menu.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    color: white;
    font-family: Roboto, sans-serif;
  `;
  
  // Content container
  const container = document.createElement('div');
  container.className = 'pause-content';
  container.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 32px;
    width: 90%;
    max-width: 500px;
    color: #212121;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    position: relative;
  `;
  
  // Title
  const title = document.createElement('h2');
  title.id = 'pauseTitle';
  title.style.cssText = `
    margin: 0 0 8px 0;
    color: #4CAF50;
    font-size: 28px;
  `;
  title.textContent = 'Level Title';

  // Creator
  const creator = document.createElement('div');
  creator.id = 'pauseCreator';
  creator.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 24px;
    color: #757575;
  `;
  
  // Stats Row (Record, Likes)
  const statsRow = document.createElement('div');
  statsRow.style.cssText = `
    display: flex;
    justify-content: space-around;
    margin-bottom: 24px;
    padding: 16px;
    background: #f5f5f5;
    border-radius: 8px;
  `;
  
  const recordBox = document.createElement('div');
  recordBox.innerHTML = `
    <div style="font-size: 12px; color: #757575;">Record</div>
    <div id="pauseRecord" style="font-weight: bold; font-size: 18px;">--:--</div>
  `;
  
  const likeBox = document.createElement('div');
  likeBox.innerHTML = `
    <div style="font-size: 12px; color: #757575;">Likes</div>
    <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
        <svg class="icon" style="width: 16px; height: 16px; fill: #4caf50;"><use href="icons.svg#icon-thumb-up"/></svg>
        <span id="pauseLikes" style="font-weight: bold; font-size: 18px;">0</span>
    </div>
  `;
  // Shortened the generic SVG icon for brevity in replacement string, assumed inline SVG or just text would be fine but user wanted it to look like the site
  // The site uses a lot of JS generated SVG or external. I put an inline SVG path for a generic thumb up.
  
  statsRow.appendChild(recordBox);
  statsRow.appendChild(likeBox);

  // Description
  const desc = document.createElement('div');
  desc.id = 'pauseDesc';
  desc.style.cssText = `
    margin-bottom: 32px;
    line-height: 1.5;
    max-height: 100px;
    overflow-y: auto;
    font-size: 14px;
    color: #424242;
    padding: 0 8px;
  `;
  desc.textContent = '';

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = `
    display: flex;
    gap: 16px;
    justify-content: center;
  `;
  
  const backBtn = document.createElement('button');
  backBtn.textContent = 'Exit Level';
  backBtn.style.cssText = `
    padding: 12px 24px;
    border: 1px solid #e0e0e0;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    color: #757575;
    font-weight: 500;
  `;
  backBtn.onmouseover = () => backBtn.style.background = '#f5f5f5';
  backBtn.onmouseout = () => backBtn.style.background = 'transparent';
  
  backBtn.onclick = () => {
      const id = new URLSearchParams(window.location.search).get('id');
      if (id && !id.startsWith('local-')) {
          window.location.href = `/level?id=${id}`;
      } else {
          window.location.href = '/';
      }
  };

  const startBtn = document.createElement('button');
  startBtn.id = 'pauseStartBtn';
  startBtn.textContent = 'Resume';
  startBtn.style.cssText = `
    padding: 12px 32px;
    border: none;
    background: #4CAF50;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    color: white;
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: background 0.2s;
  `;
  startBtn.onmouseover = () => startBtn.style.background = '#388E3C';
  startBtn.onmouseout = () => startBtn.style.background = '#4CAF50';
  
  startBtn.onclick = () => {
      hidePauseMenu();
      resumeGame();
  };

  btnRow.appendChild(backBtn);
  btnRow.appendChild(startBtn);
  
  // Assemble
  container.appendChild(title);
  container.appendChild(creator);
  container.appendChild(statsRow);
  container.appendChild(desc);
  container.appendChild(btnRow);
  menu.appendChild(container);
  
  document.body.appendChild(menu);
}

function updatePauseMenuContent() {
  const info = game.levelInfo || {};
  
  // Title
  const titleEl = document.getElementById('pauseTitle');
  if (titleEl) titleEl.textContent = info.title || game.currentLevelTitle || 'Untitled Level';
  
  // Creator
  const creatorEl = document.getElementById('pauseCreator');
  if (creatorEl) {
      if (info.creator_name) {
          const initials = (info.creator_name || 'GU').substring(0, 2).toUpperCase();

          creatorEl.innerHTML = `
            <a href="/profile?id=${info.creator_id}" style="text-decoration: none; display: flex; align-items: center; gap: 8px; color: inherit;">
                <div style="width: 32px; height: 32px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: #555;">
                  ${initials}
                </div>
                <span style="font-weight: 500;">${info.creator_name}</span>
            </a>
          `;
      } else {
          creatorEl.innerHTML = '<span style="font-style: italic;">Local Draft</span>';
      }
  }
  
  // Description
  const descEl = document.getElementById('pauseDesc');
  if (descEl) descEl.textContent = info.description || 'No description provided.';
  
  // Stats
  const likesEl = document.getElementById('pauseLikes');
  if (likesEl) likesEl.textContent = info.total_likes || 0;
  
  const recordEl = document.getElementById('pauseRecord');
  if (recordEl) {
      if (info.world_record_time) {
        const minutes = Math.floor(info.world_record_time / 60);
        const seconds = info.world_record_time % 60;
        recordEl.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
      } else {
        recordEl.textContent = '--:--';
      }
  }
  
  // Button Text
  const startBtn = document.getElementById('pauseStartBtn');
  if (startBtn) {
      startBtn.textContent = game.started ? 'Resume' : 'Start Level';
  }
}

document.addEventListener('DOMContentLoaded', initGame);
