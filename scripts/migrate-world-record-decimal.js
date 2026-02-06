const db = require('../backend/config/database');

async function migrateWorldRecordToDecimal() {
  console.log('Migrating world_record_time to DECIMAL...');

  try {
    // Change world_record_time from INTEGER to DECIMAL(10,3)
    // DECIMAL(10,3) allows up to 9999999.999 seconds (about 2777 hours)
    await db.query(`
      ALTER TABLE level_stats 
      ALTER COLUMN world_record_time TYPE DECIMAL(10,3);
    `);
    console.log('✓ Updated level_stats.world_record_time to DECIMAL(10,3)');

    // Also update completion_time in level_plays
    await db.query(`
      ALTER TABLE level_plays 
      ALTER COLUMN completion_time TYPE DECIMAL(10,3);
    `);
    console.log('✓ Updated level_plays.completion_time to DECIMAL(10,3)');

    // Update level_records table if it exists
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'level_records'
      );
    `);

    if (tableExists.rows[0].exists) {
      await db.query(`
        ALTER TABLE level_records 
        ALTER COLUMN completion_time TYPE DECIMAL(10,3);
      `);
      console.log('✓ Updated level_records.completion_time to DECIMAL(10,3)');
    }

    console.log('\n✅ Migration complete!');
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during migration:', err);
    await db.end();
    process.exit(1);
  }
}

migrateWorldRecordToDecimal();
