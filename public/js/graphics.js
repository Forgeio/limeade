// Shared graphics constants and functions

// Tile colors (used when spritesheets are not loaded)
const TILE_COLORS = {
  ground: '#8b4513',
  tile: '#ff6b6b',
  enemy: '#845ef7',
  spike: '#495057',
  spawn: '#51cf66',
  goal: '#ffd43b',
  coin: '#ffd700',
  diamond: '#4dabf7'
};

// Animation support structure
const ANIMATION_FRAMES = {
  // Future: enemy walk animation frames, coin spin, etc.
  // Example: enemy: { frames: 2, speed: 10 }
};

// Spritesheet configuration (for future use)
const SPRITESHEET_CONFIG = {
  loaded: false,
  image: null,
  tileSize: 32,
  // Future: tile positions in spritesheet
  // Example: ground: { x: 0, y: 0, variants: 4 }
};

// Global animation frame counter (for future use with sprite animations)
// Will be incremented by render functions that need it
let animationFrame = 0;

// Autotiling support (dual-grid method preparation)
// This will be used to automatically select tile variants based on neighbors
function getAutotileVariant(tileType, x, y, tiles) {
  // Future: Implement dual-grid autotiling
  // Check neighboring tiles and return appropriate variant
  // For now, return base variant
  return 0;
}

function getTileNeighbors(x, y, tiles) {
  // Helper to get neighboring tile types for autotiling
  return {
    top: tiles[`${x},${y-1}`] || null,
    bottom: tiles[`${x},${y+1}`] || null,
    left: tiles[`${x-1},${y}`] || null,
    right: tiles[`${x+1},${y}`] || null,
    topLeft: tiles[`${x-1},${y-1}`] || null,
    topRight: tiles[`${x+1},${y-1}`] || null,
    bottomLeft: tiles[`${x-1},${y+1}`] || null,
    bottomRight: tiles[`${x+1},${y+1}`] || null
  };
}


// Draw a single tile
// Parameters:
//   ctx: Canvas context
//   type: Tile type (ground, enemy, etc.)
//   x, y: Screen position
//   size: Tile size in pixels
//   variant: (optional) Tile variant for autotiling (default: 0)
//   frame: (optional) Animation frame (default: 0)
function drawTile(ctx, type, x, y, size, variant = 0, frame = 0) {
  // Future: If spritesheet is loaded, draw from spritesheet
  // if (SPRITESHEET_CONFIG.loaded) {
  //   drawFromSpritesheet(ctx, type, x, y, size, variant, frame);
  //   return;
  // }
  
  // Fallback to color-based rendering
  const padding = 0;
  const inset = 2;
  const smallInset = 4;
  const strokeInset = 0.5;
  const strokeSize = size - 1;
  
  switch (type) {
    case 'ground':
      ctx.fillStyle = TILE_COLORS.ground;
      ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + strokeInset, y + strokeInset, strokeSize, strokeSize);
      break;
      
    case 'tile':
      ctx.fillStyle = TILE_COLORS.tile;
      ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
      ctx.strokeStyle = '#c92a2a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + strokeInset, y + strokeInset, strokeSize, strokeSize);
      break;
      
    case 'enemy':
      ctx.fillStyle = TILE_COLORS.enemy;
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2 - padding, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5f3dc4';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
      
    case 'spike':
      ctx.fillStyle = TILE_COLORS.spike;
      ctx.beginPath();
      ctx.moveTo(x + inset, y + size - inset);
      ctx.lineTo(x + size / 2, y + inset);
      ctx.lineTo(x + size - inset, y + size - inset);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#212529';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
      
    case 'spawn':
      ctx.fillStyle = TILE_COLORS.spawn;
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2 - padding, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2f9e44';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Draw 'S' text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', x + size/2, y + size/2);
      break;
      
    case 'goal':
      ctx.fillStyle = TILE_COLORS.goal;
      ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
      ctx.strokeStyle = '#fab005';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + strokeInset, y + strokeInset, strokeSize, strokeSize);
      // Draw 'G' text
      ctx.fillStyle = '#000';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('G', x + size/2, y + size/2);
      break;
      
    case 'coin':
      ctx.fillStyle = TILE_COLORS.coin;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 - smallInset, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffa500';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Draw '$' text
      ctx.fillStyle = '#000';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', x + size/2, y + size/2);
      break;
      
    case 'diamond':
      ctx.save();
      ctx.translate(x + size/2, y + size/2);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = TILE_COLORS.diamond;
      ctx.fillRect(-(size - smallInset * 2) / 2, -(size - smallInset * 2) / 2, size - smallInset * 2, size - smallInset * 2);
      ctx.strokeStyle = '#1c7ed6';
      ctx.lineWidth = 1;
      ctx.strokeRect(-(size - smallInset * 2) / 2 + strokeInset, -(size - smallInset * 2) / 2 + strokeInset, size - smallInset * 2 - 1, size - smallInset * 2 - 1);
      ctx.restore();
      break;
      
    // Default fallback
    default:
        ctx.fillStyle = '#999';
        ctx.fillRect(x, y, size, size);
        break;
  }
}

// Helper function to load spritesheet (for future use)
function loadSpritesheet(imagePath, onLoad) {
  const img = new Image();
  img.onload = () => {
    SPRITESHEET_CONFIG.image = img;
    SPRITESHEET_CONFIG.loaded = true;
    if (onLoad) onLoad();
  };
  img.onerror = () => {
    console.warn('Failed to load spritesheet, using fallback colors');
  };
  img.src = imagePath;
}

// Helper to draw from spritesheet (for future implementation)
function drawFromSpritesheet(ctx, type, x, y, size, variant, frame) {
  // Future: Extract correct sprite from spritesheet based on type, variant, and frame
  // ctx.drawImage(SPRITESHEET_CONFIG.image, sx, sy, sw, sh, x, y, size, size);
}
