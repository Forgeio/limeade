// Shared graphics constants and functions

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


// Draw a single tile
function drawTile(ctx, type, x, y, size) {
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
