// Common navigation functions

// Check authentication on page load
window.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  
  const pathname = window.location.pathname;
  const isLoginPage = pathname.endsWith('/login.html') || pathname === '/login.html' || pathname === '/';
  
  if (!user && !isLoginPage) {
    window.location.href = 'login.html';
    return;
  }
  
  if (user) {
    updateUserDisplay(user);
    setupDropdown();
  }
});

// Check if user is logged in
function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    return JSON.parse(user);
  }
  return null;
}

// Update user display in navbar
function updateUserDisplay(user) {
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  
  if (userName && user.name) {
    userName.textContent = user.name;
  }
  
  if (userAvatar && user.name) {
    // Get initials from name
    const initials = user.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
    userAvatar.textContent = initials;
  }
}

// Setup dropdown menu
function setupDropdown() {
  const userSection = document.getElementById('userSection');
  const dropdownMenu = document.getElementById('dropdownMenu');
  
  if (userSection && dropdownMenu) {
    userSection.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('show');
    });
  }
}

// Navigation functions
function navigateTo(page) {
  window.location.href = page;
}

function createLevel() {
  // TODO: Navigate to level editor when implemented
  console.log('Create level clicked');
  alert('Level editor coming soon!');
}

function openSettings() {
  // TODO: Navigate to settings page when implemented
  console.log('Settings clicked');
  alert('Settings page coming soon!');
}

function logout() {
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}
