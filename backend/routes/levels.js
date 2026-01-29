const express = require('express');
const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const ratingSystem = require('../utils/ratingSystem');
const router = express.Router();

// Constants
const MAX_DRAFTS_PER_USER = 8;

// Get levels (discover page)
router.get('/', async (req, res) => {
  try {
    const filter = req.query.filter || 'hot';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;

    let orderBy, dateFilter, dateValue;
    
    // Define filter logic
    if (filter === 'new') {
      // Most recent levels
      orderBy = 'l.published_at DESC';
      dateFilter = null;
      dateValue = null;
    } else if (filter === 'hot') {
      // Highest rated levels of the week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      dateFilter = 'AND l.published_at >= $3';
      dateValue = oneWeekAgo.toISOString();
      orderBy = 'ls.total_likes DESC, l.published_at DESC';
    } else if (filter === 'top') {
      // Highest rated levels of the year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      dateFilter = 'AND l.published_at >= $3';
      dateValue = oneYearAgo.toISOString();
      orderBy = 'ls.total_likes DESC';
    } else {
      // Default to hot
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      dateFilter = 'AND l.published_at >= $3';
      dateValue = oneWeekAgo.toISOString();
      orderBy = 'ls.total_likes DESC, l.published_at DESC';
    }

    // Build query with parameterized values
    const queryParams = [limit, offset];
    if (dateValue) {
      queryParams.push(dateValue);
    }
    
    const whereClause = dateFilter || '';
    
    // orderBy is from a controlled whitelist, safe to interpolate
    const result = await db.query(
      `SELECT l.id, l.title, l.description, l.creator_id, l.published_at, l.thumbnail_path,
              l.difficulty_rating, l.difficulty_rd, l.is_volatile,
              u.username as creator_name,
              ls.total_plays, ls.total_clears, ls.total_likes, ls.total_dislikes, 
              ls.world_record_time, ls.clear_rate
       FROM levels l
       LEFT JOIN level_stats ls ON l.id = ls.level_id
       LEFT JOIN users u ON l.creator_id = u.id
       WHERE l.published = true ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      queryParams
    );

    // Add difficulty labels for authenticated users
    const levels = result.rows;
    if (req.isAuthenticated()) {
      const userResult = await db.query(
        'SELECT skill_rating FROM users WHERE id = $1',
        [req.user.id]
      );
      const playerSR = userResult.rows[0].skill_rating || ratingSystem.DEFAULT_RATING;
      
      levels.forEach(level => {
        const levelDR = level.difficulty_rating || ratingSystem.DEFAULT_RATING;
        const levelRD = level.difficulty_rd || ratingSystem.DEFAULT_RD;
        level.difficulty_label = ratingSystem.getDifficultyLabel(levelDR, playerSR, levelRD);
      });
    } else {
      levels.forEach(level => {
        const levelDR = level.difficulty_rating || ratingSystem.DEFAULT_RATING;
        const levelRD = level.difficulty_rd || ratingSystem.DEFAULT_RD;
        level.difficulty_label = ratingSystem.getDifficultyLabel(levelDR, ratingSystem.DEFAULT_RATING, levelRD);
      });
    }

    // Count query with same date filter
    const countParams = dateValue ? [dateValue] : [];
    const countDateFilter = dateValue ? 'AND l.published_at >= $1' : '';
    const countResult = await db.query(
      `SELECT COUNT(*) FROM levels l WHERE l.published = true ${countDateFilter}`,
      countParams
    );

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      levels: levels,
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

    const level = result.rows[0];

    // Add difficulty label if user is authenticated
    if (req.isAuthenticated()) {
      const userResult = await db.query(
        'SELECT skill_rating FROM users WHERE id = $1',
        [req.user.id]
      );
      
      const playerSR = userResult.rows[0].skill_rating || ratingSystem.DEFAULT_RATING;
      const levelDR = level.difficulty_rating || ratingSystem.DEFAULT_RATING;
      const levelRD = level.difficulty_rd || ratingSystem.DEFAULT_RD;
      
      level.difficulty_label = ratingSystem.getDifficultyLabel(levelDR, playerSR, levelRD);
    } else {
      // For non-authenticated users, show absolute difficulty
      const levelDR = level.difficulty_rating || ratingSystem.DEFAULT_RATING;
      const levelRD = level.difficulty_rd || ratingSystem.DEFAULT_RD;
      level.difficulty_label = ratingSystem.getDifficultyLabel(levelDR, ratingSystem.DEFAULT_RATING, levelRD);
    }

    res.json(level);
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

    if (!level_data) {
      return res.status(400).json({ error: 'Level data is required' });
    }

    if (title && title.length > 30) {
      return res.status(400).json({ error: 'Title cannot exceed 30 characters' });
    }

    if (description && description.length > 255) {
      return res.status(400).json({ error: 'Description cannot exceed 255 characters' });
    }

    // Check draft limit (max drafts per user)
    const draftCountResult = await db.query(
      'SELECT COUNT(*) FROM levels WHERE creator_id = $1 AND published = false',
      [req.user.id]
    );

    const draftCount = parseInt(draftCountResult.rows[0].count);
    if (draftCount >= MAX_DRAFTS_PER_USER) {
      return res.status(400).json({ error: `Maximum draft limit reached (${MAX_DRAFTS_PER_USER} drafts)` });
    }

    // Generate default title if not provided
    let levelTitle = title;
    if (!levelTitle || levelTitle === 'Untitled Level') {
      // Find the next available "New Level X" number
      const existingResult = await db.query(
        `SELECT title FROM levels WHERE creator_id = $1 AND title LIKE 'New Level %'`,
        [req.user.id]
      );
      
      const existingNumbers = existingResult.rows
        .map(row => {
          const match = row.title.match(/^New Level (\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);
      
      // Use O(n) algorithm to find next number (using reduce instead of spread to avoid stack overflow)
      const maxNumber = existingNumbers.reduce((max, num) => Math.max(max, num), 0);
      levelTitle = `New Level ${maxNumber + 1}`;
    }

    const result = await db.query(
      `INSERT INTO levels (title, description, creator_id, level_data, published, created_at, updated_at)
       VALUES ($1, $2, $3, $4, false, NOW(), NOW())
       RETURNING *`,
      [levelTitle, description || '', req.user.id, JSON.stringify(level_data)]
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
    const { title, description, level_data, published, thumbnail } = req.body;

    if (title && title.length > 30) {
      return res.status(400).json({ error: 'Title cannot exceed 30 characters' });
    }

    if (description && description.length > 255) {
      return res.status(400).json({ error: 'Description cannot exceed 255 characters' });
    }

    // Check ownership
    const checkResult = await db.query(
      'SELECT creator_id, published FROM levels WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Level not found' });
    }

    if (checkResult.rows[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to edit this level' });
    }
    
    // Prevent editing published levels
    if (checkResult.rows[0].published) {
      return res.status(403).json({ error: 'Published levels cannot be edited. Please create a copy in the editor.' });
    }

    // Handle thumbnail if provided
    let thumbnailPath = null;
    if (thumbnail) {
      try {
        // Expect base64 string: "data:image/png;base64,iVBORw0KGgo..."
        const matches = thumbnail.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1];
          const data = matches[2];
          const buffer = Buffer.from(data, 'base64');
          
          const filename = `${id}.${ext}`;
          // Ensure directory exists
          const thumbnailsDir = path.join(__dirname, '../../public/thumbnails');
          if (!fs.existsSync(thumbnailsDir)){
              fs.mkdirSync(thumbnailsDir, { recursive: true });
          }
          
          const filePath = path.join(thumbnailsDir, filename);
          fs.writeFileSync(filePath, buffer);
          thumbnailPath = `/thumbnails/${filename}`;
        }
      } catch (e) {
        console.error('Error saving thumbnail:', e);
        // Continue without failing (could log warning)
      }
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
    if (thumbnailPath) {
      updateFields.push(`thumbnail_path = $${paramCount++}`);
      values.push(thumbnailPath);
    }
    if (published !== undefined) {
      // Validate level requirements when publishing
      if (published && level_data) {
        // Check level size (min 32x18, max 250x250)
        const width = level_data.width || 50;
        const height = level_data.height || 18;
        if (width < 32 || width > 250 || height < 18 || height > 250) {
          return res.status(400).json({ error: 'Level size must be between 32x18 and 250x250' });
        }
        
        // Check for spawn point
        const tiles = level_data.tiles || {};
        const hasSpawn = Object.values(tiles).includes('spawn');
        if (!hasSpawn) {
          return res.status(400).json({ error: 'Level must have a spawn point' });
        }
        
        // Check for goal
        const hasGoal = Object.values(tiles).includes('goal');
        if (!hasGoal) {
          return res.status(400).json({ error: 'Level must have a goal' });
        }
      }
      
      updateFields.push(`published = $${paramCount++}`);
      values.push(published);
      if (published) {
        updateFields.push(`published_at = NOW()`);
        
        // Create level stats entry if publishing for the first time
        await db.query(
          `INSERT INTO level_stats (level_id, total_plays, total_clears, total_likes, total_dislikes, clear_rate)
           VALUES ($1, 0, 0, 0, 0, 0.00)
           ON CONFLICT (level_id) DO NOTHING`,
          [id]
        );
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

    // Check if user has beaten the level
    const beatCheck = await db.query(
      'SELECT has_beaten FROM level_plays WHERE level_id = $1 AND user_id = $2 AND has_beaten = true LIMIT 1',
      [id, req.user.id]
    );

    if (beatCheck.rows.length === 0) {
      return res.status(403).json({ 
        error: 'You must beat the level before you can rate it' 
      });
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
      `INSERT INTO level_plays (level_id, user_id, completed, completion_time, has_beaten)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, req.user.id, completed || false, completion_time || null, completed || false]
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
    
    // Update user stats if level was cleared
    if (completed) {
      await db.query(
        `INSERT INTO user_stats (user_id, total_clears)
         VALUES ($1, 1)
         ON CONFLICT (user_id)
         DO UPDATE SET total_clears = user_stats.total_clears + 1`,
        [req.user.id]
      );
    }

    res.json({ 
      message: 'Play recorded successfully',
      has_beaten: completed || false
    });
  } catch (err) {
    console.error('Error recording play:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's interaction with a level (has beaten, like status)
router.get('/:id/user-status', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.json({ 
        has_beaten: false,
        has_liked: null
      });
    }

    const { id } = req.params;

    // Check if user has beaten the level
    const beatCheck = await db.query(
      'SELECT has_beaten FROM level_plays WHERE level_id = $1 AND user_id = $2 AND has_beaten = true LIMIT 1',
      [id, req.user.id]
    );

    // Check if user has liked/disliked the level
    const likeCheck = await db.query(
      'SELECT is_like FROM level_likes WHERE level_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    res.json({
      has_beaten: beatCheck.rows.length > 0,
      has_liked: likeCheck.rows.length > 0 ? likeCheck.rows[0].is_like : null
    });
  } catch (err) {
    console.error('Error checking user status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start a play session (new rating system)
router.post('/:id/session/start', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Check if there's already an active session
    const existingSession = await db.query(
      'SELECT id FROM play_sessions WHERE level_id = $1 AND user_id = $2 AND session_end IS NULL ORDER BY session_start DESC LIMIT 1',
      [id, req.user.id]
    );

    if (existingSession.rows.length > 0) {
      return res.json({ 
        session_id: existingSession.rows[0].id,
        message: 'Resumed existing session'
      });
    }

    // Create new session
    const result = await db.query(
      `INSERT INTO play_sessions (level_id, user_id, session_start)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [id, req.user.id]
    );

    res.json({ 
      session_id: result.rows[0].id,
      message: 'Session started'
    });
  } catch (err) {
    console.error('Error starting session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a play session (record attempts, deaths, progress)
router.put('/:id/session/:sessionId', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id, sessionId } = req.params;
    const { attempts, deaths, furthest_progress, completed, completion_time } = req.body;

    await db.query(
      `UPDATE play_sessions 
       SET attempts = COALESCE($1, attempts),
           deaths = COALESCE($2, deaths),
           furthest_progress = COALESCE($3, furthest_progress),
           completed = COALESCE($4, completed),
           completion_time = COALESCE($5, completion_time)
       WHERE id = $6 AND user_id = $7`,
      [attempts, deaths, furthest_progress, completed, completion_time, sessionId, req.user.id]
    );

    res.json({ message: 'Session updated' });
  } catch (err) {
    console.error('Error updating session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End a play session and update ratings
router.post('/:id/session/:sessionId/end', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id, sessionId } = req.params;

    // Get session data
    const sessionResult = await db.query(
      'SELECT * FROM play_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, req.user.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    if (session.rating_updated) {
      return res.json({ message: 'Session already processed' });
    }

    // Get player and level ratings
    const userResult = await db.query(
      'SELECT skill_rating, rating_deviation FROM users WHERE id = $1',
      [req.user.id]
    );

    const levelResult = await db.query(
      'SELECT difficulty_rating, difficulty_rd, rating_update_count FROM levels WHERE id = $1',
      [id]
    );

    const playerSR = userResult.rows[0].skill_rating || ratingSystem.DEFAULT_RATING;
    const playerRD = userResult.rows[0].rating_deviation || ratingSystem.DEFAULT_RD;
    const levelDR = levelResult.rows[0].difficulty_rating || ratingSystem.DEFAULT_RATING;
    const levelRD = levelResult.rows[0].difficulty_rd || ratingSystem.DEFAULT_RD;
    const updateCount = levelResult.rows[0].rating_update_count || 0;

    // Calculate outcome score
    const outcomeScore = ratingSystem.calculateOutcomeScore(session);

    // Calculate expected score
    const expectedScore = ratingSystem.calculateExpectedClearChance(playerSR, levelDR);

    // Update player rating
    const newPlayerRating = ratingSystem.updatePlayerRating(playerSR, playerRD, outcomeScore, expectedScore);
    await db.query(
      'UPDATE users SET skill_rating = $1, rating_deviation = $2, last_rating_update = NOW() WHERE id = $3',
      [newPlayerRating.skill_rating, newPlayerRating.rating_deviation, req.user.id]
    );

    // Update level rating
    const newLevelRating = ratingSystem.updateLevelRating(levelDR, levelRD, outcomeScore, expectedScore, updateCount);
    await db.query(
      'UPDATE levels SET difficulty_rating = $1, difficulty_rd = $2, rating_update_count = rating_update_count + 1 WHERE id = $3',
      [newLevelRating.difficulty_rating, newLevelRating.difficulty_rd, id]
    );

    // Check for volatility (get recent sessions)
    const recentSessions = await db.query(
      `SELECT ps.*, u.skill_rating, l.difficulty_rating 
       FROM play_sessions ps
       JOIN users u ON ps.user_id = u.id
       JOIN levels l ON ps.level_id = l.id
       WHERE ps.level_id = $1 AND ps.rating_updated = true
       ORDER BY ps.session_end DESC
       LIMIT 20`,
      [id]
    );

    if (recentSessions.rows.length >= 10) {
      const outcomes = recentSessions.rows.map(s => ratingSystem.calculateOutcomeScore(s));
      const expected = recentSessions.rows.map(s => 
        ratingSystem.calculateExpectedClearChance(s.skill_rating, s.difficulty_rating)
      );
      
      const isVolatile = ratingSystem.detectVolatility(outcomes, expected);
      
      if (isVolatile) {
        await db.query('UPDATE levels SET is_volatile = true WHERE id = $1', [id]);
      }
    }

    // Mark session as complete and rated
    await db.query(
      `UPDATE play_sessions 
       SET session_end = NOW(), rating_updated = true, outcome_score = $1 
       WHERE id = $2`,
      [outcomeScore, sessionId]
    );

    // Also record in the old level_plays table for backwards compatibility
    await db.query(
      `INSERT INTO level_plays (level_id, user_id, completed, completion_time, has_beaten)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, req.user.id, session.completed || false, session.completion_time || null, session.completed || false]
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
    if (session.completed && session.completion_time) {
      const recordResult = await db.query(
        'SELECT world_record_time FROM level_stats WHERE level_id = $1',
        [id]
      );

      if (recordResult.rows.length > 0) {
        const currentRecord = recordResult.rows[0].world_record_time;
        if (!currentRecord || session.completion_time < currentRecord) {
          await db.query(
            'UPDATE level_stats SET world_record_time = $1, world_record_holder_id = $2 WHERE level_id = $3',
            [session.completion_time, req.user.id, id]
          );
        }
      }

      // Record in level_records for leaderboards
      await db.query(
        `INSERT INTO level_records (level_id, user_id, record_type, skill_rating, completion_time)
         VALUES ($1, $2, 'fastest_clear', $3, $4)
         ON CONFLICT (level_id, user_id, record_type) 
         DO UPDATE SET skill_rating = $3, completion_time = $4, recorded_at = NOW()
         WHERE level_records.completion_time > $4`,
        [id, req.user.id, newPlayerRating.skill_rating, session.completion_time]
      );

      // Record highest/lowest rated clears
      await db.query(
        `INSERT INTO level_records (level_id, user_id, record_type, skill_rating, completion_time)
         VALUES ($1, $2, 'highest_rated_clear', $3, $4)
         ON CONFLICT (level_id, user_id, record_type)
         DO UPDATE SET skill_rating = GREATEST(level_records.skill_rating, $3), recorded_at = NOW()`,
        [id, req.user.id, newPlayerRating.skill_rating, session.completion_time]
      );

      await db.query(
        `INSERT INTO level_records (level_id, user_id, record_type, skill_rating, completion_time)
         VALUES ($1, $2, 'lowest_rated_clear', $3, $4)
         ON CONFLICT (level_id, user_id, record_type)
         DO UPDATE SET skill_rating = LEAST(level_records.skill_rating, $3), recorded_at = NOW()`,
        [id, req.user.id, newPlayerRating.skill_rating, session.completion_time]
      );
    }

    // Update user stats if level was cleared
    if (session.completed) {
      await db.query(
        `INSERT INTO user_stats (user_id, total_clears)
         VALUES ($1, 1)
         ON CONFLICT (user_id)
         DO UPDATE SET total_clears = user_stats.total_clears + 1`,
        [req.user.id]
      );
    }

    res.json({ 
      message: 'Session ended and ratings updated',
      player_rating_change: newPlayerRating.rating_change,
      level_rating_change: newLevelRating.rating_change,
      new_skill_rating: newPlayerRating.skill_rating,
      new_difficulty_rating: newLevelRating.difficulty_rating,
      outcome_score: outcomeScore
    });
  } catch (err) {
    console.error('Error ending session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get level records (leaderboards)
router.get('/:id/records/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    // Whitelist valid record types
    const validTypes = ['fastest_clear', 'highest_rated_clear', 'lowest_rated_clear'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid record type' });
    }

    let orderBy = 'lr.completion_time ASC';
    if (type === 'highest_rated_clear') {
      orderBy = 'lr.skill_rating DESC';
    } else if (type === 'lowest_rated_clear') {
      orderBy = 'lr.skill_rating ASC';
    }

    const result = await db.query(
      `SELECT lr.*, u.username, u.avatar_url
       FROM level_records lr
       JOIN users u ON lr.user_id = u.id
       WHERE lr.level_id = $1 AND lr.record_type = $2
       ORDER BY ${orderBy}
       LIMIT $3`,
      [id, type, limit]
    );

    res.json({ records: result.rows });
  } catch (err) {
    console.error('Error fetching level records:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
