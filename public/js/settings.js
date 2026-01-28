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
    const displayNameInput = document.getElementById('displayNameInput');
    const permanentIdInput = document.getElementById('permanentIdInput');
    const emailInput = document.getElementById('emailInput');
    const settingsAvatar = document.getElementById('settingsAvatar');

    if (usernameInput) {
        usernameInput.value = user.username || '';
    }
    
    if (displayNameInput) {
        displayNameInput.value = user.display_name || '';
        displayNameInput.placeholder = user.username || 'Enter display name';
    }
    
    if (permanentIdInput) {
        permanentIdInput.value = user.permanent_id || '';
    }
    
    if (emailInput) {
        emailInput.value = user.email || '';
    }

    if (settingsAvatar) {
        // Get initials from display name or username
        const name = user.display_name || user.username || 'GU';
        const initials = name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
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
    const displayNameNote = document.getElementById('displayNameNote');
    if (!displayNameNote) return;
    
    if (!user.username_changed_at) {
        displayNameNote.textContent = 'You can change your display name';
        displayNameNote.style.color = 'var(--text-secondary)';
        return;
    }
    
    const lastChanged = new Date(user.username_changed_at);
    const now = new Date();
    const daysSince = (now - lastChanged) / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.ceil(7 - daysSince);
    
    if (daysSince >= 7) {
        displayNameNote.textContent = 'You can change your display name';
        displayNameNote.style.color = 'var(--text-secondary)';
    } else {
        displayNameNote.textContent = `You can change your display name in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
        displayNameNote.style.color = '#ff6b6b';
    }
}

async function saveProfile() {
    if (!currentUser) return;
    
    const displayNameInput = document.getElementById('displayNameInput');
    const newDisplayName = displayNameInput.value.trim();
    const messageEl = document.getElementById('profileMessage');

    if (!newDisplayName) {
        messageEl.textContent = 'Display name cannot be empty';
        messageEl.style.color = '#ff6b6b';
        return;
    }

    try {
        const response = await fetch(`/api/users/${currentUser.id}/display-name`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ display_name: newDisplayName })
        });

        const data = await response.json();

        if (response.ok) {
            messageEl.textContent = 'Display name updated successfully!';
            messageEl.style.color = 'var(--primary-color)';
            
            // Update current user
            currentUser.display_name = newDisplayName;
            currentUser.username_changed_at = new Date().toISOString();
            
            // Update display
            populateSettings(currentUser);
            
            // Update navbar if function exists
            if (typeof updateUserDisplay === 'function') {
                updateUserDisplay(currentUser);
            }
        } else {
            messageEl.textContent = data.error || 'Failed to update display name';
            messageEl.style.color = '#ff6b6b';
        }
    } catch (err) {
        console.error('Error saving profile:', err);
        messageEl.textContent = 'Error saving profile';
        messageEl.style.color = '#ff6b6b';
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
    
    capturingKey = action;
    el.textContent = 'Press a key...';
    el.style.background = 'var(--primary-color)';
    el.style.color = 'white';
    
    // Add event listener for key press
    document.addEventListener('keydown', handleKeyCapture);
}

function handleKeyCapture(e) {
    e.preventDefault();
    
    if (!capturingKey) return;
    
    // Update the control
    currentControls[capturingKey] = e.code;
    
    // Update display
    updateControlsDisplay();
    
    // Reset capture state
    const el = document.querySelector(`[data-action="${capturingKey}"]`);
    if (el) {
        el.style.background = '';
        el.style.color = '';
    }
    
    capturingKey = null;
    document.removeEventListener('keydown', handleKeyCapture);
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

