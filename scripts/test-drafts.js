const db = require('../backend/config/database');

async function testDrafts() {
  console.log('Creating test user and drafts...');

  try {
    // Create a test user
    const userResult = await db.query(
      `INSERT INTO users (username, email, oauth_provider, oauth_id, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (oauth_provider, oauth_id) DO UPDATE 
       SET username = EXCLUDED.username
       RETURNING *`,
      ['testuser', 'test@example.com', 'test', 'test123', 'https://via.placeholder.com/150']
    );
    
    const user = userResult.rows[0];
    console.log('✓ Created test user:', user.username, '(ID:', user.id + ')');

    // Create user stats
    await db.query(
      `INSERT INTO user_stats (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    // Create some test drafts
    const drafts = [
      { title: 'New Level 1', description: 'First test draft' },
      { title: 'New Level 2', description: 'Second test draft' },
      { title: 'My Cool Level', description: 'A custom named draft' }
    ];

    for (const draft of drafts) {
      const levelResult = await db.query(
        `INSERT INTO levels (title, description, creator_id, level_data, published)
         VALUES ($1, $2, $3, $4, false)
         RETURNING *`,
        [draft.title, draft.description, user.id, JSON.stringify({ width: 50, height: 20, tiles: {} })]
      );
      
      console.log('✓ Created draft:', levelResult.rows[0].title);
    }

    // Create a published level
    const publishedResult = await db.query(
      `INSERT INTO levels (title, description, creator_id, level_data, published, published_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       RETURNING *`,
      ['My Published Level', 'This is a published level', user.id, JSON.stringify({ width: 50, height: 20, tiles: {} })]
    );

    const publishedLevel = publishedResult.rows[0];
    console.log('✓ Created published level:', publishedLevel.title);

    // Create level stats for published level
    await db.query(
      `INSERT INTO level_stats (level_id)
       VALUES ($1)`,
      [publishedLevel.id]
    );

    console.log('\n✅ Test data created successfully!');
    console.log('\nYou can now:');
    console.log(`  - View drafts: curl http://localhost:3000/api/users/${user.id}/drafts`);
    console.log(`  - View published levels: curl http://localhost:3000/api/users/${user.id}/levels`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating test data:', err);
    process.exit(1);
  }
}

testDrafts();
