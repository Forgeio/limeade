// Common navigation functions

// Check authentication on page load / SPA navigation
async function initNavigation() {
  // Sync session with backend
  try {
    const res = await fetch('/auth/user');
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('user', JSON.stringify({
        name: data.username,
        avatar: data.avatar_url,
        provider: data.oauth_provider,
        id: data.id
      }));
    } else if (res.status === 401) {
      localStorage.removeItem('user');
    }
  } catch (e) {
    console.log('Session sync failed, using local storage');
  }

  const user = checkAuth();
  
  const pathname = window.location.pathname;
  const isLoginPage = pathname.endsWith('/login') || pathname === '/login';
  
  // Redirect to login if not authenticated (except when already on login page)
  if (!user && !isLoginPage) {
    if (typeof window.spaNavigate === 'function') {
      window.spaNavigate('/login');
    } else {
      window.location.href = '/login';
    }
    return;
  }
  
  if (user) {
    updateUserDisplay(user);
    setupDropdown();
  }
}

window.addEventListener('DOMContentLoaded', initNavigation);
window.addEventListener('spa:navigate', initNavigation);

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
  if (setupDropdown.bound) return;
  setupDropdown.bound = true;

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
  const target = '/' + page.replace('.html', '');
  if (typeof window.spaNavigate === 'function') {
    window.spaNavigate(target);
  } else {
    window.location.href = target;
  }
}

function createLevel() {
  if (typeof window.spaNavigate === 'function') {
    window.spaNavigate('/editor');
  } else {
    window.location.href = '/editor';
  }
}

function openProfile() {
  if (typeof window.spaNavigate === 'function') {
    window.spaNavigate('/profile');
  } else {
    window.location.href = '/profile';
  }
}

function openSettings() {
  if (typeof window.spaNavigate === 'function') {
    window.spaNavigate('/settings');
  } else {
    window.location.href = '/settings';
  }
}

function logout() {
  localStorage.removeItem('user');
  if (typeof window.spaNavigate === 'function') {
    window.spaNavigate('/login');
  } else {
    window.location.href = '/login';
  }
}
