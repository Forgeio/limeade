const express = require('express');
const passport = require('../config/passport');
const db = require('../config/database');
const router = express.Router();

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Redirect to username setup if needed, otherwise to home
    if (req.user.needs_username) {
      res.redirect('/setup-username');
    } else {
      res.redirect('/');
    }
  }
);

// Discord OAuth
router.get('/discord', passport.authenticate('discord'));

router.get(
  '/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/login' }),
  (req, res) => {
    if (req.user.needs_username) {
      res.redirect('/setup-username');
    } else {
      res.redirect('/');
    }
  }
);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    if (req.user.needs_username) {
      res.redirect('/setup-username');
    } else {
      res.redirect('/');
    }
  }
);

// Get current user
router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      avatar_url: req.user.avatar_url,
      oauth_provider: req.user.oauth_provider,
      control_scheme: req.user.control_scheme,
      username_changed_at: req.user.username_changed_at,
      needs_username: req.user.needs_username,
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Check username availability
router.get('/check-username', async (req, res) => {
  const { username } = req.query;
  
  if (!username || username.length < 3) {
    return res.json({ available: false });
  }
  
  // Validate format
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return res.json({ available: false });
  }
  
  try {
    const result = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    console.error('Error checking username:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set username for new user
router.post('/set-username', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!req.user.needs_username) {
    return res.status(400).json({ error: 'Username already set' });
  }
  
  const { username } = req.body;
  
  // Validate username
  if (!username || username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 3-30 characters' });
  }
  
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
  }
  
  try {
    // Check if taken
    const existing = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }
    
    // Set the username
    await db.query(
      'UPDATE users SET username = $1, needs_username = FALSE WHERE id = $2',
      [username, req.user.id]
    );
    
    res.json({ message: 'Username set successfully', username });
  } catch (err) {
    console.error('Error setting username:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;
