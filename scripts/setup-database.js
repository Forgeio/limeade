const db = require('../backend/config/database');

async function setupDatabase() {
  console.log('Setting up database schema...');

  try {
    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(30) UNIQUE,
        email VARCHAR(255) UNIQUE,
        oauth_provider VARCHAR(50) NOT NULL,
        oauth_id VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        control_scheme JSONB DEFAULT '{"left":"ArrowLeft","right":"ArrowRight","up":"ArrowUp","down":"ArrowDown","jump":"ArrowUp","attack":"Space"}',
        username_changed_at TIMESTAMP,
        needs_username BOOLEAN DEFAULT TRUE,
        skill_rating INTEGER DEFAULT 1500,
        rating_deviation INTEGER DEFAULT 350,
        last_rating_update TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP DEFAULT NOW(),
        UNIQUE(oauth_provider, oauth_id)
      );
    `);
    console.log('✓ Created users table');

    // Create user_stats table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        total_clears INTEGER DEFAULT 0,
        total_records INTEGER DEFAULT 0,
        total_playtime INTEGER DEFAULT 0,
        levels_created INTEGER DEFAULT 0,
        total_likes_received INTEGER DEFAULT 0,
        seasonal_skill_rating INTEGER DEFAULT 1500,
        seasonal_rating_deviation INTEGER DEFAULT 350,
        blind_mode_skill_rating INTEGER DEFAULT 1500,
        blind_mode_rating_deviation INTEGER DEFAULT 350,
        UNIQUE(user_id)
      );
    `);
    console.log('✓ Created user_stats table');

    // Create levels table
    await db.query(`
      CREATE TABLE IF NOT EXISTS levels (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        level_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        published BOOLEAN DEFAULT FALSE,
        published_at TIMESTAMP,
        thumbnail_path VARCHAR(255),
        difficulty_rating INTEGER DEFAULT 1500,
        difficulty_rd INTEGER DEFAULT 350,
        is_volatile BOOLEAN DEFAULT FALSE,
        rating_update_count INTEGER DEFAULT 0
      );
    `);
    console.log('✓ Created levels table');

    // Create level_stats table
    await db.query(`
      CREATE TABLE IF NOT EXISTS level_stats (
        id SERIAL PRIMARY KEY,
        level_id INTEGER REFERENCES levels(id) ON DELETE CASCADE,
        total_plays INTEGER DEFAULT 0,
        total_clears INTEGER DEFAULT 0,
        total_likes INTEGER DEFAULT 0,
        total_dislikes INTEGER DEFAULT 0,
        world_record_time INTEGER,
        world_record_holder_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        clear_rate DECIMAL(5,2) DEFAULT 0.00,
        UNIQUE(level_id)
      );
    `);
    console.log('✓ Created level_stats table');

    // Create level_plays table to track individual plays
    await db.query(`
      CREATE TABLE IF NOT EXISTS level_plays (
        id SERIAL PRIMARY KEY,
        level_id INTEGER REFERENCES levels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        completed BOOLEAN DEFAULT FALSE,
        completion_time INTEGER,
        has_beaten BOOLEAN DEFAULT FALSE,
        played_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Created level_plays table');

    // Create level_likes table
    await db.query(`
      CREATE TABLE IF NOT EXISTS level_likes (
        id SERIAL PRIMARY KEY,
        level_id INTEGER REFERENCES levels(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        is_like BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(level_id, user_id)
      );
    `);
    console.log('✓ Created level_likes table');

    // Create play_sessions table for rating system
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

    // Create level_records table for rating leaderboards
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
      CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
      CREATE INDEX IF NOT EXISTS idx_users_skill_rating ON users(skill_rating DESC);
      CREATE INDEX IF NOT EXISTS idx_levels_creator ON levels(creator_id);
      CREATE INDEX IF NOT EXISTS idx_levels_published ON levels(published, published_at);
      CREATE INDEX IF NOT EXISTS idx_levels_difficulty_rating ON levels(difficulty_rating DESC);
      CREATE INDEX IF NOT EXISTS idx_level_stats_plays ON level_stats(total_plays DESC);
      CREATE INDEX IF NOT EXISTS idx_level_stats_likes ON level_stats(total_likes DESC);
      CREATE INDEX IF NOT EXISTS idx_level_plays_user ON level_plays(user_id);
      CREATE INDEX IF NOT EXISTS idx_level_plays_level ON level_plays(level_id);
      CREATE INDEX IF NOT EXISTS idx_user_stats_clears ON user_stats(total_clears DESC);
      CREATE INDEX IF NOT EXISTS idx_user_stats_records ON user_stats(total_records DESC);
      CREATE INDEX IF NOT EXISTS idx_play_sessions_user ON play_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_play_sessions_level ON play_sessions(level_id);
      CREATE INDEX IF NOT EXISTS idx_level_records_level ON level_records(level_id);
      CREATE INDEX IF NOT EXISTS idx_level_records_type ON level_records(record_type);
    `);
    console.log('✓ Created indexes');

    console.log('\n✅ Database schema setup complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error setting up database:', err);
    process.exit(1);
  }
}

setupDatabase();
