# Limeade - AI Coding Assistant Instructions

## Project Overview
Limeade is a Mario Maker-inspired platformer with level creation, social features, and a Glicko-style rating system. Stack: Node.js/Express backend, PostgreSQL database, vanilla JavaScript frontend with HTML5 Canvas.

## Architecture

### Backend Structure
- **Server**: Express app in [server.js](../server.js) with session-based auth via Passport (Google/Discord/GitHub OAuth)
- **Database**: PostgreSQL accessed through [backend/config/database.js](../backend/config/database.js) using `pg` Pool
- **Routes**: RESTful APIs in `backend/routes/` (auth, users, levels)
- **Middleware**: [backend/middleware/auth.js](../backend/middleware/auth.js) provides `isAuthenticated()` and `isOwner()` guards
- **Rating System**: [backend/utils/ratingSystem.js](../backend/utils/ratingSystem.js) implements Glicko-style player skill ratings (SR) and level difficulty ratings (DR) with graded outcome scores (0-1 scale). See [RATING_SYSTEM.md](../RATING_SYSTEM.md) for formulas.

### Frontend Structure
- **Pages**: Static HTML in `public/` (discover, editor, play, profile, leaderboards)
- **Game Engine**: [public/js/play.js](../public/js/play.js) (~4000 lines) handles physics, collision, enemies, attacks
- **Level Editor**: [public/js/editor.js](../public/js/editor.js) with camera panning, zoom, tile placement, draft system
- **Graphics**: [public/js/graphics.js](../public/js/graphics.js) provides `drawTile()` and autotiling logic
- **Navigation**: [public/js/navigation.js](../public/js/navigation.js) renders universal nav bar with auth state

### Database Schema
Core tables: `users`, `user_stats`, `levels`, `level_stats`, `level_plays`, `level_likes`, `play_sessions`, `level_records`. See [scripts/setup-database.js](../scripts/setup-database.js) for full schema and indexes.

## Key Patterns & Conventions

### 1. Tile System
Tiles are stored as objects: `{type: 'spike', rotation: 90}` or strings `'ground'`. Key types: `ground`, `tile`, `stone_brick`, `plank` (solid), `spike`, `enemy`, `spike_enemy`, `spawn`, `goal`, `coin`, `diamond`, `health`, `onoff_block`, `onoff_switch`. Grid is 16px per tile.

**Rotation**: Only `spike` tiles support rotation (0°, 90°, 180°, 270°). Use `parseTileEntry()` to normalize, `isRotatableTile()` to check support.

### 2. Physics Constants
Defined at top of [public/js/play.js](../public/js/play.js):
- Gravity: 0.25, max fall speed: 6
- Player speed: 4, jump velocity: -7
- Wall slide speed: 1.5, wall jump: `{x: 3, y: -5}`
- Attack: 10 frames duration, 14 frames cooldown, 16px range
- Invulnerability: 90 frames (players), 30 frames (enemies)

### 3. Collision Detection
- `getCollidingTiles(entity, includeHazards)`: Returns tiles overlapping entity AABB. Pass `includeHazards=true` to include spikes/goals.
- `isSolidTile(type)`: Returns true for `ground`, `tile`, `stone_brick`, `plank`, `onoff_block` (when active).
- Spike collision uses SAT (Separating Axis Theorem) polygon intersection via `spikeIntersect()`.
- Goal has custom hitbox: 3px wide × 40px tall, bottom-aligned to grid tile.

### 4. Game State Management
State in [public/js/play.js](../public/js/play.js) is centralized in `game` object. Key properties:
- `game.tiles`: Object mapping `"x,y"` to tile entries
- `game.enemies`: Array of enemy objects with physics state
- `game.player`: Player state (position, velocity, health, attack timers)
- `game.collectedCoins/collectedTokens`: Sets tracking collected items
- `game.onOffState`: Boolean controlling switch blocks

Reset level via `resetLevelState()`, which recreates enemies from tile data and clears collections.

### 5. Rating System Integration
When play session ends, calculate outcome score in [backend/routes/levels.js](../backend/routes/levels.js):
```javascript
const { outcome_score } = ratingSystem.calculateOutcomeScore({
  completed, attempts, deaths, furthest_progress
});
```
Then update both player SR and level DR via `ratingSystem.updatePlayerRating()` and `updateLevelRating()`. See [RATING_SYSTEM.md](../RATING_SYSTEM.md) for graded outcomes (first-try clear = 1.0, brute force = 0.6, etc.).

### 6. Asset Loading
Images/sounds loaded asynchronously in editor/play pages. Check `game.assets.tilesheet`, `game.assets.soundJump`, etc. before using. Fallback to color-based rendering if sprites missing.

### 7. Draft System
Levels can be unpublished drafts (max 8 per user). API endpoints:
- `GET /api/levels/drafts` - Fetch user's drafts
- `POST /api/levels/:id/publish` - Publish draft (sets `published=true`, `published_at=NOW()`)
- `POST /api/levels/:id/unpublish` - Revert to draft

## Development Workflow

### Setup
1. Install PostgreSQL, Node.js (v14+)
2. Create database: `createdb limeade` (or follow [BACKEND_SETUP.md](../BACKEND_SETUP.md))
3. Create `.env` with DB credentials (see [BACKEND_SETUP.md](../BACKEND_SETUP.md))
4. Run `npm run db:setup` to create tables
5. Run `npm run db:seed` for test data
6. Start server: `npm start` (port 3000)

### Common Commands
- `npm start` - Start server
- `npm run db:setup` - Create schema
- `npm run db:seed` - Seed test data
- `npm run db:add-rating` - Add rating system columns (migration)
- `npm run test:rating` - Test rating calculations

### Database Migrations
Add migration scripts to `scripts/` (e.g., `add-rating-system.js`). Use `ALTER TABLE` with `IF NOT EXISTS` checks. Update `package.json` scripts and document in PR.

## Common Tasks

### Adding a New Tile Type
1. Add type to tile object in [public/js/editor.js](../public/js/editor.js) (line ~467)
2. Add rendering logic to `renderEditorTile()` in editor and `renderTiles()` in play
3. If solid, update `isSolidTile()` in [public/js/play.js](../public/js/play.js)
4. Add sprite to `public/graphics/` and load in assets
5. Update `drawTile()` in [public/js/graphics.js](../public/js/graphics.js) for fallback rendering

### Modifying Game Physics
All constants at top of [public/js/play.js](../public/js/play.js). Change values there, then test in play mode. Wall jump logic in `tryWallJump()`, ground jump in `performGroundJump()`.

### Adding API Endpoints
1. Create route handler in `backend/routes/` (e.g., `levels.js`)
2. Use `isAuthenticated` middleware for protected routes
3. Query DB via `db.query(sql, params)` - always use parameterized queries
4. Register route in [server.js](../server.js): `app.use('/api/levels', require('./backend/routes/levels'))`

### Frontend-Backend Communication
- Frontend uses `fetch('/api/...')` with credentials
- Backend returns JSON, checks `req.isAuthenticated()` for user session
- User object available as `req.user` when authenticated
- CORS enabled, JSON body limit: 10MB (for level data)

## Testing
Currently manual testing. Load editor at `/editor`, play at `/play?id=<level_id>`. Check browser console for errors. Test rating system with `npm run test:rating`.

## Important Notes
- Level data stored as JSONB in `levels.level_data` column (includes tiles, music, background)
- Player hitbox: 14×14px, enemies: 14×14px (spike enemy: 14×20px bottom-aligned)
- Clean URL routing: `/discover` serves `discover.html` (no `.html` extension needed)
- Session secret defaults to `'limeade-secret-key-change-in-production'` - change in production!
- Autotiling uses 4-corner vertex masking (see `getVertexMask()` in play.js)
