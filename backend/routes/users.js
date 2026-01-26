const express = require('express');
const db = require('../config/database');
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

    // Check if requesting user is the owner (if authenticated)
    if (req.isAuthenticated() && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'You can only view your own drafts' });
    }

    const result = await db.query(
      `SELECT id, title, description, level_data, created_at, updated_at
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
    // The orderBy value is only set from this whitelist, never from user input
    const validOrderBy = {
      'clears': 'total_clears DESC',
      'records': 'total_records DESC',
      'playtime': 'total_playtime DESC'
    };

    const orderBy = validOrderBy[type] || 'total_clears DESC';

    // Safe to use string interpolation here as orderBy comes from whitelist above
    const result = await db.query(
      `SELECT u.id, u.username, u.avatar_url, us.*
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

module.exports = router;
