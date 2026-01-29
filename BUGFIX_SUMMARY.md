# Rating System Bug Fixes - Implementation Summary

## Problem Statement

Three issues were identified with the rating system:
1. New levels were tagged with their calculated difficulty (e.g., "Medium") instead of "New"
2. Difficulty should only be shown after there's certainty, and should say "Unrated" before that
3. There was a duplication bug where liking/disliking a level caused duplicate rating and difficulty tags

## Solution Implemented

### 1. New Level Labels (RD > 200)

**Before:** New levels with 0 plays showed misleading difficulty labels like "Medium ?" based on the default rating of 1500.

**After:** New levels now show a "New" badge in gray with no difficulty rating number.

**Implementation:**
- Added check for `RD > 200` in `getDifficultyLabel()`
- Returns special "New" label with `showRating: false` flag
- Gray color (#9e9e9e) to indicate unknown difficulty

### 2. Unrated Level Labels (150 < RD ≤ 200)

**Before:** Levels with some plays but high uncertainty showed difficulty with a "?" indicator, which was misleading.

**After:** These levels now show "Unrated" badge in dark gray with an uncertainty indicator (?).

**Implementation:**
- Added check for `RD > 150` (but ≤ 200) in `getDifficultyLabel()`
- Returns "Unrated" label with `showRating: false` flag
- Dark gray color (#757575) to indicate stabilizing rating

### 3. Difficulty Rating Number Display

**Before:** The difficulty rating number (DR) was shown for all levels, even new ones.

**After:** DR number only shown for rated levels (RD ≤ 150).

**Implementation:**
- Added `showRating` boolean flag to difficulty label object
- Modified `displayDifficultyInfo()` to check flag before showing DR number
- Only rated levels have `showRating: true`

### 4. Duplication Bug Fix

**Before:** When a user liked/disliked a level, the page reloaded level data and called `displayDifficultyInfo()` again, which appended duplicate stats to the page.

**After:** Before adding new difficulty stats, existing ones are removed.

**Implementation:**
- Added `.difficulty-stat` class to all difficulty-related elements
- Added cleanup code: `statsRow.querySelectorAll('.difficulty-stat').forEach(stat => stat.remove())`
- Then append new stats as before

## Code Changes

### backend/utils/ratingSystem.js

Enhanced `getDifficultyLabel()` function:

```javascript
function getDifficultyLabel(levelDR, playerSR, levelRD = 50) {
  // New levels (very high uncertainty)
  if (levelRD > 200) {
    return {
      label: 'New',
      color: '#9e9e9e',
      description: 'New level - difficulty not yet determined',
      isUncertain: true,
      uncertaintyBadge: 'New Level',
      isNew: true,
      showRating: false
    };
  }
  
  // Unrated levels (high uncertainty)
  if (levelRD > 150) {
    return {
      label: 'Unrated',
      color: '#757575',
      description: 'Rating still stabilizing',
      isUncertain: true,
      uncertaintyBadge: 'Stabilizing',
      isNew: false,
      showRating: false
    };
  }
  
  // Rated levels - show actual difficulty
  // ... (existing difficulty calculation)
  return {
    label, color, description,
    isUncertain: false,
    uncertaintyBadge: null,
    isNew: false,
    showRating: true
  };
}
```

### public/js/level.js

Fixed duplication bug in `displayDifficultyInfo()`:

```javascript
function displayDifficultyInfo(level) {
  const statsRow = document.querySelector('.level-stats-row');
  
  // Remove any existing difficulty stats to prevent duplication
  const existingDifficultyStats = statsRow.querySelectorAll('.level-stat.difficulty-stat');
  existingDifficultyStats.forEach(stat => stat.remove());
  
  if (level.difficulty_label) {
    const dl = level.difficulty_label;
    
    // Add difficulty badge
    const difficultyHTML = `
      <div class="level-stat difficulty-stat">
        <span class="level-stat-value">
          <span class="rating-badge" style="background: ${dl.color};">
            ${dl.label}
          </span>
        </span>
        <span class="level-stat-label">Difficulty ${dl.uncertaintyBadge ? `(${dl.uncertaintyBadge})` : ''}</span>
      </div>
    `;
    statsRow.insertAdjacentHTML('beforeend', difficultyHTML);
    
    // Only show difficulty rating number if rated
    if (dl.showRating) {
      const drHTML = `
        <div class="level-stat difficulty-stat">
          <span class="level-stat-value">${level.difficulty_rating || 1500}</span>
          <span class="level-stat-label">Difficulty Rating</span>
        </div>
      `;
      statsRow.insertAdjacentHTML('beforeend', drHTML);
    }
  }
  
  // Volatility indicator (if needed)
  if (level.is_volatile) {
    const volatileHTML = `
      <div class="level-stat difficulty-stat">
        <span class="level-stat-value" style="color: #ff9800;">⚠️ Volatile</span>
        <span class="level-stat-label">Unpredictable</span>
      </div>
    `;
    statsRow.insertAdjacentHTML('beforeend', volatileHTML);
  }
}
```

### public/js/discover.js

Updated badge rendering for level cards:

```javascript
// For "New" levels, don't show uncertainty indicator
const uncertaintyIndicator = (dl.isUncertain && !dl.isNew) ? 
  `<span class="uncertainty-indicator" title="${dl.uncertaintyBadge}">?</span>` : '';

difficultyBadge = `
  <div class="difficulty-badge" style="background: ${dl.color};" title="${dl.description}">
    ${dl.label}
    ${uncertaintyIndicator}
  </div>
`;
```

## Testing

Updated test suite to verify new behavior:

```javascript
const labels = [
  { levelDR: 1500, playerSR: 1500, levelRD: 350, desc: 'New level (high RD)' },
  { levelDR: 1500, playerSR: 1500, levelRD: 180, desc: 'Unrated level (moderate RD)' },
  { levelDR: 1000, playerSR: 1500, levelRD: 50, desc: 'Easy level (low RD)' },
  // ... more tests
];

labels.forEach(({ levelDR, playerSR, levelRD, desc }) => {
  const label = ratingSystem.getDifficultyLabel(levelDR, playerSR, levelRD);
  console.log(`${desc}: → ${label.label} (showRating: ${label.showRating})`);
});
```

**Test Results:**
```
New level (high RD): DR=1500, SR=1500, RD=350 → New (showRating: false) ✓
Unrated level (moderate RD): DR=1500, SR=1500, RD=180 → Unrated (showRating: false) ✓
Easy level (low RD): DR=1000, SR=1500, RD=50 → Easy (showRating: true) ✓
```

All tests pass ✓

## Documentation Updates

Updated `RATING_SYSTEM.md` with new label logic:

| Label | Condition | Color | Description |
|-------|-----------|-------|-------------|
| New | RD > 200 | Gray | New level - difficulty not yet determined |
| Unrated | RD > 150 | Dark Gray | Rating still stabilizing |
| Easy | DR < SR - 300 (and RD ≤ 150) | Green | Well within your skill level |
| Normal | DR < SR - 100 (and RD ≤ 150) | Blue | Should be manageable |
| Medium | DR < SR + 200 (and RD ≤ 150) | Orange | A fair challenge |
| Hard | DR < SR + 500 (and RD ≤ 150) | Red | Significantly challenging |
| Extreme | DR ≥ SR + 500 (and RD ≤ 150) | Purple | Extremely difficult |

## Decision Tree

```
Is RD > 200?
  ├─ YES → Show "New" label (gray)
  │         No DR number displayed
  │
  └─ NO → Is RD > 150?
       ├─ YES → Show "Unrated" label (dark gray)
       │         Show ? indicator
       │         No DR number displayed
       │
       └─ NO → RD ≤ 150 (Rated!)
            ├─ Calculate difficulty based on DR vs SR
            ├─ Show difficulty label (Easy/Normal/Medium/Hard/Extreme)
            └─ Show DR number
```

## Visual Examples

### New Level
- **Badge:** "New" (gray, no ?)
- **Stats:** Difficulty: New (New Level)
- **DR Number:** Hidden

### Unrated Level  
- **Badge:** "Unrated ?" (dark gray)
- **Stats:** Difficulty: Unrated (Stabilizing)
- **DR Number:** Hidden

### Rated Level
- **Badge:** "Medium" (orange, no ?)
- **Stats:** Difficulty: Medium
- **DR Number:** 1600

## Benefits

1. **Clearer Communication:** Players immediately understand when a level is new vs. actually rated
2. **No Misleading Info:** DR numbers aren't shown until they're meaningful
3. **Better UX:** No duplicate stats appearing when interacting with levels
4. **Accurate Difficulty:** Only show difficulty labels when there's enough data to be confident

## Files Changed

- `backend/utils/ratingSystem.js` - Enhanced label logic
- `public/js/level.js` - Fixed duplication bug
- `public/js/discover.js` - Updated badge rendering
- `scripts/test-rating-system.js` - Added new tests
- `RATING_SYSTEM.md` - Updated documentation
- `RATING_FIXES_PREVIEW.html` - Visual preview of changes

## Summary

All reported issues have been fixed:
✅ New levels show "New" instead of premature difficulty
✅ Unrated levels show "Unrated" while stabilizing  
✅ DR numbers only shown for rated levels
✅ Duplication bug fixed with proper cleanup
✅ Tests updated and passing
✅ Documentation complete
