const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Get levels (discover page)
router.get('/', async (req, res) => {
  try {
    const filter = req.query.filter || 'hot'; // hot, top, new
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    let orderBy = 'ls.total_plays DESC, l.published_at DESC'; // hot
    if (filter === 'top') {
      orderBy = 'ls.total_likes DESC';
    } else if (filter === 'new') {
      orderBy = 'l.published_at DESC';
    }

    const result = await db.query(
      `SELECT l.id, l.title, l.description, l.creator_id, l.published_at,
              u.username as creator_name,
              ls.total_plays, ls.total_clears, ls.total_likes, ls.total_dislikes, 
              ls.world_record_time, ls.clear_rate
       FROM levels l
       LEFT JOIN level_stats ls ON l.id = ls.level_id
       LEFT JOIN users u ON l.creator_id = u.id
       WHERE l.published = true
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM levels WHERE published = true'
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
    console.error('Error fetching levels:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single level by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT l.*, u.username as creator_name, u.avatar_url as creator_avatar,
              ls.total_plays, ls.total_clears, ls.total_likes, ls.total_dislikes,
              ls.world_record_time, ls.world_record_holder_id, ls.clear_rate,
              wr.username as world_record_holder_name
       FROM levels l
       LEFT JOIN users u ON l.creator_id = u.id
       LEFT JOIN level_stats ls ON l.id = ls.level_id
       LEFT JOIN users wr ON ls.world_record_holder_id = wr.id
       WHERE l.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Level not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching level:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new level (requires authentication)
router.post('/', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { title, description, level_data } = req.body;

    if (!title || !level_data) {
      return res.status(400).json({ error: 'Title and level data are required' });
    }

    const result = await db.query(
      `INSERT INTO levels (title, description, creator_id, level_data, published, created_at, updated_at)
       VALUES ($1, $2, $3, $4, false, NOW(), NOW())
       RETURNING *`,
      [title, description, req.user.id, JSON.stringify(level_data)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating level:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update level (requires authentication and ownership)
router.put('/:id', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { title, description, level_data, published } = req.body;

    // Check ownership
    const checkResult = await db.query(
      'SELECT creator_id FROM levels WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Level not found' });
    }

    if (checkResult.rows[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to edit this level' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (level_data !== undefined) {
      updateFields.push(`level_data = $${paramCount++}`);
      values.push(JSON.stringify(level_data));
    }
    if (published !== undefined) {
      updateFields.push(`published = $${paramCount++}`);
      values.push(published);
      if (published) {
        updateFields.push(`published_at = NOW()`);
      }
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
      `UPDATE levels SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating level:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete level (requires authentication and ownership)
router.delete('/:id', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Check ownership
    const checkResult = await db.query(
      'SELECT creator_id FROM levels WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Level not found' });
    }

    if (checkResult.rows[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this level' });
    }

    await db.query('DELETE FROM levels WHERE id = $1', [id]);

    res.json({ message: 'Level deleted successfully' });
  } catch (err) {
    console.error('Error deleting level:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Like/dislike a level
router.post('/:id/like', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { is_like } = req.body;

    if (typeof is_like !== 'boolean') {
      return res.status(400).json({ error: 'is_like must be a boolean' });
    }

    // Insert or update like
    await db.query(
      `INSERT INTO level_likes (level_id, user_id, is_like)
       VALUES ($1, $2, $3)
       ON CONFLICT (level_id, user_id)
       DO UPDATE SET is_like = $3`,
      [id, req.user.id, is_like]
    );

    // Update level stats
    const likesResult = await db.query(
      'SELECT COUNT(*) as count FROM level_likes WHERE level_id = $1 AND is_like = true',
      [id]
    );
    const dislikesResult = await db.query(
      'SELECT COUNT(*) as count FROM level_likes WHERE level_id = $1 AND is_like = false',
      [id]
    );

    await db.query(
      `UPDATE level_stats 
       SET total_likes = $1, total_dislikes = $2
       WHERE level_id = $3`,
      [parseInt(likesResult.rows[0].count), parseInt(dislikesResult.rows[0].count), id]
    );

    res.json({ message: 'Like updated successfully' });
  } catch (err) {
    console.error('Error updating like:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record a play
router.post('/:id/play', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { completed, completion_time } = req.body;

    // Record the play
    await db.query(
      `INSERT INTO level_plays (level_id, user_id, completed, completion_time)
       VALUES ($1, $2, $3, $4)`,
      [id, req.user.id, completed || false, completion_time || null]
    );

    // Update level stats
    await db.query(
      `UPDATE level_stats ls
       SET total_plays = (SELECT COUNT(*) FROM level_plays WHERE level_id = $1),
           total_clears = (SELECT COUNT(*) FROM level_plays WHERE level_id = $1 AND completed = true),
           clear_rate = ROUND((SELECT COUNT(*)::decimal FROM level_plays WHERE level_id = $1 AND completed = true) / 
                             GREATEST((SELECT COUNT(*) FROM level_plays WHERE level_id = $1), 1) * 100, 2)
       WHERE ls.level_id = $1`,
      [id]
    );

    // Update world record if applicable
    if (completed && completion_time) {
      const recordResult = await db.query(
        'SELECT world_record_time FROM level_stats WHERE level_id = $1',
        [id]
      );

      if (recordResult.rows.length > 0) {
        const currentRecord = recordResult.rows[0].world_record_time;
        if (!currentRecord || completion_time < currentRecord) {
          await db.query(
            'UPDATE level_stats SET world_record_time = $1, world_record_holder_id = $2 WHERE level_id = $3',
            [completion_time, req.user.id, id]
          );
        }
      }
    }

    res.json({ message: 'Play recorded successfully' });
  } catch (err) {
    console.error('Error recording play:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
