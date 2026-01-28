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
    // Redirect to discover if no ID
    window.location.href = 'discover.html';
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
        window.location.href = 'discover.html';
        return;
      }
      throw new Error('Failed to fetch level');
    }
    
    currentLevel = await response.json();
    displayLevel(currentLevel);
  } catch (err) {
    console.error('Error loading level:', err);
    alert('Error loading level');
    window.location.href = 'discover.html';
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
  creatorLink.textContent = level.creator_display_name || level.creator_name || 'Unknown';
  creatorLink.href = `profile.html?id=${level.creator_id}`;
  
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
  window.location.href = `play.html?id=${currentLevelId}`;
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

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
