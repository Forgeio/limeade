# Limeade Rating System

This document describes the implementation of the Glicko-style rating system in Limeade.

## Overview

The rating system treats every play session as a match between the **Player** (with a Skill Rating) and the **Level** (with a Difficulty Rating). Instead of binary win/loss, it uses a **graded outcome score** (0-1) that captures nuanced performance.

## Core Concepts

### 1. Player Ratings

Each player has:
- **SR (Skill Rating)**: Estimated skill level (default: 1500)
- **RD (Rating Deviation)**: Uncertainty in the rating (default: 350, min: 30, max: 350)
- New/inactive players have high RD → faster rating changes
- RD decreases with each match (more certainty)
- RD increases over time for inactive players

### 2. Level Ratings

Each level has:
- **DR (Difficulty Rating)**: Estimated difficulty (default: 1500)
- **RD (Difficulty Deviation)**: Uncertainty (default: 350)
- **Volatility Flag**: Indicates unpredictable/unfair levels
- New levels start with high uncertainty and stabilize over time

### 3. Expected Clear Chance

Uses classic Elo logic:
```
ExpectedClearChance = 1 / (1 + 10^((DR - SR) / 400))
```

- If SR >> DR → high expected clear chance
- If DR >> SR → low expected clear chance

### 4. Outcome Score (OS)

Instead of binary clear/fail, we calculate a graded score:

| Result | Outcome Score |
|--------|---------------|
| First-attempt clear | 1.0 |
| Clear with few deaths (≤3) | 0.9 |
| Clear with many deaths (≤10) | 0.7 |
| Brute-forced clear | 0.6 |
| Near-clear (90%+ progress) | 0.5 |
| Good progress (50-90%) | 0.3 |
| Some progress (20-50%) | 0.15 |
| No progress | 0.0 |

### 5. Rating Updates

After each session:

**Player Update:**
```
ΔSR_player ∝ K × (RD/350) × (OS - ExpectedClearChance)
```

**Level Update (Inverse):**
```
ΔDR_level ∝ K × (RD/350) × (ExpectedClearChance - OS) × StabilityFactor
```

Where:
- K = 32 (sensitivity constant)
- StabilityFactor = diminishing returns based on number of plays
- Both RD values decrease after each match (more certainty)

## Database Schema

### New Tables

#### `play_sessions`
Tracks multi-attempt play sessions:
- `attempts`: Number of attempts made
- `deaths`: Total deaths
- `furthest_progress`: Percentage of level reached
- `outcome_score`: Calculated OS (0-1)
- `completed`: Whether level was cleared
- `rating_updated`: Whether ratings have been updated

#### `level_records`
Tracks various leaderboard categories:
- `record_type`: 'fastest_clear', 'highest_rated_clear', 'lowest_rated_clear'
- `skill_rating`: Player's SR at time of record
- `completion_time`: Time taken

### Modified Tables

#### `users`
Added columns:
- `skill_rating`: Player's skill rating
- `rating_deviation`: Player's rating uncertainty
- `last_rating_update`: Timestamp of last rating change

#### `levels`
Added columns:
- `difficulty_rating`: Level's difficulty rating
- `difficulty_rd`: Level's rating uncertainty
- `is_volatile`: Whether level is flagged as volatile
- `rating_update_count`: Number of times rating has been updated

#### `user_stats`
Added columns:
- `seasonal_skill_rating`: Rating for current season
- `seasonal_rating_deviation`: RD for seasonal rating
- `blind_mode_skill_rating`: Rating for blind mode (first attempts only)
- `blind_mode_rating_deviation`: RD for blind mode

## API Endpoints

### Session Management

**POST** `/api/levels/:id/session/start`
- Starts a new play session
- Returns `session_id`

**PUT** `/api/levels/:id/session/:sessionId`
- Updates session with attempts, deaths, progress
- Body: `{ attempts, deaths, furthest_progress, completed, completion_time }`

**POST** `/api/levels/:id/session/:sessionId/end`
- Ends session and updates ratings
- Returns rating changes for both player and level
- Records in leaderboards if applicable

### Leaderboards

**GET** `/api/users/leaderboard/:type`
- Types: `skill_rating`, `seasonal_rating`, `blind_mode_rating`, `clears`, `records`
- Returns paginated player rankings

**GET** `/api/levels/:id/records/:type`
- Types: `fastest_clear`, `highest_rated_clear`, `lowest_rated_clear`
- Returns top records for a specific level

## Difficulty Labels

Levels are labeled relative to the player's skill:

| Label | Condition | Color | Description |
|-------|-----------|-------|-------------|
| New | RD > 200 | Gray | New level - difficulty not yet determined |
| Unrated | RD > 150 | Dark Gray | Rating still stabilizing |
| Easy | DR < SR - 300 (and RD ≤ 150) | Green | Well within your skill level |
| Normal | DR < SR - 100 (and RD ≤ 150) | Blue | Should be manageable |
| Medium | DR < SR + 200 (and RD ≤ 150) | Orange | A fair challenge |
| Hard | DR < SR + 500 (and RD ≤ 150) | Red | Significantly challenging |
| Extreme | DR ≥ SR + 500 (and RD ≤ 150) | Purple | Extremely difficult |

Additional badges:
- **New Level** - Shown when RD > 200 (brand new level)
- **Stabilizing** (?) - Shown when 150 < RD ≤ 200 (unrated level)
- **Volatile** (⚠️) - Shown for levels flagged as unpredictable

**Note:** The difficulty rating number (DR) is only displayed once a level is rated (RD ≤ 150). New and Unrated levels do not show a specific difficulty number.

## Volatility Detection

A level is marked as volatile if (with at least 10 sessions):
- High variance in (outcome - expected) across sessions (variance > 0.15)
- OR consistent underperformance despite high expected clear rate (avg expected > 0.6, avg outcome < 0.3)

Volatile levels:
- Still receive ratings
- Are flagged with a warning badge
- Can be filtered separately in future features

## UI Components

### Level Cards
- Display difficulty badge with color-coded label
- Show uncertainty indicator for new levels
- Display volatility warning badge

### Level Detail Page
- Shows difficulty rating and label
- Displays DR number
- Lists fastest clears leaderboard
- Lists highest-rated clears (hardest players to beat it)
- Lists lowest-rated clears (most impressive clears)

### Leaderboards Page
Tabs for:
- **Skill Rating**: Global SR rankings
- **Seasonal Rating**: Current season rankings
- **Blind Mode**: First-attempt-only rankings
- **Global Clears**: Total clears
- **Global Records**: World records held

Player cards show:
- Rank (with special styling for top 3)
- Username
- Main stat (SR with RD for rating tabs, clears/records for others)
- Secondary stats (clears, records, playtime)

### Profile Page
Shows:
- Skill Rating with RD
- Total clears
- World records
- Levels created
- Playtime

## Installation

To add the rating system to an existing Limeade database:

```bash
node scripts/add-rating-system.js
```

This will:
1. Add rating columns to `users` and `levels` tables
2. Create `play_sessions` and `level_records` tables
3. Add seasonal/blind mode columns to `user_stats`
4. Create necessary indexes

## Implementation Notes

### Anti-Grind Measures
- Session-based rating (not per-death)
- Diminishing returns on level rating changes
- Hard cap on rating change per session

### Performance Considerations
- Indexes on all rating columns for fast sorting
- Pagination on all leaderboards
- Volatility detection runs only after 10+ sessions

### Future Enhancements
- Seasonal resets
- Blind mode enforcement
- Ranked/unranked mode separation
- Level filtering by difficulty label
- Player rank display (Bronze/Silver/Gold tiers)
- Historical rating graphs

## Example Workflow

1. Player starts level: `POST /api/levels/123/session/start`
2. Player attempts level, dies multiple times
3. Frontend updates session: `PUT /api/levels/123/session/456`
   - `{ attempts: 15, deaths: 14, furthest_progress: 85, completed: false }`
4. Player closes level: `POST /api/levels/123/session/456/end`
5. System calculates:
   - Outcome Score: ~0.5 (near-clear, 85% progress)
   - Expected Score: 0.6 (player SR 1600, level DR 1550)
   - Player underperformed: SR decreases by ~15
   - Level was harder than expected: DR increases by ~10
6. Both RD values decrease (more certainty)
7. If completed, records are updated in `level_records`

## Credits

Based on the Glicko rating system with modifications for graded outcomes and level rating.
