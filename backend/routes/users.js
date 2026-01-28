const express = require('express');
const db = require('../config/database');
const { canChangeUsername } = require('../utils/userUtils');
const router = express.Router();

// Get user profile by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user info
    const userResult = await db.query(
      'SELECT id, username, avatar_url, created_at FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user stats
    const statsResult = await db.query(
      'SELECT * FROM user_stats WHERE user_id = $1',
      [id]
    );

    const stats = statsResult.rows[0] || {
      total_clears: 0,
      total_records: 0,
      total_playtime: 0,
      levels_created: 0,
      total_likes_received: 0,
    };

    res.json({
      ...user,
      stats,
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's created levels
router.get('/:id/levels', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT l.*, ls.total_plays, ls.total_clears, ls.total_likes, ls.total_dislikes, ls.world_record_time
       FROM levels l
       LEFT JOIN level_stats ls ON l.id = ls.level_id
       WHERE l.creator_id = $1 AND l.published = true
       ORDER BY l.published_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM levels WHERE creator_id = $1 AND published = true',
      [id]
    );

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      levels: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (err) {
    console.error('Error fetching user levels:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's draft levels
router.get('/:id/drafts', async (req, res) => {
  try {
    const { id } = req.params;

    // Require authentication
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if requesting user is the owner
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'You can only view your own drafts' });
    }

    const result = await db.query(
      `SELECT id, title, description, level_data, created_at, updated_at, thumbnail_path
       FROM levels
       WHERE creator_id = $1 AND published = false
       ORDER BY updated_at DESC
       LIMIT 8`,
      [id]
    );

    res.json({
      drafts: result.rows
    });
  } catch (err) {
    console.error('Error fetching user drafts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaderboard
router.get('/leaderboard/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    // Whitelist valid order by options to prevent SQL injection
    const validOrderBy = {
      'clears': 'total_clears DESC',
      'records': 'total_records DESC',
      'playtime': 'total_playtime DESC'
    };

    const orderBy = validOrderBy[type] || 'total_clears DESC';

    const result = await db.query(
      `SELECT u.id, u.username, u.avatar_url, 
              us.total_clears, us.total_records, us.total_playtime, 
              us.levels_created, us.total_likes_received
       FROM users u
       INNER JOIN user_stats us ON u.id = us.user_id
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM users');
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      players: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user's control scheme
router.put('/:id/controls', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { control_scheme } = req.body;

    // Check if user is updating their own profile
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'You can only update your own controls' });
    }

    // Validate control scheme structure
    const requiredKeys = ['left', 'right', 'up', 'down', 'jump', 'attack'];
    if (!control_scheme || typeof control_scheme !== 'object') {
      return res.status(400).json({ error: 'Invalid control scheme' });
    }

    // Validate each control key exists and is a valid key code
    const validKeyPattern = /^[A-Za-z0-9]+$/;
    for (const key of requiredKeys) {
      if (!control_scheme[key]) {
        return res.status(400).json({ 
          error: `Missing required control: ${key}` 
        });
      }
      if (typeof control_scheme[key] !== 'string' || !validKeyPattern.test(control_scheme[key])) {
        return res.status(400).json({ 
          error: `Invalid key code for ${key}. Must be alphanumeric.` 
        });
      }
    }

    // Update the control scheme
    const result = await db.query(
      'UPDATE users SET control_scheme = $1 WHERE id = $2 RETURNING control_scheme',
      [JSON.stringify(control_scheme), id]
    );

    res.json({
      message: 'Controls updated successfully',
      control_scheme: result.rows[0].control_scheme
    });
  } catch (err) {
    console.error('Error updating controls:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update username
router.put('/:id/username', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { username } = req.body;

    // Check if user is updating their own profile
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'You can only update your own profile' });
    }

    if (!username || username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3-30 characters' });
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
    }

    // Check rate limiting (once per 7 days)
    const allowed = await canChangeUsername(req.user.id);
    if (!allowed) {
      return res.status(429).json({ 
        error: 'You can only change your username once every 7 days' 
      });
    }

    // Check uniqueness (case-insensitive)
    const existing = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', 
      [username, id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const result = await db.query(
      'UPDATE users SET username = $1, username_changed_at = NOW() WHERE id = $2 RETURNING username',
      [username, id]
    );

    res.json({
      message: 'Username updated successfully',
      username: result.rows[0].username
    });
  } catch (err) {
    console.error('Error updating username:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
