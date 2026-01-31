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

document.addEventListener('DOMContentLoaded', async () => {
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
});

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
        const initials = name.substring(0, 2).toUpperCase();
        settingsAvatar.textContent = initials;
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

