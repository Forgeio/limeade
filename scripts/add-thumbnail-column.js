
const db = require('../backend/config/database');

async function addThumbnailColumn() {
  try {
    console.log('Adding thumbnail_path column to levels table...');
    await db.query(`
      ALTER TABLE levels 
      ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(255);
    `);
    console.log('✓ Added thumbnail_path column');
    process.exit(0);
  } catch (err) {
    console.error('Error adding column:', err);
    process.exit(1);
  }
}

addThumbnailColumn();
