// Level Editor JavaScript

// Constants
const CAMERA_MOVE_SPEED = 8;

// Editor state
const editor = {
  levelId: null,
  levelTitle: '',
  canvas: null,
  ctx: null,
  gridWidth: 50,
  gridHeight: 20,
  tileSize: 32,
  cameraX: 0,
  cameraY: 0,
  selectedTile: 'ground',
  levelData: {},
  spawnPosition: null, // Track spawn position
  goalPosition: null,  // Track goal position
  isDragging: false,
  lastSaveTime: Date.now(),
  autoSaveInterval: 5000, // Auto-save every 5 seconds
  drafts: [], // Store user's drafts
  keys: {
    w: false,
    a: false,
    s: false,
    d: false,
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false
  }
};

// Tile colors for rendering
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

// Initialize the editor
function initEditor() {
  editor.canvas = document.getElementById('editorCanvas');
  editor.ctx = editor.canvas.getContext('2d');
  
  // Set canvas size
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Setup tile selector
  setupTileSelector();
  
  // Setup level name input
  const levelNameInput = document.getElementById('levelName');
  if (levelNameInput) {
    levelNameInput.addEventListener('change', handleLevelNameChange);
    levelNameInput.addEventListener('blur', handleLevelNameChange);
  }
  
  // Setup draft selector
  const draftSelector = document.getElementById('draftSelector');
  if (draftSelector) {
    draftSelector.addEventListener('change', handleDraftChange);
  }
  
  // Setup mouse events
  editor.canvas.addEventListener('mousedown', handleMouseDown);
  editor.canvas.addEventListener('mousemove', handleMouseMove);
  editor.canvas.addEventListener('mouseup', handleMouseUp);
  editor.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Setup keyboard controls
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  
  // Setup toolbar buttons
  document.getElementById('resizeBtn').addEventListener('click', openResizeModal);
  document.getElementById('testBtn').addEventListener('click', testLevel);
  document.getElementById('publishBtn').addEventListener('click', publishLevel);
  
  // Load user's drafts first
  loadUserDrafts().then(() => {
    // Create a new draft or load existing one
    const urlParams = new URLSearchParams(window.location.search);
    const levelId = urlParams.get('id');
    
    if (levelId) {
      loadLevel(levelId);
    } else {
      createNewDraft();
    }
  });
  
  // Start auto-save and render loops
  setInterval(autoSave, editor.autoSaveInterval);
  requestAnimationFrame(gameLoop);
}

// Resize canvas to fill container
function resizeCanvas() {
  const container = document.querySelector('.editor-container');
  editor.canvas.width = container.clientWidth;
  editor.canvas.height = container.clientHeight;
  render();
}

// Setup tile selector buttons
function setupTileSelector() {
  const tileBtns = document.querySelectorAll('.tile-btn');
  tileBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tileBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      editor.selectedTile = btn.dataset.tile;
    });
  });
  
  // Set first tile as active
  tileBtns[0]?.classList.add('active');
}

// Handle mouse down
function handleMouseDown(e) {
  editor.isDragging = true;
  placeTile(e);
}

// Handle mouse move
function handleMouseMove(e) {
  if (editor.isDragging) {
    placeTile(e);
  }
  
  // Update position display
  const rect = editor.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const gridX = Math.floor((mouseX + editor.cameraX) / editor.tileSize);
  const gridY = Math.floor((mouseY + editor.cameraY) / editor.tileSize);
  
  document.getElementById('positionText').textContent = `Position: ${gridX}, ${gridY}`;
}

// Handle mouse up
function handleMouseUp(e) {
  editor.isDragging = false;
}

// Place or remove tile
function placeTile(e) {
  const rect = editor.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const gridX = Math.floor((mouseX + editor.cameraX) / editor.tileSize);
  const gridY = Math.floor((mouseY + editor.cameraY) / editor.tileSize);
  
  // Check if within bounds
  if (gridX < 0 || gridX >= editor.gridWidth || gridY < 0 || gridY >= editor.gridHeight) {
    return;
  }
  
  const key = `${gridX},${gridY}`;
  
  // Right click (button 2) removes tiles
  if (e.button === 2) {
    const tileType = editor.levelData[key];
    if (tileType === 'spawn') {
      editor.spawnPosition = null;
    } else if (tileType === 'goal') {
      editor.goalPosition = null;
    }
    delete editor.levelData[key];
  } else {
    // Left click (button 0) places tiles
    // Special handling for spawn and goal - only one allowed
    if (editor.selectedTile === 'spawn') {
      // Remove existing spawn
      if (editor.spawnPosition) {
        delete editor.levelData[editor.spawnPosition];
      }
      editor.spawnPosition = key;
    } else if (editor.selectedTile === 'goal') {
      // Remove existing goal
      if (editor.goalPosition) {
        delete editor.levelData[editor.goalPosition];
      }
      editor.goalPosition = key;
    }
    editor.levelData[key] = editor.selectedTile;
  }
  
  render();
}

// Handle keyboard input
function handleKeyDown(e) {
  if (e.key in editor.keys) {
    editor.keys[e.key] = true;
  }
}

function handleKeyUp(e) {
  if (e.key in editor.keys) {
    editor.keys[e.key] = false;
  }
}

// Update camera position based on input
function updateCamera() {
  if (editor.keys.w || editor.keys.ArrowUp) {
    editor.cameraY = Math.max(0, editor.cameraY - CAMERA_MOVE_SPEED);
  }
  if (editor.keys.s || editor.keys.ArrowDown) {
    const maxY = Math.max(0, editor.gridHeight * editor.tileSize - editor.canvas.height);
    editor.cameraY = Math.min(maxY, editor.cameraY + CAMERA_MOVE_SPEED);
  }
  if (editor.keys.a || editor.keys.ArrowLeft) {
    editor.cameraX = Math.max(0, editor.cameraX - CAMERA_MOVE_SPEED);
  }
  if (editor.keys.d || editor.keys.ArrowRight) {
    const maxX = Math.max(0, editor.gridWidth * editor.tileSize - editor.canvas.width);
    editor.cameraX = Math.min(maxX, editor.cameraX + CAMERA_MOVE_SPEED);
  }
}

// Game loop
function gameLoop() {
  updateCamera();
  render();
  requestAnimationFrame(gameLoop);
}

// Render the level
function render() {
  const ctx = editor.ctx;
  const canvas = editor.canvas;
  
  // Clear canvas
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 1;
  
  const startX = Math.floor(editor.cameraX / editor.tileSize);
  const startY = Math.floor(editor.cameraY / editor.tileSize);
  const endX = Math.min(editor.gridWidth, startX + Math.ceil(canvas.width / editor.tileSize) + 1);
  const endY = Math.min(editor.gridHeight, startY + Math.ceil(canvas.height / editor.tileSize) + 1);
  
  // Draw vertical grid lines
  for (let x = startX; x <= endX; x++) {
    const screenX = x * editor.tileSize - editor.cameraX;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvas.height);
    ctx.stroke();
  }
  
  // Draw horizontal grid lines
  for (let y = startY; y <= endY; y++) {
    const screenY = y * editor.tileSize - editor.cameraY;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(canvas.width, screenY);
    ctx.stroke();
  }
  
  // Draw tiles
  Object.keys(editor.levelData).forEach(key => {
    const [x, y] = key.split(',').map(Number);
    const tileType = editor.levelData[key];
    const screenX = x * editor.tileSize - editor.cameraX;
    const screenY = y * editor.tileSize - editor.cameraY;
    
    // Only draw if visible
    if (screenX + editor.tileSize >= 0 && screenX < canvas.width &&
        screenY + editor.tileSize >= 0 && screenY < canvas.height) {
      drawTile(ctx, tileType, screenX, screenY, editor.tileSize);
    }
  });
  
  // Update level size display
  document.getElementById('levelSizeText').textContent = 
    `Level Size: ${editor.gridWidth}x${editor.gridHeight}`;
}

// Draw a single tile
function drawTile(ctx, type, x, y, size) {
  const padding = 2;
  
  switch (type) {
    case 'ground':
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
      break;
      
    case 'tile':
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
      ctx.strokeStyle = '#c92a2a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
      break;
      
    case 'enemy':
      ctx.fillStyle = '#845ef7';
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2 - padding * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5f3dc4';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
      
    case 'spike':
      ctx.fillStyle = '#495057';
      ctx.beginPath();
      ctx.moveTo(x + padding, y + size - padding);
      ctx.lineTo(x + size/2, y + padding);
      ctx.lineTo(x + size - padding, y + size - padding);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#212529';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
      
    case 'spawn':
      ctx.fillStyle = '#51cf66';
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2 - padding * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2f9e44';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Draw 'S' text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', x + size/2, y + size/2);
      break;
      
    case 'goal':
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
      ctx.strokeStyle = '#fab005';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
      // Draw 'G' text
      ctx.fillStyle = '#000';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('G', x + size/2, y + size/2);
      break;
      
    case 'coin':
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2 - padding * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffa500';
      ctx.lineWidth = 2;
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
      ctx.fillStyle = '#4dabf7';
      ctx.fillRect(-size/3, -size/3, size * 2/3, size * 2/3);
      ctx.strokeStyle = '#1c7ed6';
      ctx.lineWidth = 2;
      ctx.strokeRect(-size/3, -size/3, size * 2/3, size * 2/3);
      ctx.restore();
      break;
  }
}

// Create a new draft
async function createNewDraft() {
  try {
    // Check if checkAuth function exists (from navigation.js)
    const user = typeof checkAuth === 'function' ? checkAuth() : null;
    if (!user) {
      alert('You must be logged in to create levels');
      window.location.href = 'login.html';
      return;
    }
    
    const response = await fetch('/api/levels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: '', // Will get default name from backend
        description: '',
        level_data: {
          width: editor.gridWidth,
          height: editor.gridHeight,
          tiles: {}
        }
      })
    });
    
    if (response.ok) {
      const level = await response.json();
      editor.levelId = level.id;
      editor.levelTitle = level.title;
      
      // Update level name input
      const levelNameInput = document.getElementById('levelName');
      if (levelNameInput) {
        levelNameInput.value = level.title;
      }
      
      updateStatus('Draft created');
      
      // Update URL without reloading
      const newUrl = `${window.location.pathname}?id=${level.id}`;
      window.history.replaceState({}, '', newUrl);
      
      // Reload drafts to include the new one
      await loadUserDrafts();
      
      // Select the new draft in the dropdown
      const draftSelector = document.getElementById('draftSelector');
      if (draftSelector) {
        draftSelector.value = level.id;
      }
    } else {
      const error = await response.json();
      if (error.error === 'Maximum draft limit reached (8 drafts)') {
        alert('You have reached the maximum limit of 8 drafts. Please delete or publish some drafts before creating new ones.');
      } else {
        // If backend auth fails, use local storage for demo
        console.log('Using local storage for draft');
        editor.levelId = 'local-' + Date.now();
        editor.levelTitle = 'New Level (local)';
        updateStatus('Ready (local mode)');
      }
    }
  } catch (err) {
    console.error('Error creating draft:', err);
    // Fall back to local storage
    editor.levelId = 'local-' + Date.now();
    editor.levelTitle = 'New Level (local)';
    updateStatus('Ready (local mode)');
  }
}

// Load user's drafts
async function loadUserDrafts() {
  try {
    const user = typeof checkAuth === 'function' ? checkAuth() : null;
    if (!user) {
      return;
    }
    
    const response = await fetch(`/api/users/${user.id}/drafts`);
    
    if (response.ok) {
      const data = await response.json();
      editor.drafts = data.drafts || [];
      
      // Update draft selector dropdown
      updateDraftSelector();
    }
  } catch (err) {
    console.error('Error loading drafts:', err);
    editor.drafts = [];
  }
}

// Update the draft selector dropdown
function updateDraftSelector() {
  const draftSelector = document.getElementById('draftSelector');
  if (!draftSelector) return;
  
  // Clear existing options
  draftSelector.innerHTML = '';
  
  // Add "Create New" option
  const createNewOption = document.createElement('option');
  createNewOption.value = 'new';
  createNewOption.textContent = '+ Create New Draft';
  draftSelector.appendChild(createNewOption);
  
  // Add separator
  if (editor.drafts.length > 0) {
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '──────────';
    draftSelector.appendChild(separator);
  }
  
  // Add drafts
  editor.drafts.forEach(draft => {
    const option = document.createElement('option');
    option.value = draft.id;
    option.textContent = draft.title || 'Untitled';
    draftSelector.appendChild(option);
  });
  
  // Select current draft if any
  if (editor.levelId) {
    draftSelector.value = editor.levelId;
  }
}

// Handle draft selector change
async function handleDraftChange(e) {
  const selectedValue = e.target.value;
  
  if (selectedValue === 'new') {
    // Create a new draft
    await createNewDraft();
  } else if (selectedValue) {
    // Load the selected draft
    await loadLevel(selectedValue);
    
    // Update URL
    const newUrl = `${window.location.pathname}?id=${selectedValue}`;
    window.history.replaceState({}, '', newUrl);
  }
}

// Handle level name change
async function handleLevelNameChange(e) {
  const newTitle = e.target.value.trim();
  
  if (newTitle && newTitle !== editor.levelTitle) {
    editor.levelTitle = newTitle;
    
    // Save the title immediately
    if (editor.levelId && !editor.levelId.startsWith('local-')) {
      try {
        await fetch(`/api/levels/${editor.levelId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: newTitle
          })
        });
        
        updateStatus('Title saved');
        setTimeout(() => updateStatus('Ready'), 2000);
        
        // Reload drafts to update the dropdown
        await loadUserDrafts();
      } catch (err) {
        console.error('Error saving title:', err);
      }
    }
  }
}

// Load an existing level
async function loadLevel(levelId) {
  try {
    const response = await fetch(`/api/levels/${levelId}`);
    
    if (response.ok) {
      const level = await response.json();
      editor.levelId = level.id;
      editor.levelTitle = level.title || '';
      
      // Update level name input
      const levelNameInput = document.getElementById('levelName');
      if (levelNameInput) {
        levelNameInput.value = editor.levelTitle;
      }
      
      if (level.level_data) {
        editor.gridWidth = level.level_data.width || 50;
        editor.gridHeight = level.level_data.height || 20;
        editor.levelData = level.level_data.tiles || {};
        
        // Restore spawn and goal positions
        Object.keys(editor.levelData).forEach(key => {
          if (editor.levelData[key] === 'spawn') {
            editor.spawnPosition = key;
          } else if (editor.levelData[key] === 'goal') {
            editor.goalPosition = key;
          }
        });
      }
      
      updateStatus('Level loaded');
      render();
    } else {
      updateStatus('Error loading level');
      createNewDraft();
    }
  } catch (err) {
    console.error('Error loading level:', err);
    updateStatus('Error loading level');
    createNewDraft();
  }
}

// Auto-save the level
async function autoSave() {
  if (!editor.levelId) {
    return;
  }
  
  // Skip if using local storage
  if (editor.levelId.startsWith('local-')) {
    // Save to local storage
    localStorage.setItem('levelDraft-' + editor.levelId, JSON.stringify({
      width: editor.gridWidth,
      height: editor.gridHeight,
      tiles: editor.levelData
    }));
    return;
  }
  
  try {
    const response = await fetch(`/api/levels/${editor.levelId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        level_data: {
          width: editor.gridWidth,
          height: editor.gridHeight,
          tiles: editor.levelData
        }
      })
    });
    
    if (response.ok) {
      editor.lastSaveTime = Date.now();
      updateStatus('Auto-saved');
      setTimeout(() => updateStatus('Ready'), 2000);
    }
  } catch (err) {
    console.error('Error auto-saving:', err);
  }
}

// Update status text
function updateStatus(text) {
  document.getElementById('statusText').textContent = text;
}

// Resize modal functions
function openResizeModal() {
  const modal = document.getElementById('resizeModal');
  document.getElementById('levelWidth').value = editor.gridWidth;
  document.getElementById('levelHeight').value = editor.gridHeight;
  modal.classList.add('show');
}

function closeResizeModal() {
  const modal = document.getElementById('resizeModal');
  modal.classList.remove('show');
}

function applyResize() {
  const width = parseInt(document.getElementById('levelWidth').value);
  const height = parseInt(document.getElementById('levelHeight').value);
  
  if (width >= 10 && width <= 200 && height >= 10 && height <= 100) {
    const oldWidth = editor.gridWidth;
    const oldHeight = editor.gridHeight;
    
    editor.gridWidth = width;
    editor.gridHeight = height;
    
    // Resize from bottom-left corner
    // This means we need to shift tiles vertically when height changes
    const heightDiff = height - oldHeight;
    
    if (heightDiff !== 0) {
      // Create a new levelData object with shifted positions
      const newLevelData = {};
      
      Object.keys(editor.levelData).forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const newY = y + heightDiff;
        
        // Only keep tiles that are still within bounds
        if (x < width && newY >= 0 && newY < height) {
          const newKey = `${x},${newY}`;
          newLevelData[newKey] = editor.levelData[key];
          
          // Update spawn and goal positions
          if (editor.levelData[key] === 'spawn') {
            editor.spawnPosition = newKey;
          } else if (editor.levelData[key] === 'goal') {
            editor.goalPosition = newKey;
          }
        } else {
          // Tile is out of bounds, remove it
          const tileType = editor.levelData[key];
          if (tileType === 'spawn') {
            editor.spawnPosition = null;
          } else if (tileType === 'goal') {
            editor.goalPosition = null;
          }
        }
      });
      
      editor.levelData = newLevelData;
    } else {
      // Only width changed, just remove tiles outside new width bounds
      Object.keys(editor.levelData).forEach(key => {
        const [x, y] = key.split(',').map(Number);
        if (x >= width || y >= height) {
          const tileType = editor.levelData[key];
          if (tileType === 'spawn') {
            editor.spawnPosition = null;
          } else if (tileType === 'goal') {
            editor.goalPosition = null;
          }
          delete editor.levelData[key];
        }
      });
    }
    
    render();
    closeResizeModal();
    updateStatus('Level resized');
  } else {
    alert('Please enter valid dimensions (Width: 10-200, Height: 10-100)');
  }
}

// Test level (placeholder)
function testLevel() {
  alert('Test functionality coming soon!');
}

// Publish level (placeholder)
function publishLevel() {
  alert('Publish functionality coming soon!');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initEditor);
