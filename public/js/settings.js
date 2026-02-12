// Settings Page Logic

let currentUser = null;
let vibrationsEnabled = true;
const defaultKeyboard = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  jump: 'ArrowUp',
  attack: 'Space'
};

const defaultGamepad = {
  dpadLeft: 14,
  dpadRight: 15,
  dpadUp: 12,
  dpadDown: 13,
  buttonJump: 0,   // A
  buttonAttack: 7  // RT (Right Trigger)
};

let currentControls = {
  keyboard: { ...defaultKeyboard },
  gamepad: { ...defaultGamepad }
};
let capturingKey = null;
let capturingGamepad = null;
let keydownHandler = null;
let gamepadPollHandle = null;

const avatarSheets = {
    background: 'graphics/avatars/background.png',
    body: 'graphics/avatars/body.png',
    face: 'graphics/avatars/face.png',
    accessory: 'graphics/avatars/accessory.png'
};
const avatarImages = {};
const avatarSelection = {
    background: 0,
    body: 0,
    face: 0,
    accessory: 0
};
const AVATAR_TILE_SIZE = 32;

function captureGamepad(action) {
    const el = document.querySelector(`[data-action="gamepad-${action}"]`);
    if (!el) return;

    // Cancel keyboard capture if active
    cancelKeyCapture();
    stopGamepadCapture();

    capturingGamepad = action;
    el.textContent = 'Press a gamepad button... (ESC to cancel)';
    el.style.background = 'var(--primary-color)';
    el.style.color = 'white';

    document.addEventListener('keydown', cancelGamepadOnEsc);
    gamepadPollHandle = requestAnimationFrame(pollCaptureFrame);
}

function pollCaptureFrame() {
    if (!capturingGamepad) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads.find(p => p);
    if (pad) {
        pad.buttons.forEach((b, idx) => {
            if (b && b.pressed && capturingGamepad) {
                currentControls.gamepad[capturingGamepad] = idx;
                stopGamepadCapture();
                updateControlsDisplay();
            }
        });
    }
    if (capturingGamepad) {
        gamepadPollHandle = requestAnimationFrame(pollCaptureFrame);
    }
}

function cancelGamepadOnEsc(e) {
    if (e.code === 'Escape') {
        stopGamepadCapture();
    }
}

function stopGamepadCapture() {
    if (!capturingGamepad) return;
    const el = document.querySelector(`[data-action="gamepad-${capturingGamepad}"]`);
    if (el) {
        el.style.background = '';
        el.style.color = '';
        updateControlsDisplay();
    }
    capturingGamepad = null;
    document.removeEventListener('keydown', cancelGamepadOnEsc);
    if (gamepadPollHandle) {
        cancelAnimationFrame(gamepadPollHandle);
        gamepadPollHandle = null;
    }
}

async function initSettingsPage() {
    if (!document.getElementById('settingsAvatar')) return;

    // Load user data from API
    try {
        const response = await fetch('/auth/user');
        if (response.ok) {
            currentUser = await response.json();
            populateSettings(currentUser);
        }
    } catch (err) {
        console.error('Error loading user:', err);
    }

    bindAvatarEditor();
}

document.addEventListener('DOMContentLoaded', initSettingsPage);
window.addEventListener('spa:navigate', initSettingsPage);

function populateSettings(user) {
    const usernameInput = document.getElementById('usernameInput');
    const settingsAvatar = document.getElementById('settingsAvatar');
    const saveUsernameBtn = document.getElementById('saveUsernameBtn');

    if (usernameInput) {
        usernameInput.value = user.username || '';
        
        // Add input listener to show/hide save button
        usernameInput.addEventListener('input', () => {
            const hasChanged = usernameInput.value.trim() !== (user.username || '');
            if (hasChanged && usernameInput.value.trim().length >= 3) {
                saveUsernameBtn.classList.add('visible');
            } else {
                saveUsernameBtn.classList.remove('visible');
            }
        });
    }

    if (settingsAvatar) {
        const name = user.username || 'GU';
        setAvatarElement(settingsAvatar, user.avatar_url, name);
    }
    
    // Load control scheme
    if (user.control_scheme) {
        const cs = user.control_scheme;
        const keyboard = cs.keyboard ? { ...defaultKeyboard, ...cs.keyboard } : { ...cs };
        const gamepad = cs.gamepad ? { ...defaultGamepad, ...cs.gamepad } : { ...defaultGamepad };
        currentControls = { keyboard, gamepad };
    } else {
        currentControls = { keyboard: { ...defaultKeyboard }, gamepad: { ...defaultGamepad } };
    }
    updateControlsDisplay();
    
    // Load vibration preference
    vibrationsEnabled = user.vibrations_enabled !== false;
    const vibrationsCheckbox = document.getElementById('vibrationsEnabled');
    if (vibrationsCheckbox) {
        vibrationsCheckbox.checked = vibrationsEnabled;
    }
    
    // Check if user can change username
    checkUsernameChangeAvailability(user);
}

function setAvatarElement(el, avatarUrl, nameFallback) {
    if (!el) return;
    if (avatarUrl) {
        el.innerHTML = `<img class="avatar-image" src="${avatarUrl}" alt="${nameFallback}">`;
    } else {
        const initials = (nameFallback || 'GU').substring(0, 2).toUpperCase();
        el.textContent = initials;
    }
}

function bindAvatarEditor() {
    const settingsAvatar = document.getElementById('settingsAvatar');
    const overlay = document.getElementById('avatarEditorOverlay');
    const closeBtn = document.getElementById('closeAvatarEditor');
    const saveBtn = document.getElementById('saveAvatarSelection');
    const resetBtn = document.getElementById('resetAvatarSelection');

    if (settingsAvatar && !settingsAvatar.dataset.bound) {
        settingsAvatar.dataset.bound = 'true';
        settingsAvatar.addEventListener('click', openAvatarEditor);
    }

    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = 'true';
        closeBtn.addEventListener('click', closeAvatarEditor);
    }

    if (overlay && !overlay.dataset.bound) {
        overlay.dataset.bound = 'true';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeAvatarEditor();
            }
        });
    }

    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = 'true';
        saveBtn.addEventListener('click', saveAvatar);
    }

    if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.dataset.bound = 'true';
        resetBtn.addEventListener('click', () => {
            avatarSelection.background = 0;
            avatarSelection.body = 0;
            avatarSelection.face = 0;
            avatarSelection.accessory = 0;
            renderAvatarGrids();
            renderAvatarPreview();
        });
    }
}

async function openAvatarEditor() {
    const overlay = document.getElementById('avatarEditorOverlay');
    if (!overlay) return;

    await loadAvatarSheets();
    loadSavedAvatarSelection();
    renderAvatarGrids();
    renderAvatarPreview();

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
}

function closeAvatarEditor() {
    const overlay = document.getElementById('avatarEditorOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
}

function loadSavedAvatarSelection() {
    if (!currentUser || !currentUser.id) return;
    const raw = localStorage.getItem(`avatarSelection:${currentUser.id}`);
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        ['background', 'body', 'face', 'accessory'].forEach((layer) => {
            if (typeof parsed[layer] === 'number') {
                avatarSelection[layer] = parsed[layer];
            }
        });
    } catch (e) {
        // ignore
    }
}

function saveAvatarSelectionState() {
    if (!currentUser || !currentUser.id) return;
    localStorage.setItem(`avatarSelection:${currentUser.id}`, JSON.stringify(avatarSelection));
}

async function loadAvatarSheets() {
    const entries = Object.entries(avatarSheets);
    const tasks = entries.map(([key, src]) => {
        if (avatarImages[key]) return Promise.resolve();
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                avatarImages[key] = img;
                resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
        });
    });
    await Promise.all(tasks);
}

function renderAvatarGrids() {
    renderAvatarGrid('background', 'avatarGridBackground');
    renderAvatarGrid('body', 'avatarGridBody');
    renderAvatarGrid('face', 'avatarGridFace');
    renderAvatarGrid('accessory', 'avatarGridAccessory');
}

function renderAvatarGrid(layer, containerId) {
    const container = document.getElementById(containerId);
    const img = avatarImages[layer];
    if (!container || !img) return;

    container.innerHTML = '';

    const cols = Math.floor(img.width / AVATAR_TILE_SIZE);
    const rows = Math.floor(img.height / AVATAR_TILE_SIZE);
    const total = cols * rows;

    for (let index = 0; index < total; index++) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'avatar-tile';
        if (avatarSelection[layer] === index) tile.classList.add('selected');
        tile.dataset.index = String(index);

        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_TILE_SIZE;
        canvas.height = AVATAR_TILE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const sx = (index % cols) * AVATAR_TILE_SIZE;
        const sy = Math.floor(index / cols) * AVATAR_TILE_SIZE;
        ctx.drawImage(img, sx, sy, AVATAR_TILE_SIZE, AVATAR_TILE_SIZE, 0, 0, AVATAR_TILE_SIZE, AVATAR_TILE_SIZE);

        tile.appendChild(canvas);
        tile.addEventListener('click', () => {
            avatarSelection[layer] = index;
            saveAvatarSelectionState();
            renderAvatarGrids();
            renderAvatarPreview();
        });

        container.appendChild(tile);
    }
}

function renderAvatarPreview() {
    const canvas = document.getElementById('avatarPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = canvas.width / AVATAR_TILE_SIZE;
    drawAvatarLayer(ctx, 'background', scale);
    drawAvatarLayer(ctx, 'body', scale);
    drawAvatarLayer(ctx, 'face', scale);
    drawAvatarLayer(ctx, 'accessory', scale);
}

function drawAvatarLayer(ctx, layer, scale) {
    const img = avatarImages[layer];
    if (!img) return;
    const cols = Math.floor(img.width / AVATAR_TILE_SIZE);
    const index = avatarSelection[layer] || 0;
    const sx = (index % cols) * AVATAR_TILE_SIZE;
    const sy = Math.floor(index / cols) * AVATAR_TILE_SIZE;
    ctx.drawImage(img, sx, sy, AVATAR_TILE_SIZE, AVATAR_TILE_SIZE, 0, 0, AVATAR_TILE_SIZE * scale, AVATAR_TILE_SIZE * scale);
}

function buildAvatarDataUrl() {
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_TILE_SIZE;
    canvas.height = AVATAR_TILE_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawAvatarLayer(ctx, 'background', 1);
    drawAvatarLayer(ctx, 'body', 1);
    drawAvatarLayer(ctx, 'face', 1);
    drawAvatarLayer(ctx, 'accessory', 1);
    return canvas.toDataURL('image/png');
}

async function saveAvatar() {
    if (!currentUser) return;
    const avatarData = buildAvatarDataUrl();

    try {
        const response = await fetch(`/api/users/${currentUser.id}/avatar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar_data: avatarData })
        });

        if (!response.ok) {
            console.error('Failed to save avatar');
            return;
        }

        const data = await response.json();
        currentUser.avatar_url = data.avatar_url || avatarData;
        saveAvatarSelectionState();

        const settingsAvatar = document.getElementById('settingsAvatar');
        if (settingsAvatar) {
            setAvatarElement(settingsAvatar, currentUser.avatar_url, currentUser.username || 'GU');
        }

        // Update local storage user
        const stored = localStorage.getItem('user');
        if (stored) {
            const parsed = JSON.parse(stored);
            parsed.avatar = currentUser.avatar_url;
            localStorage.setItem('user', JSON.stringify(parsed));
        }

        if (typeof updateUserDisplay === 'function') {
            updateUserDisplay({
                name: currentUser.username,
                avatar: currentUser.avatar_url
            });
        }

        closeAvatarEditor();
    } catch (err) {
        console.error('Error saving avatar:', err);
    }
}

function checkUsernameChangeAvailability(user) {
    const usernameNote = document.getElementById('usernameNote');
    if (!usernameNote) return;
    
    if (!user.username_changed_at) {
        usernameNote.textContent = 'You can change your username';
        usernameNote.style.color = 'var(--text-secondary)';
        return;
    }
    
    const lastChanged = new Date(user.username_changed_at);
    const now = new Date();
    const daysSince = (now - lastChanged) / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.ceil(7 - daysSince);
    
    if (daysSince >= 7) {
        usernameNote.textContent = 'You can change your username';
        usernameNote.style.color = 'var(--text-secondary)';
    } else {
        usernameNote.textContent = `You can change your username in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
        usernameNote.style.color = '#ff6b6b';
    }
}

async function saveProfile() {
    if (!currentUser) return;
    
    const usernameInput = document.getElementById('usernameInput');
    const newUsername = usernameInput.value.trim();
    const messageEl = document.getElementById('profileMessage');
    const saveUsernameBtn = document.getElementById('saveUsernameBtn');

    messageEl.textContent = 'Saving...';
    messageEl.style.color = 'var(--text-secondary)';

    // Update Username if changed
    if (newUsername && newUsername !== currentUser.username) {
        try {
            const response = await fetch(`/api/users/${currentUser.id}/username`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newUsername })
            });

            const data = await response.json();

            if (response.ok) {
                currentUser.username = newUsername;
                currentUser.username_changed_at = new Date().toISOString();
                messageEl.textContent = 'Username updated successfully!';
                messageEl.style.color = 'var(--primary-color)';
                
                // Hide save button after successful save
                saveUsernameBtn.classList.remove('visible');
                
                // Refresh UI
                populateSettings(currentUser);
                if (typeof updateUserDisplay === 'function') {
                    updateUserDisplay(currentUser);
                }
            } else {
                messageEl.textContent = data.error || 'Failed to update username';
                messageEl.style.color = '#ff6b6b';
            }
        } catch (err) {
            console.error('Error saving profile:', err);
            messageEl.textContent = 'Network error';
            messageEl.style.color = '#ff6b6b';
        }
    } else {
        messageEl.textContent = 'No changes to save.';
        messageEl.style.color = 'var(--text-secondary)';
    }
}

// Control scheme functions
function updateControlsDisplay() {
    // Keyboard
    for (const action in currentControls.keyboard) {
        const el = document.querySelector(`[data-action="keyboard-${action}"]`);
        if (el) {
            el.textContent = formatKeyName(currentControls.keyboard[action]);
        }
    }
    // Gamepad
    for (const action in currentControls.gamepad) {
        const el = document.querySelector(`[data-action="gamepad-${action}"]`);
        if (el) {
            el.textContent = formatGamepadName(action, currentControls.gamepad[action]);
        }
    }
}

function formatKeyName(key) {
    // Format key names for display
    const keyNames = {
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'Space': 'Space',
        ' ': 'Space'
    };
    
    return keyNames[key] || key;
}

function formatGamepadName(action, val) {
    const buttonNames = {
        0: 'A',
        1: 'B',
        2: 'X',
        3: 'Y',
        4: 'LB',
        5: 'RB',
        6: 'LT',
        7: 'RT',
        8: 'Back',
        9: 'Start',
        10: 'LS',
        11: 'RS',
        12: 'D-Up',
        13: 'D-Down',
        14: 'D-Left',
        15: 'D-Right'
    };
    const label = buttonNames[val] || `Button ${val}`;
    return label;
}

function captureKey(action) {
    const el = document.querySelector(`[data-action="keyboard-${action}"]`);
    if (!el) return;

    // Cancel any gamepad capture
    stopGamepadCapture();
    
    // Clean up any existing handler
    if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler);
    }
    
    capturingKey = action;
    el.textContent = 'Press a key... (ESC to cancel)';
    el.style.background = 'var(--primary-color)';
    el.style.color = 'white';
    
    // Create new handler
    keydownHandler = handleKeyCapture;
    document.addEventListener('keydown', keydownHandler);
}

function handleKeyCapture(e) {
    e.preventDefault();
    
    if (!capturingKey) return;
    
    // Allow ESC to cancel
    if (e.code === 'Escape') {
        cancelKeyCapture();
        return;
    }
    
    // Update the control
    currentControls.keyboard[capturingKey] = e.code;
    
    // Update display
    updateControlsDisplay();
    
    // Reset capture state
    cancelKeyCapture();
}

function cancelKeyCapture() {
    if (capturingKey) {
        const el = document.querySelector(`[data-action="keyboard-${capturingKey}"]`);
        if (el) {
            el.style.background = '';
            el.style.color = '';
            updateControlsDisplay();
        }
    }
    
    capturingKey = null;
    if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }
}

async function saveControls() {
    if (!currentUser) return;
    
    const messageEl = document.getElementById('controlsMessage');
    
    try {
        const response = await fetch(`/api/users/${currentUser.id}/controls`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ control_scheme: currentControls })
        });

        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = 'Controls saved successfully!';
            messageEl.style.color = 'var(--primary-color)';
        } else {
            messageEl.textContent = data.error || 'Failed to save controls';
            messageEl.style.color = '#ff6b6b';
        }
    } catch (err) {
        console.error('Error saving controls:', err);
        messageEl.textContent = 'Error saving controls';
        messageEl.style.color = '#ff6b6b';
    }
}

function resetControls() {
    currentControls = {
        keyboard: { ...defaultKeyboard },
        gamepad: { ...defaultGamepad }
    };
    updateControlsDisplay();
    
    const messageEl = document.getElementById('controlsMessage');
    messageEl.textContent = 'Controls reset to default (click Save to confirm)';
    messageEl.style.color = 'var(--text-secondary)';
}

async function saveVibrations() {
    if (!currentUser) return;
    
    const checkbox = document.getElementById('vibrationsEnabled');
    vibrationsEnabled = checkbox.checked;
    
    const messageEl = document.getElementById('vibrationsMessage');
    
    try {
        const response = await fetch(`/api/users/${currentUser.id}/vibrations`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ vibrations_enabled: vibrationsEnabled })
        });

        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = 'Vibration preference saved!';
            messageEl.style.color = 'var(--primary-color)';
        } else {
            messageEl.textContent = data.error || 'Failed to save preference';
            messageEl.style.color = '#ff6b6b';
        }
    } catch (err) {
        console.error('Error saving vibrations:', err);
        messageEl.textContent = 'Error saving preference';
        messageEl.style.color = '#ff6b6b';
    }
}

// Initialize display on load
updateControlsDisplay();

