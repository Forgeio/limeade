// Level Editor JavaScript

// Constants
const CAMERA_ACCELERATION = 1.5;
const CAMERA_FRICTION = 0.92;
const CAMERA_MAX_SPEED = 15;
const CAMERA_BOOST_SPEED = 40;
const CAMERA_BOOST_DELAY = 1000;
const MAX_DRAFTS_PER_USER = 8; // Must match backend constant

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
  velX: 0,
  velY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panCameraStartX: 0,
  panCameraStartY: 0,
  selectedTile: 'ground',
  levelData: {},
  spawnPosition: null, // Track spawn position
  goalPosition: null,  // Track goal position
  isDragging: false,
  lastSaveTime: Date.now(),
  autoSaveInterval: 5000, 
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
  },
  moveStartTime: 0,
  hasUnsavedChanges: false,
  isNewDraft: false,
  dragButton: null,
  mouseX: 0,
  mouseY: 0
};

let deleteConfirmResolver = null;

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
  // const draftSelector = document.getElementById('draftSelector'); // Removed
  // if (draftSelector) {
  //   draftSelector.addEventListener('change', handleDraftChange);
  // }
  
  // Setup mouse events
  editor.canvas.addEventListener('mousedown', handleMouseDown);
  editor.canvas.addEventListener('mousemove', handleMouseMove);
  editor.canvas.addEventListener('mouseup', handleMouseUp);
  editor.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  editor.canvas.addEventListener('wheel', handleWheel, { passive: false });
  
  // Setup keyboard controls
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  
  // Setup toolbar buttons
  document.getElementById('burgerBtn').addEventListener('click', toggleBurgerMenu);

  setupDeleteConfirmModal();
  // Reattach modal functions if they were called from inline HTML originally but we want listeners
  // But onclick attributes in HTML work fine for now.
  
  // Close burger menu when clicking outside
  document.addEventListener('click', (e) => {
    const container = document.querySelector('.burger-menu-container');
    if (container && !container.contains(e.target)) {
      document.getElementById('burgerDropdown').classList.remove('show');
    }
  });

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

function setupDeleteConfirmModal() {
  const modal = document.getElementById('deleteConfirmModal');
  if (!modal) return;

  const confirmBtn = document.getElementById('deleteConfirmBtn');
  const cancelBtn = document.getElementById('deleteCancelBtn');
  const closeBtn = document.getElementById('deleteCloseBtn');

  const closeModal = (result) => {
    modal.classList.remove('show');
    if (deleteConfirmResolver) {
      deleteConfirmResolver(result);
      deleteConfirmResolver = null;
    }
  };

  confirmBtn.addEventListener('click', () => closeModal(true));
  cancelBtn.addEventListener('click', () => closeModal(false));
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal(false));
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal(false);
    }
  });
}

function showDeleteConfirm(message) {
  const modal = document.getElementById('deleteConfirmModal');
  const messageEl = document.getElementById('deleteConfirmMessage');
  if (!modal || !messageEl) {
    return Promise.resolve(confirm(message));
  }

  if (deleteConfirmResolver) {
    deleteConfirmResolver(false);
  }

  messageEl.textContent = message;
  modal.classList.add('show');

  return new Promise((resolve) => {
    deleteConfirmResolver = resolve;
  });
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
  // Update mouse position
  updateMousePosition(e);
  
  // Middle mouse button (1) for panning
  if (e.button === 1) {
    e.preventDefault();
    editor.isPanning = true;
    editor.panStartX = editor.mouseX;
    editor.panStartY = editor.mouseY;
    editor.panCameraStartX = editor.cameraX;
    editor.panCameraStartY = editor.cameraY;
    editor.canvas.style.cursor = 'grabbing';
    
    // Attach window listeners for smooth dragging outside canvas
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return;
  }

  // Left/Right click for painting
  editor.isDragging = true;
  editor.dragButton = e.button;
  placeTile();
  
  // Attach window listeners to stop drag even if mouse leaves canvas
  window.addEventListener('mouseup', handleWindowMouseUp);
}

function handleWindowMouseMove(e) {
   if (editor.isPanning) {
       // We need to calculate mouse position relative to canvas even if mouse is outside
       const rect = editor.canvas.getBoundingClientRect();
       const currentMouseX = e.clientX - rect.left;
       const currentMouseY = e.clientY - rect.top;
       
       const deltaX = currentMouseX - editor.panStartX;
       const deltaY = currentMouseY - editor.panStartY;
       
       let newX = editor.panCameraStartX - deltaX;
       let newY = editor.panCameraStartY - deltaY;
       
       // Clamp values
       const maxX = Math.max(0, editor.gridWidth * editor.tileSize - editor.canvas.width);
       const maxY = Math.max(0, editor.gridHeight * editor.tileSize - editor.canvas.height);
       
       editor.cameraX = Math.max(0, Math.min(maxX, newX));
       editor.cameraY = Math.max(0, Math.min(maxY, newY));
   }
}

function handleWindowMouseUp(e) {
    if (editor.isPanning && e.button === 1) {
        editor.isPanning = false;
        editor.canvas.style.cursor = 'default';
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    }
    
    if (editor.isDragging) {
        editor.isDragging = false;
        editor.dragButton = null;
        window.removeEventListener('mouseup', handleWindowMouseUp);
    }
}

// Handle mouse move (for canvas)
function handleMouseMove(e) {
  updateMousePosition(e);
  
  // Only update position display here, panning is handled by window listener if active
  // But if we are panning strictly inside canvas, the window listener handles it too.
  // We keep this for position display and just in case.
  
  // Update position display
  const gridX = Math.floor((editor.mouseX + editor.cameraX) / editor.tileSize);
  const gridY = Math.floor((editor.mouseY + editor.cameraY) / editor.tileSize);
  
  document.getElementById('positionText').textContent = `Position: ${gridX}, ${gridY}`;
}

// Handle mouse up (for canvas)
function handleMouseUp(e) {
  // Logic moved to window listeners for robustness, but keep this to be safe or empty it
  // Actually emptying it is safer to avoid double-handling if events propagate
  // But since we use window listeners added on mousedown, we can rely on them.
}

// Update mouse position relative to canvas
function updateMousePosition(e) {
  const rect = editor.canvas.getBoundingClientRect();
  editor.mouseX = e.clientX - rect.left;
  editor.mouseY = e.clientY - rect.top;
}

// Place or remove tile
function placeTile() {
  const gridX = Math.floor((editor.mouseX + editor.cameraX) / editor.tileSize);
  const gridY = Math.floor((editor.mouseY + editor.cameraY) / editor.tileSize);
  
  // Check if within bounds
  if (gridX < 0 || gridX >= editor.gridWidth || gridY < 0 || gridY >= editor.gridHeight) {
    return;
  }
  
  const key = `${gridX},${gridY}`;
  
  // Only update if change actually happens to avoid setting flag unnecessarily
  let changed = false;

  // Right click (button 2) removes tiles
  if (editor.dragButton === 2) {
    if (editor.levelData[key]) {
      const tileType = editor.levelData[key];
      if (tileType === 'spawn') {
        editor.spawnPosition = null;
      } else if (tileType === 'goal') {
        editor.goalPosition = null;
      }
      delete editor.levelData[key];
      changed = true;
    }
  } else {
    // Left click places tiles
    // Avoid re-placing same tile
    if (editor.levelData[key] !== editor.selectedTile) {
      // Special handling for spawn and goal - only one allowed
      if (editor.selectedTile === 'spawn') {
        // Remove existing spawn
        if (editor.spawnPosition && editor.spawnPosition !== key) {
          delete editor.levelData[editor.spawnPosition];
        }
        editor.spawnPosition = key;
      } else if (editor.selectedTile === 'goal') {
        // Remove existing goal
        if (editor.goalPosition && editor.goalPosition !== key) {
          delete editor.levelData[editor.goalPosition];
        }
        editor.goalPosition = key;
      }
      editor.levelData[key] = editor.selectedTile;
      changed = true;
    }
  }

  if (changed) {
    editor.hasUnsavedChanges = true;
    updateStatus('Unsaved changes...'); 
  }
}

// Handle keyboard input
function handleKeyDown(e) {
  // Ignore movement keys if focused on text input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  if (e.key in editor.keys) {
    editor.keys[e.key] = true;
  }
}

function handleKeyUp(e) {
  // Always allow keys to be cleared to prevent stuck movement
  if (e.key in editor.keys) {
    editor.keys[e.key] = false;
  }
}

// Update camera position based on input with physics
function updateCamera() {
  const isMoving = 
    editor.keys.w || editor.keys.ArrowUp || 
    editor.keys.s || editor.keys.ArrowDown || 
    editor.keys.a || editor.keys.ArrowLeft || 
    editor.keys.d || editor.keys.ArrowRight;

  if (isMoving) {
    if (editor.moveStartTime === 0) {
      editor.moveStartTime = Date.now();
    }
  } else {
    editor.moveStartTime = 0;
  }

  // Calculate max speed based on duration
  let currentMaxSpeed = CAMERA_MAX_SPEED;
  if (editor.moveStartTime > 0) {
    const duration = Date.now() - editor.moveStartTime;
    if (duration > CAMERA_BOOST_DELAY) {
      currentMaxSpeed = CAMERA_BOOST_SPEED;
    }
  }

  // Apply acceleration
  if (editor.keys.w || editor.keys.ArrowUp) {
    editor.velY -= CAMERA_ACCELERATION;
  }
  if (editor.keys.s || editor.keys.ArrowDown) {
    editor.velY += CAMERA_ACCELERATION;
  }
  if (editor.keys.a || editor.keys.ArrowLeft) {
    editor.velX -= CAMERA_ACCELERATION;
  }
  if (editor.keys.d || editor.keys.ArrowRight) {
    editor.velX += CAMERA_ACCELERATION;
  }

  // Apply friction
  editor.velX *= CAMERA_FRICTION;
  editor.velY *= CAMERA_FRICTION;

  // Clamp velocity to max speed
  editor.velX = Math.max(-currentMaxSpeed, Math.min(currentMaxSpeed, editor.velX));
  editor.velY = Math.max(-currentMaxSpeed, Math.min(currentMaxSpeed, editor.velY));

  // Stop completely if very slow
  if (Math.abs(editor.velX) < 0.1) editor.velX = 0;
  if (Math.abs(editor.velY) < 0.1) editor.velY = 0;

  // Apply velocity to position
  editor.cameraX += editor.velX;
  editor.cameraY += editor.velY;

  // Clamp camera position to level bounds
  const maxX = Math.max(0, editor.gridWidth * editor.tileSize - editor.canvas.width);
  const maxY = Math.max(0, editor.gridHeight * editor.tileSize - editor.canvas.height);

  editor.cameraX = Math.max(0, Math.min(maxX, editor.cameraX));
  editor.cameraY = Math.max(0, Math.min(maxY, editor.cameraY));
}

// Game loop
function gameLoop() {
  updateCamera();
  if (editor.isDragging) {
    placeTile();
  }
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
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
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

  // Draw ghost tile
  if (!editor.isPanning) {
    const gridX = Math.floor((editor.mouseX + editor.cameraX) / editor.tileSize);
    const gridY = Math.floor((editor.mouseY + editor.cameraY) / editor.tileSize);
    
    // Check if within bounds
    if (gridX >= 0 && gridX < editor.gridWidth && gridY >= 0 && gridY < editor.gridHeight) {
      const screenX = gridX * editor.tileSize - editor.cameraX;
      const screenY = gridY * editor.tileSize - editor.cameraY;
      
      // Only draw ghost if there isn't already a tile of the same type there
      const key = `${gridX},${gridY}`;
      if (editor.levelData[key] !== editor.selectedTile) {
        ctx.globalAlpha = 0.5;
        drawTile(ctx, editor.selectedTile, screenX, screenY, editor.tileSize);
        ctx.globalAlpha = 1.0;
      }
    }
  }
  
  // Update level size display
  document.getElementById('levelSizeText').textContent = 
    `Level Size: ${editor.gridWidth}x${editor.gridHeight}`;
}

// Create a new draft
async function createNewDraft() {
  // Close the burger menu
  const burgerDropdown = document.getElementById('burgerDropdown');
  if (burgerDropdown) burgerDropdown.classList.remove('show');

  editor.levelId = null;
  editor.levelTitle = getNextDraftTitle();
  editor.isNewDraft = true;
  editor.levelData = {};
  editor.gridWidth = 50;
  editor.gridHeight = 20;

  // Update level name input
  const levelNameInput = document.getElementById('levelName');
  if (levelNameInput) {
    levelNameInput.value = editor.levelTitle;
  }
  
  updateStatus('New draft (unsaved)');

  // Check draft limit
  if (editor.drafts.length >= MAX_DRAFTS_PER_USER) {
      showMaxDraftsModal();
  }
}

function getNextDraftTitle() {
  const existingTitles = editor.drafts
    .map((draft) => (draft.title || '').trim())
    .filter(Boolean);

  let maxNumber = 0;
  existingTitles.forEach((title) => {
    const match = title.match(/^Level\s+(\d+)$/i);
    if (match) {
      const number = parseInt(match[1], 10);
      if (!Number.isNaN(number)) {
        maxNumber = Math.max(maxNumber, number);
      }
    }
  });

  return `Level ${maxNumber + 1}`;
}

// Max Drafts Modal Functions
function showMaxDraftsModal() {
  document.getElementById('maxDraftsModal').classList.add('show');
}

function closeMaxDraftsModal() {
  document.getElementById('maxDraftsModal').classList.remove('show');
}

function openManageDrafts() {
  closeMaxDraftsModal();
  openOpenLevelModal();
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
      // No longer updating dropdown
    }
  } catch (err) {
    console.error('Error loading drafts:', err);
    editor.drafts = [];
  }
}

// Burger Menu
function toggleBurgerMenu() {
  document.getElementById('burgerDropdown').classList.toggle('show');
}

// Open Level Modal
let currentOpenTab = 'drafts';

function openOpenLevelModal() {
  const modal = document.getElementById('openLevelModal');
  modal.classList.add('show');
  document.getElementById('burgerDropdown').classList.remove('show'); // Close menu
  switchOpenModalTab('drafts');
}

function closeOpenLevelModal() {
  document.getElementById('openLevelModal').classList.remove('show');
}

function switchOpenModalTab(tab) {
  currentOpenTab = tab;
  
  // Update UI
  const tabs = document.querySelectorAll('.modal-tabs .tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  
  // Find button by text content roughly or onclick handler usually
  // But let's use the exact buttons from HTML
  // Or simpler:
  const btns = document.querySelectorAll('.modal-tabs .tab-btn');
  if (tab === 'drafts') btns[0].classList.add('active');
  else btns[1].classList.add('active');
  
  loadOpenModalContent();
}

async function loadOpenModalContent() {
  const container = document.getElementById('levelListContainer');
  container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 24px;">Loading...</div>';
  
  const user = typeof checkAuth === 'function' ? checkAuth() : null;
  if (!user) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 24px;">Please log in to view levels</div>';
    return;
  }

  try {
    let items = [];
    if (currentOpenTab === 'drafts') {
      // We might already have drafts loaded
      await loadUserDrafts(); // Refresh to be safe
      items = editor.drafts;
    } else {
      // Fetch published
       const response = await fetch(`/api/users/${user.id}/levels`);
       if (response.ok) {
         const data = await response.json();
         items = data.levels || [];
       }
    }
    
    renderLevelList(items, currentOpenTab);
  } catch (err) {
    console.error('Error loading levels:', err);
    container.innerHTML = '<div style="text-align: center; color: #ff6b6b; padding: 24px;">Error loading levels</div>';
  }
}

function renderLevelList(items, type) {
  const container = document.getElementById('levelListContainer');
  
  if (items.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">No ${type} found.</div>`;
    return;
  }
  
  container.innerHTML = items.map(item => {
    const date = new Date(item.updated_at || item.published_at);
    const dateStr = date.toLocaleDateString();
    const stats = type === 'published' 
      ? `Plays: ${item.total_plays} • Likes: ${item.total_likes}`
      : `Last edited: ${dateStr}`;
      
    // Properly escape strings
    const titleEscaped = item.title ? item.title.replace(/"/g, '&quot;') : 'Untitled';
    const id = item.id;
    
    return `
      <div class="level-list-item" onclick="loadLevelAndClose('${id}')">
        <div class="level-item-info">
          <h3>${titleEscaped}</h3>
          <div class="level-item-meta">
            <span class="level-tag ${type === 'drafts' ? 'draft' : 'published'}">${type === 'drafts' ? 'Draft' : 'Published'}</span>
            <span>${stats}</span>
          </div>
        </div>
        <div class="level-item-actions">
          <button class="icon-btn delete" onclick="deleteLevelItem(event, '${id}', '${type}')" title="Delete">
            <svg class="icon"><use href="icons.svg#icon-delete-outline"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function loadLevelAndClose(id) {
  // If we are already editing this level, just close
  // Check if we need to save current first?
  // loadLevel handles switching
  await loadLevel(id);
  closeOpenLevelModal();
}

async function deleteLevelItem(e, id, type) {
  e.stopPropagation();
  
  const confirmed = await showDeleteConfirm('Are you sure you want to delete this level? This cannot be undone.');
  if (!confirmed) {
    return;
  }
  
  try {
    // If it's the current level being edited
    const isCurrent = (editor.levelId == id); // Loose equality for string/number mix
    
    if (String(id).startsWith('local-')) {
       localStorage.removeItem('levelDraft-' + id);
    } else {
       const response = await fetch(`/api/levels/${id}`, { method: 'DELETE' });
       if (!response.ok) throw new Error('Failed to delete');
    }
    
    // Refresh list
    await loadOpenModalContent();
    
    // If we deleted the current level, create a new draft
    if (isCurrent) {
      createNewDraft();
    }
    
    updateStatus('Level deleted');
  } catch (err) {
    console.error('Error deleting:', err);
    alert('Failed to delete level');
  }
}

// Update the draft selector dropdown
function updateDraftSelector() {
  // Deprecated - removed from UI
}

// Handle draft selector change
async function handleDraftChange(e) {
  // Deprecated
}

// Handle level name change
async function handleLevelNameChange(e) {
  const newTitle = e.target.value.trim();
  
  if (newTitle && newTitle !== editor.levelTitle) {
    editor.levelTitle = newTitle;
    editor.hasUnsavedChanges = true;
    autoSave();
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
      
      // Update URL
      const newUrl = `${window.location.pathname}?id=${levelId}`;
      window.history.replaceState({}, '', newUrl);

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
  if (!editor.hasUnsavedChanges) {
    return;
  }
  
  // If it's a new draft that hasn't been created on server yet
  if (editor.isNewDraft && !editor.levelId) {
    try {
      const user = typeof checkAuth === 'function' ? checkAuth() : null;
      if (!user) {
        // Local storage fallback for guests
        editor.levelId = 'local-' + Date.now();
        localStorage.setItem('levelDraft-' + editor.levelId, JSON.stringify({
          width: editor.gridWidth,
          height: editor.gridHeight,
          tiles: editor.levelData
        }));
        editor.isNewDraft = false;
        editor.hasUnsavedChanges = false;
        updateStatus('Saved (local)');
        return;
      }

      const response = await fetch('/api/levels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editor.levelTitle,
          description: '',
          level_data: {
            width: editor.gridWidth,
            height: editor.gridHeight,
            tiles: editor.levelData
          }
        })
      });

      if (response.ok) {
        const level = await response.json();
        editor.levelId = level.id;
        editor.isNewDraft = false;
        editor.hasUnsavedChanges = false;
        updateStatus('Draft saved');
        
        // Update URL
        const newUrl = `${window.location.pathname}?id=${level.id}`;
        window.history.replaceState({}, '', newUrl);
        
        // Refresh drafts list
        loadUserDrafts();
      } else {
        const error = await response.json();
         console.error('Error creating level:', error);
      }
    } catch (err) {
      console.error('Error creating draft:', err);
    }
    return;
  }

  if (!editor.levelId) {
    return;
  }
  
  // Skip if using local storage
  if (String(editor.levelId).startsWith('local-')) {
    // Save to local storage
    localStorage.setItem('levelDraft-' + editor.levelId, JSON.stringify({
      width: editor.gridWidth,
      height: editor.gridHeight,
      tiles: editor.levelData
    }));
    editor.hasUnsavedChanges = false;
    updateStatus('Saved (local)');
    return;
  }
  
  try {
    const response = await fetch(`/api/levels/${editor.levelId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: editor.levelTitle,
        level_data: {
          width: editor.gridWidth,
          height: editor.gridHeight,
          tiles: editor.levelData
        }
      })
    });
    
    if (response.ok) {
      editor.lastSaveTime = Date.now();
      editor.hasUnsavedChanges = false;
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
  const params = new URLSearchParams();

  if (editor.levelId) {
    params.set('id', editor.levelId);
  } else {
    sessionStorage.setItem('testLevelData', JSON.stringify({
      width: editor.gridWidth,
      height: editor.gridHeight,
      tiles: editor.levelData
    }));
    params.set('source', 'session');
  }

  params.set('from', 'editor');
  window.location.href = `play.html?${params.toString()}`;
}

// Publish level (placeholder)
function publishLevel() {
  alert('Publish functionality coming soon!');
}

// Delete the current draft - Deprecated helper, moving logic to deleteLevelItem
async function deleteDraft() {
  if (!editor.levelId) return;
  // Redirect to using new function internally if button still existed
  await deleteLevelItem({ stopPropagation: () => {} }, editor.levelId, 'drafts');
}

// Handle mouse wheel (touchpad scrolling)
function handleWheel(e) {
  e.preventDefault();
  
  // Update camera based on scroll delta
  editor.cameraX += e.deltaX;
  editor.cameraY += e.deltaY;
  
  // Clamp values
  const maxX = Math.max(0, editor.gridWidth * editor.tileSize - editor.canvas.width);
  const maxY = Math.max(0, editor.gridHeight * editor.tileSize - editor.canvas.height);
  
  editor.cameraX = Math.max(0, Math.min(maxX, editor.cameraX));
  editor.cameraY = Math.max(0, Math.min(maxY, editor.cameraY));
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initEditor);
