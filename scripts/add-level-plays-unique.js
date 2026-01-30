const db = require('../backend/config/database');

async function dedupeLevelPlays() {
  console.log('Deduplicating level_plays and enforcing unique (level_id, user_id)...');

  // Step 1: Deduplicate existing rows, keep best clear (completed first, fastest time)
  await db.query(`
    WITH ranked AS (
      SELECT id,
             level_id,
             user_id,
             completed,
             completion_time,
             ROW_NUMBER() OVER (
               PARTITION BY level_id, user_id
               ORDER BY completed DESC, completion_time NULLS LAST, id ASC
             ) AS rn,
             MIN(completion_time) FILTER (WHERE completed = true)
               OVER (PARTITION BY level_id, user_id) AS min_clear
      FROM level_plays
    ),
    updated AS (
      UPDATE level_plays lp
      SET completion_time = ranked.min_clear
      FROM ranked
      WHERE lp.id = ranked.id
        AND ranked.rn = 1
        AND ranked.completed = true
        AND ranked.min_clear IS NOT NULL
      RETURNING lp.id
    )
    DELETE FROM level_plays lp
    USING ranked
    WHERE lp.id = ranked.id
      AND ranked.rn > 1;
  `);
  console.log('✓ Deduplicated level_plays');

  // Step 2: Add unique index to enforce constraint going forward
  // Note: not using CONCURRENTLY to keep it simple; ensure script run when traffic is low
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_level_plays_level_user
    ON level_plays(level_id, user_id);
  `);
  console.log('✓ Created unique index uq_level_plays_level_user');
}

async function run() {
  try {
    await dedupeLevelPlays();
  } catch (err) {
    console.error('Error applying unique level plays migration:', err);
  } finally {
    await db.pool.end();
  }
}

run();
