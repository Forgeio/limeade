/**
 * Rating System Utilities
 * Implements Glicko-style rating with graded outcomes
 */

// Constants
const DEFAULT_RATING = 1500;
const DEFAULT_RD = 350;
const MIN_RD = 30;
const MAX_RD = 350;
const K_FACTOR = 32; // Sensitivity of rating changes
const RD_DECAY_PER_DAY = 1; // RD increases over time for inactive players

/**
 * Calculate expected clear chance (Elo-style)
 * @param {number} playerSR - Player skill rating
 * @param {number} levelDR - Level difficulty rating
 * @returns {number} Expected probability of clear (0-1)
 */
function calculateExpectedClearChance(playerSR, levelDR) {
  return 1 / (1 + Math.pow(10, (levelDR - playerSR) / 400));
}

/**
 * Calculate outcome score based on play session
 * @param {object} session - Play session data
 * @returns {number} Outcome score (0-1)
 */
function calculateOutcomeScore(session) {
  const { completed, attempts, deaths, furthest_progress, completion_time } = session;
  
  // If completed
  if (completed) {
    // First attempt clear = 1.0
    if (attempts === 1 && deaths === 0) {
      return 1.0;
    }
    // Few deaths = 0.9
    if (deaths <= 3) {
      return 0.9;
    }
    // Many deaths = 0.7
    if (deaths <= 10) {
      return 0.7;
    }
    // Brute forced = 0.6
    return 0.6;
  }
  
  // Not completed - based on progress
  const progress = furthest_progress || 0;
  
  // Near-clear (90%+ progress) = 0.5
  if (progress >= 90) {
    return 0.5;
  }
  // Good progress (50-90%) = 0.3
  if (progress >= 50) {
    return 0.3;
  }
  // Some progress (20-50%) = 0.15
  if (progress >= 20) {
    return 0.15;
  }
  // No progress = 0.0
  return 0.0;
}

/**
 * Calculate rating change for player
 * @param {number} currentSR - Current skill rating
 * @param {number} currentRD - Current rating deviation
 * @param {number} outcomeScore - Outcome score (0-1)
 * @param {number} expectedScore - Expected clear chance (0-1)
 * @returns {object} New rating and RD
 */
function updatePlayerRating(currentSR, currentRD, outcomeScore, expectedScore) {
  // Calculate rating change scaled by RD (higher uncertainty = faster changes)
  const rdFactor = Math.min(currentRD / DEFAULT_RD, 1.5);
  const delta = K_FACTOR * rdFactor * (outcomeScore - expectedScore);
  
  const newSR = Math.round(currentSR + delta);
  
  // Decrease RD after each match (more certain)
  const newRD = Math.max(MIN_RD, Math.round(currentRD * 0.95));
  
  return {
    skill_rating: newSR,
    rating_deviation: newRD,
    rating_change: Math.round(delta)
  };
}

/**
 * Calculate rating change for level (inverse of player)
 * @param {number} currentDR - Current difficulty rating
 * @param {number} currentRD - Current difficulty RD
 * @param {number} outcomeScore - Outcome score (0-1)
 * @param {number} expectedScore - Expected clear chance (0-1)
 * @param {number} updateCount - Number of times level has been rated
 * @returns {object} New rating and RD
 */
function updateLevelRating(currentDR, currentRD, outcomeScore, expectedScore, updateCount) {
  // Level rating moves inverse to player
  // If player does better than expected, level was easier -> DR decreases
  // If player does worse than expected, level was harder -> DR increases
  
  const rdFactor = Math.min(currentRD / DEFAULT_RD, 1.5);
  const delta = K_FACTOR * rdFactor * (expectedScore - outcomeScore);
  
  // Apply diminishing returns based on update count
  const stabilityFactor = Math.max(0.3, 1 / Math.log10(updateCount + 10));
  const adjustedDelta = delta * stabilityFactor;
  
  const newDR = Math.round(currentDR + adjustedDelta);
  
  // Decrease RD as level gets more plays (more certain)
  const newRD = Math.max(MIN_RD, Math.round(currentRD * 0.98));
  
  return {
    difficulty_rating: newDR,
    difficulty_rd: newRD,
    rating_change: Math.round(adjustedDelta)
  };
}

/**
 * Detect if a level is volatile/unfair
 * @param {array} recentOutcomes - Array of recent outcome scores
 * @param {array} recentExpected - Array of expected scores for same sessions
 * @returns {boolean} Whether level appears volatile
 */
function detectVolatility(recentOutcomes, recentExpected) {
  if (recentOutcomes.length < 10) {
    return false; // Not enough data
  }
  
  // Calculate variance in (outcome - expected)
  const differences = recentOutcomes.map((outcome, i) => 
    outcome - recentExpected[i]
  );
  
  const mean = differences.reduce((a, b) => a + b, 0) / differences.length;
  const variance = differences.reduce((sum, diff) => 
    sum + Math.pow(diff - mean, 2), 0
  ) / differences.length;
  
  // High variance suggests volatility
  // Also check for consistent underperformance despite high expected
  const avgExpected = recentExpected.reduce((a, b) => a + b, 0) / recentExpected.length;
  const avgOutcome = recentOutcomes.reduce((a, b) => a + b, 0) / recentOutcomes.length;
  
  const isHighVariance = variance > 0.15;
  const isUnexpectedlyHard = avgExpected > 0.6 && avgOutcome < 0.3;
  
  return isHighVariance || isUnexpectedlyHard;
}

/**
 * Get difficulty label for a level relative to player
 * @param {number} levelDR - Level difficulty rating
 * @param {number} playerSR - Player skill rating
 * @param {number} levelRD - Level rating deviation
 * @returns {object} Label and color
 */
function getDifficultyLabel(levelDR, playerSR, levelRD = 50) {
  const difference = levelDR - playerSR;
  
  // Add uncertainty badge if RD is high
  const isUncertain = levelRD > 150;
  
  let label, color, description;
  
  if (difference < -300) {
    label = 'Easy';
    color = '#4caf50';
    description = 'Well within your skill level';
  } else if (difference < -100) {
    label = 'Normal';
    color = '#2196f3';
    description = 'Should be manageable';
  } else if (difference < 200) {
    label = 'Medium';
    color = '#ff9800';
    description = 'A fair challenge';
  } else if (difference < 500) {
    label = 'Hard';
    color = '#f44336';
    description = 'Significantly challenging';
  } else {
    label = 'Extreme';
    color = '#9c27b0';
    description = 'Extremely difficult';
  }
  
  return {
    label,
    color,
    description,
    isUncertain,
    uncertaintyBadge: isUncertain ? 'New / Stabilizing' : null
  };
}

/**
 * Update RD for inactive players (increases uncertainty over time)
 * @param {number} currentRD - Current rating deviation
 * @param {Date} lastUpdate - Last rating update timestamp
 * @returns {number} Updated RD
 */
function updateInactiveRD(currentRD, lastUpdate) {
  const now = new Date();
  const daysSinceUpdate = (now - new Date(lastUpdate)) / (1000 * 60 * 60 * 24);
  
  const rdIncrease = Math.floor(daysSinceUpdate * RD_DECAY_PER_DAY);
  return Math.min(MAX_RD, currentRD + rdIncrease);
}

module.exports = {
  DEFAULT_RATING,
  DEFAULT_RD,
  calculateExpectedClearChance,
  calculateOutcomeScore,
  updatePlayerRating,
  updateLevelRating,
  detectVolatility,
  getDifficultyLabel,
  updateInactiveRD
};
