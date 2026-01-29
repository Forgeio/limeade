// Level detail page functionality

let currentLevelId = null;
let currentLevel = null;
let userStatus = { has_beaten: false, has_liked: null };

// Get level ID from URL
function getLevelIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// Initialize page
window.addEventListener('DOMContentLoaded', async () => {
  currentLevelId = getLevelIdFromUrl();
  
  if (!currentLevelId) {
    // Redirect to home if no ID
    window.location.href = '/';
    return;
  }
  
  await loadLevel();
  await loadUserStatus();
});

// Load level data
async function loadLevel() {
  try {
    const response = await fetch(`/api/levels/${currentLevelId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        alert('Level not found');
        window.location.href = '/';
        return;
      }
      throw new Error('Failed to fetch level');
    }
    
    currentLevel = await response.json();
    displayLevel(currentLevel);
  } catch (err) {
    console.error('Error loading level:', err);
    alert('Error loading level');
    window.location.href = '/';
  }
}

// Load user's status with this level
async function loadUserStatus() {
  try {
    const response = await fetch(`/api/levels/${currentLevelId}/user-status`);
    
    if (response.ok) {
      userStatus = await response.json();
      updateRatingButtons();
    }
  } catch (err) {
    console.error('Error loading user status:', err);
  }
}

// Display level data
function displayLevel(level) {
  // Set title
  document.getElementById('levelTitle').textContent = level.title || 'Untitled Level';
  
  // Set creator
  const creatorLink = document.getElementById('creatorLink');
  creatorLink.textContent = level.creator_name || 'Unknown';
  creatorLink.href = `/profile?id=${level.creator_id}`;
  
  // Set published date
  const publishedDate = new Date(level.published_at);
  document.getElementById('publishedDate').textContent = publishedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Set description
  document.getElementById('levelDescription').textContent = 
    level.description || 'No description provided.';
  
  // Set stats
  document.getElementById('statPlays').textContent = level.total_plays || 0;
  document.getElementById('statClears').textContent = level.total_clears || 0;
  document.getElementById('statClearRate').textContent = 
    level.clear_rate ? `${level.clear_rate}%` : '0%';
  document.getElementById('statLikes').textContent = level.total_likes || 0;
  
  // Set world record
  if (level.world_record_time) {
    const minutes = Math.floor(level.world_record_time / 60);
    const seconds = level.world_record_time % 60;
    document.getElementById('statRecord').textContent = 
      `${minutes}:${String(seconds).padStart(2, '0')}`;
  } else {
    document.getElementById('statRecord').textContent = '--:--';
  }
  
  // Update like/dislike counts
  document.getElementById('likeCount').textContent = level.total_likes || 0;
  document.getElementById('dislikeCount').textContent = level.total_dislikes || 0;
  
  // Display difficulty rating info
  displayDifficultyInfo(level);
  
  // Load level records
  loadLevelRecords();
}

// Update rating buttons based on user status
function updateRatingButtons() {
  const likeBtn = document.getElementById('likeBtn');
  const dislikeBtn = document.getElementById('dislikeBtn');
  const ratingNote = document.getElementById('ratingNote');
  
  // Enable/disable buttons based on whether user has beaten the level
  likeBtn.disabled = !userStatus.has_beaten;
  dislikeBtn.disabled = !userStatus.has_beaten;
  
  // Remove active classes
  likeBtn.classList.remove('active-like');
  dislikeBtn.classList.remove('active-dislike');
  
  // Set active state based on current rating
  if (userStatus.has_liked === true) {
    likeBtn.classList.add('active-like');
  } else if (userStatus.has_liked === false) {
    dislikeBtn.classList.add('active-dislike');
  }
  
  // Update note
  if (!userStatus.has_beaten) {
    ratingNote.textContent = 'You must beat this level before you can rate it.';
    ratingNote.style.color = 'var(--text-secondary)';
  } else {
    ratingNote.textContent = '';
  }
}

// Play level
function playLevel() {
  if (!currentLevelId) return;
  window.location.href = `/play?id=${currentLevelId}`;
}

// Rate level with like
async function rateLevelLike() {
  await rateLevel(true);
}

// Rate level with dislike
async function rateLevelDislike() {
  await rateLevel(false);
}

// Rate level
async function rateLevel(isLike) {
  if (!userStatus.has_beaten) {
    alert('You must beat this level before you can rate it.');
    return;
  }
  
  try {
    const response = await fetch(`/api/levels/${currentLevelId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_like: isLike })
    });
    
    if (response.ok) {
      // Update user status
      userStatus.has_liked = isLike;
      updateRatingButtons();
      
      // Reload level to get updated like/dislike counts
      await loadLevel();
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to rate level');
    }
  } catch (err) {
    console.error('Error rating level:', err);
    alert('Error rating level');
  }
}

// Go back to discover page
function goBack() {
  // Try to go back in history, or default to discover page
  if (document.referrer && document.referrer.includes(window.location.host)) {
    window.history.back();
  } else {
    window.location.href = 'discover.html';
  }
}

// Display difficulty rating information
function displayDifficultyInfo(level) {
  const statsRow = document.querySelector('.level-stats-row');
  
  if (level.difficulty_label) {
    const dl = level.difficulty_label;
    
    // Add difficulty stat
    const difficultyHTML = `
      <div class="level-stat">
        <span class="level-stat-value">
          <span class="rating-badge" style="background: ${dl.color};">
            ${dl.label}
          </span>
        </span>
        <span class="level-stat-label">Difficulty ${dl.isUncertain ? '(Stabilizing)' : ''}</span>
      </div>
    `;
    
    statsRow.insertAdjacentHTML('beforeend', difficultyHTML);
    
    // Add difficulty rating number
    const drHTML = `
      <div class="level-stat">
        <span class="level-stat-value">${level.difficulty_rating || 1500}</span>
        <span class="level-stat-label">Difficulty Rating</span>
      </div>
    `;
    
    statsRow.insertAdjacentHTML('beforeend', drHTML);
  }
  
  // Add volatile indicator if needed
  if (level.is_volatile) {
    const volatileHTML = `
      <div class="level-stat">
        <span class="level-stat-value" style="color: #ff9800;">⚠️ Volatile</span>
        <span class="level-stat-label">Unpredictable</span>
      </div>
    `;
    
    statsRow.insertAdjacentHTML('beforeend', volatileHTML);
  }
}

// Load level records (leaderboards)
async function loadLevelRecords() {
  const container = document.querySelector('.comments-section');
  
  if (!container) return;
  
  try {
    // Fetch different record types
    const [fastestResponse, highestResponse, lowestResponse] = await Promise.all([
      fetch(`/api/levels/${currentLevelId}/records/fastest_clear?limit=5`),
      fetch(`/api/levels/${currentLevelId}/records/highest_rated_clear?limit=5`),
      fetch(`/api/levels/${currentLevelId}/records/lowest_rated_clear?limit=5`)
    ]);
    
    const fastest = fastestResponse.ok ? await fastestResponse.json() : { records: [] };
    const highest = highestResponse.ok ? await highestResponse.json() : { records: [] };
    const lowest = lowestResponse.ok ? await lowestResponse.json() : { records: [] };
    
    // Build records HTML
    let recordsHTML = '<div class="records-section">';
    
    // Fastest clears
    if (fastest.records && fastest.records.length > 0) {
      recordsHTML += `
        <div class="records-header">⚡ Fastest Clears</div>
        <div class="records-list">
          ${fastest.records.map((record, idx) => createRecordItem(record, idx + 1, 'time')).join('')}
        </div>
      `;
    }
    
    // Highest rated clears
    if (highest.records && highest.records.length > 0) {
      recordsHTML += `
        <div class="records-header" style="margin-top: 24px;">🏆 Highest Rated Clears</div>
        <div class="records-list">
          ${highest.records.map((record, idx) => createRecordItem(record, idx + 1, 'rating')).join('')}
        </div>
      `;
    }
    
    // Lowest rated clears (impressive!)
    if (lowest.records && lowest.records.length > 0) {
      recordsHTML += `
        <div class="records-header" style="margin-top: 24px;">💪 Lowest Rated Clears (Most Impressive)</div>
        <div class="records-list">
          ${lowest.records.map((record, idx) => createRecordItem(record, idx + 1, 'rating')).join('')}
        </div>
      `;
    }
    
    recordsHTML += '</div>';
    
    // Insert before comments section
    container.insertAdjacentHTML('beforebegin', recordsHTML);
  } catch (err) {
    console.error('Error loading level records:', err);
  }
}

// Create record item HTML
function createRecordItem(record, rank, type) {
  const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  
  let statHTML = '';
  if (type === 'time' && record.completion_time) {
    const minutes = Math.floor(record.completion_time / 60);
    const seconds = record.completion_time % 60;
    statHTML = `
      <div class="record-stat">
        <svg class="icon"><use href="icons.svg#icon-timer"/></svg>
        <span>${minutes}:${String(seconds).padStart(2, '0')}</span>
      </div>
    `;
  }
  
  if (record.skill_rating) {
    statHTML += `
      <div class="record-stat">
        <svg class="icon"><use href="icons.svg#icon-star"/></svg>
        <span>SR: ${record.skill_rating}</span>
      </div>
    `;
  }
  
  return `
    <div class="record-item">
      <div class="record-player">
        <span class="record-rank ${rankClass}">${rank}.</span>
        <span>${escapeHtml(record.username)}</span>
      </div>
      <div class="record-stats">
        ${statHTML}
      </div>
    </div>
  `;
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
