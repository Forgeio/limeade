const db = require('../backend/config/database');

async function seedDatabase() {
  console.log('Seeding database with test data...\n');

  try {
    // Create test users
    const userNames = [
      { name: 'Alex', provider: 'google' },
      { name: 'Jordan', provider: 'discord' },
      { name: 'Taylor', provider: 'google' },
      { name: 'Morgan', provider: 'discord' },
      { name: 'Casey', provider: 'google' },
      { name: 'Riley', provider: 'discord' },
      { name: 'Jamie', provider: 'google' },
      { name: 'Quinn', provider: 'discord' },
      { name: 'Avery', provider: 'google' },
      { name: 'Drew', provider: 'discord' },
    ];

    const users = [];
    for (let i = 0; i < userNames.length; i++) {
      const { name, provider } = userNames[i];
      const result = await db.query(
        `INSERT INTO users (username, email, oauth_provider, oauth_id, avatar_url, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${i * 10} days')
         ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
         RETURNING *`,
        [
          name,
          `${name.toLowerCase()}@example.com`,
          provider,
          `${provider}_${i}`,
          null,
        ]
      );
      users.push(result.rows[0]);
    }
    console.log(`✓ Created ${users.length} test users`);

    // Create user stats
    for (let i = 0; i < users.length; i++) {
      const clears = Math.floor(1000 - i * 80 - Math.random() * 50);
      const records = Math.floor(100 - i * 8 - Math.random() * 5);
      const playtime = Math.floor(50 + i * 5) * 3600; // in seconds
      const levelsCreated = Math.floor(10 + Math.random() * 20);
      
      await db.query(
        `INSERT INTO user_stats (user_id, total_clears, total_records, total_playtime, levels_created, total_likes_received)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE 
         SET total_clears = EXCLUDED.total_clears,
             total_records = EXCLUDED.total_records,
             total_playtime = EXCLUDED.total_playtime,
             levels_created = EXCLUDED.levels_created,
             total_likes_received = EXCLUDED.total_likes_received`,
        [users[i].id, clears, records, playtime, levelsCreated, levelsCreated * 45]
      );
    }
    console.log(`✓ Created user stats for ${users.length} users`);

    // Create test levels
    const levelTemplates = [
      'Challenging Platformer',
      'Speed Run Special',
      'Puzzle Paradise',
      'Enemy Gauntlet',
      'Coin Collection',
      'Sky High Adventure',
      'Underground Maze',
      'Boss Battle Arena',
      'Precision Jumps',
      'Hidden Secrets',
    ];

    const levels = [];
    for (let i = 0; i < 30; i++) {
      const creatorIndex = i % users.length;
      const templateIndex = i % levelTemplates.length;
      const levelNum = Math.floor(i / levelTemplates.length) + 1;
      
      const levelData = {
        width: 200,
        height: 15,
        tiles: [],
        enemies: [],
        items: [],
        spawnPoint: { x: 2, y: 10 },
        goalPoint: { x: 190, y: 10 },
      };

      const result = await db.query(
        `INSERT INTO levels (title, description, creator_id, level_data, published, published_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${i * 2} days', NOW() - INTERVAL '${i * 2 + 1} days')
         RETURNING *`,
        [
          `${levelTemplates[templateIndex]} ${levelNum}`,
          `An exciting platformer level with challenging obstacles and hidden secrets. Created by ${users[creatorIndex].username}. Can you complete it?`,
          users[creatorIndex].id,
          JSON.stringify(levelData),
          true,
        ]
      );
      levels.push(result.rows[0]);
    }
    console.log(`✓ Created ${levels.length} test levels`);

    // Create level stats
    for (let i = 0; i < levels.length; i++) {
      const totalPlays = Math.floor(500 + Math.random() * 1500);
      const totalClears = Math.floor(totalPlays * (0.2 + Math.random() * 0.3));
      const totalLikes = Math.floor(100 + Math.random() * 900);
      const totalDislikes = Math.floor(10 + Math.random() * 90);
      const clearRate = ((totalClears / totalPlays) * 100).toFixed(2);
      const recordTime = Math.floor(30 + Math.random() * 300); // in seconds
      const recordHolderId = users[Math.floor(Math.random() * users.length)].id;

      await db.query(
        `INSERT INTO level_stats (level_id, total_plays, total_clears, total_likes, total_dislikes, clear_rate, world_record_time, world_record_holder_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (level_id) DO UPDATE
         SET total_plays = EXCLUDED.total_plays,
             total_clears = EXCLUDED.total_clears,
             total_likes = EXCLUDED.total_likes,
             total_dislikes = EXCLUDED.total_dislikes,
             clear_rate = EXCLUDED.clear_rate,
             world_record_time = EXCLUDED.world_record_time,
             world_record_holder_id = EXCLUDED.world_record_holder_id`,
        [levels[i].id, totalPlays, totalClears, totalLikes, totalDislikes, clearRate, recordTime, recordHolderId]
      );
    }
    console.log(`✓ Created level stats for ${levels.length} levels`);

    // Create some level plays
    for (let i = 0; i < 100; i++) {
      const level = levels[Math.floor(Math.random() * levels.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const completed = Math.random() > 0.3;
      const completionTime = completed ? Math.floor(30 + Math.random() * 300) : null;

      await db.query(
        `INSERT INTO level_plays (level_id, user_id, completed, completion_time, played_at)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`,
        [level.id, user.id, completed, completionTime]
      );
    }
    console.log(`✓ Created 100 test level plays`);

    // Create some level likes/dislikes
    for (let i = 0; i < 150; i++) {
      const level = levels[Math.floor(Math.random() * levels.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const isLike = Math.random() > 0.15;

      try {
        await db.query(
          `INSERT INTO level_likes (level_id, user_id, is_like, created_at)
           VALUES ($1, $2, $3, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')
           ON CONFLICT (level_id, user_id) DO NOTHING`,
          [level.id, user.id, isLike]
        );
      } catch (err) {
        // Ignore duplicate key errors
      }
    }
    console.log(`✓ Created test level likes/dislikes`);

    console.log('\n✅ Database seeded successfully!');
    console.log(`\nTest Users Created: ${users.length}`);
    console.log(`Test Levels Created: ${levels.length}`);
    console.log('\nYou can now start the server and test the APIs!');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
}

seedDatabase();
