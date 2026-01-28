// Settings Page Logic

let currentUser = null;
let currentControls = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  jump: 'ArrowUp',
  attack: 'Space'
};
let capturingKey = null;
let keydownHandler = null;

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
        currentControls = user.control_scheme;
        updateControlsDisplay();
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
    for (const action in currentControls) {
        const el = document.querySelector(`[data-action="${action}"]`);
        if (el) {
            el.textContent = formatKeyName(currentControls[action]);
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

function captureKey(action) {
    const el = document.querySelector(`[data-action="${action}"]`);
    if (!el) return;
    
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
    currentControls[capturingKey] = e.code;
    
    // Update display
    updateControlsDisplay();
    
    // Reset capture state
    cancelKeyCapture();
}

function cancelKeyCapture() {
    if (capturingKey) {
        const el = document.querySelector(`[data-action="${capturingKey}"]`);
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
        left: 'ArrowLeft',
        right: 'ArrowRight',
        up: 'ArrowUp',
        down: 'ArrowDown',
        jump: 'ArrowUp',
        attack: 'Space'
    };
    updateControlsDisplay();
    
    const messageEl = document.getElementById('controlsMessage');
    messageEl.textContent = 'Controls reset to default (click Save to confirm)';
    messageEl.style.color = 'var(--text-secondary)';
}

