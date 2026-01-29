/**
 * Simple tests for rating system calculations
 * Run with: node scripts/test-rating-system.js
 */

const ratingSystem = require('../backend/utils/ratingSystem');

console.log('Testing Rating System Calculations\n');
console.log('===================================\n');

// Test 1: Expected Clear Chance
console.log('Test 1: Expected Clear Chance');
console.log('------------------------------');
const playerSR1 = 1500;
const levelDR1 = 1500;
const expected1 = ratingSystem.calculateExpectedClearChance(playerSR1, levelDR1);
console.log(`Player SR: ${playerSR1}, Level DR: ${levelDR1}`);
console.log(`Expected Clear Chance: ${expected1.toFixed(3)} (should be ~0.5)\n`);

const playerSR2 = 1700;
const levelDR2 = 1500;
const expected2 = ratingSystem.calculateExpectedClearChance(playerSR2, levelDR2);
console.log(`Player SR: ${playerSR2}, Level DR: ${levelDR2}`);
console.log(`Expected Clear Chance: ${expected2.toFixed(3)} (should be >0.5)\n`);

const playerSR3 = 1300;
const levelDR3 = 1500;
const expected3 = ratingSystem.calculateExpectedClearChance(playerSR3, levelDR3);
console.log(`Player SR: ${playerSR3}, Level DR: ${levelDR3}`);
console.log(`Expected Clear Chance: ${expected3.toFixed(3)} (should be <0.5)\n`);

// Test 2: Outcome Score Calculation
console.log('Test 2: Outcome Score Calculation');
console.log('----------------------------------');

const session1 = { completed: true, attempts: 1, deaths: 0, furthest_progress: 100 };
const os1 = ratingSystem.calculateOutcomeScore(session1);
console.log(`First attempt clear: OS = ${os1} (should be 1.0)`);

const session2 = { completed: true, attempts: 5, deaths: 2, furthest_progress: 100 };
const os2 = ratingSystem.calculateOutcomeScore(session2);
console.log(`Clear with few deaths: OS = ${os2} (should be 0.9)`);

const session3 = { completed: true, attempts: 20, deaths: 8, furthest_progress: 100 };
const os3 = ratingSystem.calculateOutcomeScore(session3);
console.log(`Clear with many deaths: OS = ${os3} (should be 0.7)`);

const session4 = { completed: false, attempts: 50, deaths: 49, furthest_progress: 95 };
const os4 = ratingSystem.calculateOutcomeScore(session4);
console.log(`Near-clear (95% progress): OS = ${os4} (should be 0.5)`);

const session5 = { completed: false, attempts: 30, deaths: 29, furthest_progress: 60 };
const os5 = ratingSystem.calculateOutcomeScore(session5);
console.log(`Good progress (60%): OS = ${os5} (should be 0.3)`);

const session6 = { completed: false, attempts: 10, deaths: 10, furthest_progress: 10 };
const os6 = ratingSystem.calculateOutcomeScore(session6);
console.log(`No progress (10%): OS = ${os6} (should be 0.0)\n`);

// Test 3: Player Rating Update
console.log('Test 3: Player Rating Update');
console.log('-----------------------------');

const currentSR = 1500;
const currentRD = 350;
const outcomeScore = 0.9; // Good clear
const expectedScore = 0.5; // Even match
const newRating = ratingSystem.updatePlayerRating(currentSR, currentRD, outcomeScore, expectedScore);
console.log(`Current SR: ${currentSR}, RD: ${currentRD}`);
console.log(`Outcome: ${outcomeScore}, Expected: ${expectedScore}`);
console.log(`New SR: ${newRating.skill_rating}, RD: ${newRating.rating_deviation}`);
console.log(`Rating Change: ${newRating.rating_change > 0 ? '+' : ''}${newRating.rating_change}`);
console.log('(Player did better than expected, SR should increase)\n');

// Test 4: Level Rating Update
console.log('Test 4: Level Rating Update');
console.log('----------------------------');

const currentDR = 1500;
const currentLevelRD = 350;
const updateCount = 5;
const newLevelRating = ratingSystem.updateLevelRating(currentDR, currentLevelRD, outcomeScore, expectedScore, updateCount);
console.log(`Current DR: ${currentDR}, RD: ${currentLevelRD}`);
console.log(`Outcome: ${outcomeScore}, Expected: ${expectedScore}`);
console.log(`New DR: ${newLevelRating.difficulty_rating}, RD: ${newLevelRating.difficulty_rd}`);
console.log(`Rating Change: ${newLevelRating.rating_change > 0 ? '+' : ''}${newLevelRating.rating_change}`);
console.log('(Player did better than expected, DR should decrease)\n');

// Test 5: Difficulty Labels
console.log('Test 5: Difficulty Labels');
console.log('--------------------------');

const labels = [
  { levelDR: 1500, playerSR: 1500, levelRD: 350, desc: 'New level (high RD)' },
  { levelDR: 1500, playerSR: 1500, levelRD: 180, desc: 'Unrated level (moderate RD)' },
  { levelDR: 1000, playerSR: 1500, levelRD: 50, desc: 'Easy level (low RD)' },
  { levelDR: 1400, playerSR: 1500, levelRD: 50, desc: 'Normal level' },
  { levelDR: 1600, playerSR: 1500, levelRD: 50, desc: 'Medium level' },
  { levelDR: 1800, playerSR: 1500, levelRD: 50, desc: 'Hard level' },
  { levelDR: 2100, playerSR: 1500, levelRD: 50, desc: 'Extreme level' },
];

labels.forEach(({ levelDR, playerSR, levelRD, desc }) => {
  const label = ratingSystem.getDifficultyLabel(levelDR, playerSR, levelRD);
  console.log(`${desc}: DR=${levelDR}, SR=${playerSR}, RD=${levelRD} → ${label.label} (showRating: ${label.showRating})`);
});

console.log('\n');

// Test 6: Volatility Detection
console.log('Test 6: Volatility Detection');
console.log('-----------------------------');

const stableOutcomes = [0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.5, 0.4, 0.6];
const stableExpected = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
const isStableVolatile = ratingSystem.detectVolatility(stableOutcomes, stableExpected);
console.log(`Stable level (consistent performance): Volatile = ${isStableVolatile} (should be false)`);

const volatileOutcomes = [0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.9, 0.0, 0.8, 0.1];
const volatileExpected = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
const isVolatile = ratingSystem.detectVolatility(volatileOutcomes, volatileExpected);
console.log(`Volatile level (inconsistent performance): Volatile = ${isVolatile} (should be true)`);

const unfairOutcomes = [0.2, 0.1, 0.3, 0.2, 0.1, 0.2, 0.3, 0.1, 0.2, 0.1];
const unfairExpected = [0.7, 0.8, 0.7, 0.8, 0.7, 0.8, 0.7, 0.8, 0.7, 0.8];
const isUnfair = ratingSystem.detectVolatility(unfairOutcomes, unfairExpected);
console.log(`Unfair level (expected high clear but low actual): Volatile = ${isUnfair} (should be true)`);

console.log('\n===================================');
console.log('All tests completed!');
console.log('===================================\n');
