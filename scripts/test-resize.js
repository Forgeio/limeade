// Test the resize from bottom-left logic

function testResize() {
  console.log('Testing resize from bottom-left corner...\n');

  // Test case 1: Increase height
  console.log('Test 1: Increase height from 20 to 25');
  let levelData = {
    '5,10': 'ground',
    '5,15': 'tile',
    '10,19': 'spawn'
  };
  let oldHeight = 20;
  let newHeight = 25;
  let heightDiff = newHeight - oldHeight; // +5

  let newLevelData = {};
  Object.keys(levelData).forEach(key => {
    const [x, y] = key.split(',').map(Number);
    const newY = y + heightDiff;
    if (newY >= 0 && newY < newHeight) {
      const newKey = `${x},${newY}`;
      newLevelData[newKey] = levelData[key];
      console.log(`  Moved ${key} (${levelData[key]}) -> ${newKey}`);
    }
  });
  console.log('  Result:', JSON.stringify(newLevelData, null, 2));

  // Test case 2: Decrease height
  console.log('\nTest 2: Decrease height from 20 to 15');
  levelData = {
    '5,10': 'ground',  // Should move to 5,5
    '5,5': 'tile',     // Should move to 5,0
    '10,0': 'spawn',   // Should move to 10,-5 (out of bounds)
    '10,19': 'goal'    // Should move to 10,14
  };
  oldHeight = 20;
  newHeight = 15;
  heightDiff = newHeight - oldHeight; // -5

  newLevelData = {};
  Object.keys(levelData).forEach(key => {
    const [x, y] = key.split(',').map(Number);
    const newY = y + heightDiff;
    if (newY >= 0 && newY < newHeight) {
      const newKey = `${x},${newY}`;
      newLevelData[newKey] = levelData[key];
      console.log(`  Moved ${key} (${levelData[key]}) -> ${newKey}`);
    } else {
      console.log(`  Removed ${key} (${levelData[key]}) - out of bounds (newY=${newY})`);
    }
  });
  console.log('  Result:', JSON.stringify(newLevelData, null, 2));

  // Test case 3: No height change (only width)
  console.log('\nTest 3: Only width change (from 50 to 40), height stays at 20');
  levelData = {
    '35,10': 'ground',  // Within bounds
    '45,10': 'tile',    // Out of bounds (x >= 40)
    '10,19': 'spawn'    // Within bounds
  };
  const oldWidth = 50;
  const newWidth = 40;
  heightDiff = 0;

  newLevelData = {};
  Object.keys(levelData).forEach(key => {
    const [x, y] = key.split(',').map(Number);
    if (x < newWidth && y < newHeight) {
      newLevelData[key] = levelData[key];
      console.log(`  Kept ${key} (${levelData[key]})`);
    } else {
      console.log(`  Removed ${key} (${levelData[key]}) - out of bounds`);
    }
  });
  console.log('  Result:', JSON.stringify(newLevelData, null, 2));

  console.log('\n✅ All tests completed!');
}

testResize();
