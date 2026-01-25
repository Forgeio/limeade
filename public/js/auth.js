// Authentication placeholder functions
// These will be connected to OAuth backend in Phase 3

function loginWithGoogle() {
  // TODO: Implement Google OAuth
  console.log('Google OAuth login initiated');
  
  // For now, simulate successful login
  localStorage.setItem('user', JSON.stringify({
    name: 'Guest User',
    provider: 'google',
    avatar: null
  }));
  
  // Redirect to discover page
  window.location.href = 'discover.html';
}

function loginWithDiscord() {
  // TODO: Implement Discord OAuth
  console.log('Discord OAuth login initiated');
  
  // For now, simulate successful login
  localStorage.setItem('user', JSON.stringify({
    name: 'Guest User',
    provider: 'discord',
    avatar: null
  }));
  
  // Redirect to discover page
  window.location.href = 'discover.html';
}

// Check if user is already logged in
function checkAuth() {
  const user = localStorage.getItem('user');
  if (user) {
    return JSON.parse(user);
  }
  return null;
}

// Logout function
function logout() {
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}
