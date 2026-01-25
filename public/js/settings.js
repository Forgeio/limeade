// Settings Page Logic

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        populateSettings(user);
    }
});

function populateSettings(user) {
    const usernameInput = document.getElementById('usernameInput');
    const settingsAvatar = document.getElementById('settingsAvatar');

    if (usernameInput) {
        usernameInput.value = user.name;
    }

    if (settingsAvatar) {
         // Get initials from name
         const initials = user.name
         .split(' ')
         .map(word => word[0])
         .join('')
         .toUpperCase()
         .substring(0, 2);
        settingsAvatar.textContent = initials;
    }
}

function saveProfile() {
    const usernameInput = document.getElementById('usernameInput');
    const newName = usernameInput.value;

    if (!newName) {
        alert("Username cannot be empty");
        return;
    }

    // Update local storage for simulation
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        user.name = newName;
        localStorage.setItem('user', JSON.stringify(user));
        
        // Update display immediately
        populateSettings(user);
        // Also update navbar if possible (might need reload or function call if navigation.js exposes it)
        if (typeof updateUserDisplay === 'function') {
            updateUserDisplay(user);
        } else {
             // Reload to reflect changes in navbar
            window.location.reload();
        }
        
        alert('Profile saved!');
    }
}
