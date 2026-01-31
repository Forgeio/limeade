const express = require('express');
const db = require('../config/database');
const { canChangeUsername } = require('../utils/userUtils');
const router = express.Router();

// Get user profile by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user info including ratings
    const userResult = await db.query(
      'SELECT id, username, avatar_url, created_at, skill_rating, rating_deviation FROM users WHERE id = $1',
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
      seasonal_skill_rating: 1500,
      seasonal_rating_deviation: 350,
      blind_mode_skill_rating: 1500,
      blind_mode_rating_deviation: 350
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
      'playtime': 'total_playtime DESC',
      'skill_rating': 'skill_rating DESC',
      'seasonal_rating': 'seasonal_skill_rating DESC',
      'blind_mode_rating': 'blind_mode_skill_rating DESC'
    };

    const orderBy = validOrderBy[type] || 'total_clears DESC';

    let query, queryParams;
    
    // For skill rating leaderboards, query users table directly
    if (type === 'skill_rating' || type === 'seasonal_rating' || type === 'blind_mode_rating') {
      const ratingColumn = type === 'skill_rating' ? 'u.skill_rating' : 
                          type === 'seasonal_rating' ? 'us.seasonal_skill_rating' :
                          'us.blind_mode_skill_rating';
      const rdColumn = type === 'skill_rating' ? 'u.rating_deviation' :
                       type === 'seasonal_rating' ? 'us.seasonal_rating_deviation' :
                       'us.blind_mode_rating_deviation';
                       
      query = `SELECT u.id, u.username, u.avatar_url, 
                      ${ratingColumn} as rating, ${rdColumn} as rating_deviation,
                      us.total_clears, us.total_records, us.total_playtime, 
                      us.levels_created, us.total_likes_received
               FROM users u
               LEFT JOIN user_stats us ON u.id = us.user_id
               ORDER BY ${orderBy}
               LIMIT $1 OFFSET $2`;
      queryParams = [limit, offset];
    } else {
      query = `SELECT u.id, u.username, u.avatar_url, 
                      u.skill_rating, u.rating_deviation,
                      us.total_clears, us.total_records, us.total_playtime, 
                      us.levels_created, us.total_likes_received
               FROM users u
               INNER JOIN user_stats us ON u.id = us.user_id
               ORDER BY ${orderBy}
               LIMIT $1 OFFSET $2`;
      queryParams = [limit, offset];
    }

    const result = await db.query(query, queryParams);

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

    // Validate control scheme structure (support legacy flat shape and new keyboard/gamepad shape)
    const requiredKeys = ['left', 'right', 'up', 'down', 'jump', 'attack'];
    const validKeyPattern = /^(Arrow(Left|Right|Up|Down)|Space|[A-Za-z0-9_]+)$/;
    const defaultKeyboard = {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      up: 'ArrowUp',
      down: 'ArrowDown',
      jump: 'ArrowUp',
      attack: 'Space'
    };
    const defaultGamepad = {
      dpadLeft: 14,
      dpadRight: 15,
      dpadUp: 12,
      dpadDown: 13,
      buttonJump: 0,
      buttonAttack: 7
    };

    if (!control_scheme || typeof control_scheme !== 'object') {
      return res.status(400).json({ error: 'Invalid control scheme' });
    }

    // Normalize to new shape
    let normalizedScheme = {};
    
    if (control_scheme.keyboard) {
      // New shape with keyboard/gamepad
      normalizedScheme.keyboard = { ...defaultKeyboard, ...control_scheme.keyboard };
      normalizedScheme.gamepad = { ...defaultGamepad, ...(control_scheme.gamepad || {}) };
    } else {
      // Legacy flat shape
      normalizedScheme.keyboard = { ...defaultKeyboard, ...control_scheme };
      normalizedScheme.gamepad = defaultGamepad;
    }

    // Validate keyboard controls
    for (const key of requiredKeys) {
      const value = normalizedScheme.keyboard[key];
      if (!value || typeof value !== 'string') {
        return res.status(400).json({ error: `Missing or invalid control: ${key}` });
      }
    }

    // Validate gamepad controls
    const requiredButtons = ['dpadLeft', 'dpadRight', 'dpadUp', 'dpadDown', 'buttonJump', 'buttonAttack'];
    for (const key of requiredButtons) {
      const value = normalizedScheme.gamepad[key];
      if (typeof value !== 'number' || value < 0 || value > 31) {
        return res.status(400).json({ error: `Invalid gamepad mapping for ${key}` });
      }
    }

    // Update the control scheme
    const result = await db.query(
      'UPDATE users SET control_scheme = $1 WHERE id = $2 RETURNING control_scheme',
      [JSON.stringify(normalizedScheme), id]
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

// Update vibration preference
router.put('/:id/vibrations', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { vibrations_enabled } = req.body;

    // Check if user is updating their own profile
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'You can only update your own settings' });
    }

    if (typeof vibrations_enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid vibration preference' });
    }

    const result = await db.query(
      'UPDATE users SET vibrations_enabled = $1 WHERE id = $2 RETURNING vibrations_enabled',
      [vibrations_enabled, id]
    );

    res.json({
      message: 'Vibration preference updated successfully',
      vibrations_enabled: result.rows[0].vibrations_enabled
    });
  } catch (err) {
    console.error('Error updating vibration preference:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
