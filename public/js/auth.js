// Authentication functions connected to backend OAuth

function loginWithGoogle() {
  window.location.href = '/auth/google';
}

function loginWithDiscord() {
  window.location.href = '/auth/discord';
}

function loginWithGitHub() {
  window.location.href = '/auth/github';
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
