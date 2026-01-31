// Common navigation functions

// Check authentication on page load
window.addEventListener('DOMContentLoaded', async () => {
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
    window.location.href = '/login';
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
  window.location.href = '/' + page.replace('.html', '');
}

function createLevel() {
  window.location.href = '/editor';
}

function openProfile() {
  window.location.href = '/profile';
}

function openSettings() {
  window.location.href = '/settings';
}

function logout() {
  localStorage.removeItem('user');
  window.location.href = '/login';
}
