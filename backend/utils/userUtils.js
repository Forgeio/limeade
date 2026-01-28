const db = require('../config/database');

// Check if user can change their username (rate limiting)
async function canChangeUsername(userId) {
  const result = await db.query(
    'SELECT username_changed_at FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return false;
  }
  
  const lastChanged = result.rows[0].username_changed_at;
  
  // Allow change if never changed before
  if (!lastChanged) {
    return true;
  }
  
  // Rate limit: Can only change once per 7 days
  const daysSinceChange = (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceChange >= 7;
}

// Validate username format
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Username is required');
  }
  
  username = username.trim();
  
  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }
  
  if (username.length > 30) {
    throw new Error('Username must be 30 characters or less');
  }
  
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(username)) {
    throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
  }
  
  return username;
}

module.exports = {
  canChangeUsername,
  validateUsername,
};
