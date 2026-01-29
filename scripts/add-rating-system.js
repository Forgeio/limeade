const db = require('../backend/config/database');

async function addRatingSystem() {
  console.log('Adding rating system to database...');

  try {
    // Add rating columns to users table
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS skill_rating INTEGER DEFAULT 1500,
      ADD COLUMN IF NOT EXISTS rating_deviation INTEGER DEFAULT 350,
      ADD COLUMN IF NOT EXISTS last_rating_update TIMESTAMP DEFAULT NOW();
    `);
    console.log('✓ Added rating columns to users table');

    // Add rating columns to levels table
    await db.query(`
      ALTER TABLE levels
      ADD COLUMN IF NOT EXISTS difficulty_rating INTEGER DEFAULT 1500,
      ADD COLUMN IF NOT EXISTS difficulty_rd INTEGER DEFAULT 350,
      ADD COLUMN IF NOT EXISTS is_volatile BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS rating_update_count INTEGER DEFAULT 0;
    `);
    console.log('✓ Added rating columns to levels table');

    // Create play_sessions table for multi-attempt compression
    await db.query(`
      CREATE TABLE IF NOT EXISTS play_sessions (
        id SERIAL PRIMARY KEY,
        level_id INTEGER REFERENCES levels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        attempts INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        furthest_progress DECIMAL(5,2) DEFAULT 0.00,
        outcome_score DECIMAL(5,2) DEFAULT 0.00,
        completed BOOLEAN DEFAULT FALSE,
        completion_time INTEGER,
        session_start TIMESTAMP DEFAULT NOW(),
        session_end TIMESTAMP,
        rating_updated BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('✓ Created play_sessions table');

    // Create level_records table for tracking various leaderboard categories
    await db.query(`
      CREATE TABLE IF NOT EXISTS level_records (
        id SERIAL PRIMARY KEY,
        level_id INTEGER REFERENCES levels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        record_type VARCHAR(50) NOT NULL,
        skill_rating INTEGER,
        completion_time INTEGER,
        recorded_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(level_id, user_id, record_type)
      );
    `);
    console.log('✓ Created level_records table');

    // Create indexes for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_skill_rating ON users(skill_rating DESC);
      CREATE INDEX IF NOT EXISTS idx_levels_difficulty_rating ON levels(difficulty_rating DESC);
      CREATE INDEX IF NOT EXISTS idx_play_sessions_user ON play_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_play_sessions_level ON play_sessions(level_id);
      CREATE INDEX IF NOT EXISTS idx_level_records_level ON level_records(level_id);
      CREATE INDEX IF NOT EXISTS idx_level_records_type ON level_records(record_type);
    `);
    console.log('✓ Created indexes for rating system');

    // Update user_stats to add seasonal tracking
    await db.query(`
      ALTER TABLE user_stats
      ADD COLUMN IF NOT EXISTS seasonal_skill_rating INTEGER DEFAULT 1500,
      ADD COLUMN IF NOT EXISTS seasonal_rating_deviation INTEGER DEFAULT 350,
      ADD COLUMN IF NOT EXISTS blind_mode_skill_rating INTEGER DEFAULT 1500,
      ADD COLUMN IF NOT EXISTS blind_mode_rating_deviation INTEGER DEFAULT 350;
    `);
    console.log('✓ Added seasonal and blind mode ratings to user_stats');

    console.log('\n✅ Rating system database schema complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding rating system:', err);
    process.exit(1);
  }
}

addRatingSystem();
