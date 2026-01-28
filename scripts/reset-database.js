const db = require('../backend/config/database');

async function resetDatabase() {
  console.log('⚠️  Resetting database - this will DELETE ALL DATA...\n');

  try {
    // Drop all tables in correct order (respecting foreign keys)
    console.log('Dropping existing tables...');
    
    await db.query('DROP TABLE IF EXISTS level_likes CASCADE');
    console.log('  ✓ Dropped level_likes');
    
    await db.query('DROP TABLE IF EXISTS level_plays CASCADE');
    console.log('  ✓ Dropped level_plays');
    
    await db.query('DROP TABLE IF EXISTS level_stats CASCADE');
    console.log('  ✓ Dropped level_stats');
    
    await db.query('DROP TABLE IF EXISTS levels CASCADE');
    console.log('  ✓ Dropped levels');
    
    await db.query('DROP TABLE IF EXISTS user_stats CASCADE');
    console.log('  ✓ Dropped user_stats');
    
    await db.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('  ✓ Dropped users');

    console.log('\n✅ All tables dropped successfully!');
    console.log('\nRun "node scripts/setup-database.js" to recreate tables with the new schema.\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    process.exit(1);
  }
}

resetDatabase();
