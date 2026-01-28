const db = require('../config/database');

// Generate a random 6-character alphanumeric permanent ID
function generatePermanentId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a unique permanent ID (check for collisions)
async function generateUniquePermanentId() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const id = generatePermanentId();
    const result = await db.query(
      'SELECT id FROM users WHERE permanent_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return id;
    }
    attempts++;
  }
  
  throw new Error('Failed to generate unique permanent ID');
}

// Generate a random username
function generateRandomUsername() {
  const adjectives = [
    'Swift', 'Bold', 'Mighty', 'Clever', 'Brave', 'Quick', 'Nimble', 'Bright',
    'Wild', 'Free', 'Cool', 'Epic', 'Super', 'Mega', 'Ultra', 'Cosmic',
    'Mystic', 'Thunder', 'Storm', 'Blazing', 'Frozen', 'Shadow', 'Crystal', 'Golden'
  ];
  
  const nouns = [
    'Player', 'Gamer', 'Hero', 'Champion', 'Master', 'Warrior', 'Knight', 'Runner',
    'Jumper', 'Racer', 'Star', 'Phoenix', 'Dragon', 'Tiger', 'Wolf', 'Eagle',
    'Panda', 'Fox', 'Lion', 'Bear', 'Falcon', 'Ninja', 'Wizard', 'Ranger'
  ];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 999) + 1;
  
  return `${adjective}${noun}${number}`;
}

// Generate a unique random username
async function generateUniqueUsername() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const username = generateRandomUsername();
    const result = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return username;
    }
    attempts++;
  }
  
  throw new Error('Failed to generate unique username');
}

// Sanitize and validate a display name
function sanitizeDisplayName(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }
  
  // Trim whitespace
  name = name.trim();
  
  // Check minimum length
  if (name.length < 2) {
    throw new Error('Display name must be at least 2 characters long');
  }
  
  // Check maximum length
  if (name.length > 50) {
    throw new Error('Display name must be 50 characters or less');
  }
  
  // Only allow alphanumeric, spaces, underscores, and hyphens
  const validPattern = /^[a-zA-Z0-9_ -]+$/;
  if (!validPattern.test(name)) {
    throw new Error('Display name can only contain letters, numbers, spaces, underscores, and hyphens');
  }
  
  // Don't allow multiple consecutive spaces
  if (/\s{2,}/.test(name)) {
    throw new Error('Display name cannot contain consecutive spaces');
  }
  
  // Don't allow names that are only numbers
  if (/^\d+$/.test(name)) {
    throw new Error('Display name cannot be only numbers');
  }
  
  return name;
}

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

module.exports = {
  generateUniquePermanentId,
  generateUniqueUsername,
  sanitizeDisplayName,
  canChangeUsername,
};
