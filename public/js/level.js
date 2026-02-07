// Level detail page logic
let currentLevelId = null;
let currentLeaderboardType = 'fastest_clear';

function initLevelPage() {
    if (!document.getElementById('levelTitle')) return;

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (!id) {
            if (typeof window.spaNavigate === 'function') {
                window.spaNavigate('/discover');
            } else {
                window.location.href = '/discover';
            }
        return;
    }

    currentLevelId = id;
    loadLevelDetails(id);
    loadUserStatus(id);
    loadLeaderboard(id, 'fastest_clear');
}

document.addEventListener('DOMContentLoaded', initLevelPage);
window.addEventListener('spa:navigate', initLevelPage);

function goBack() {
  if (document.referrer.includes(window.location.host)) {
    window.history.back();
  } else {
        if (typeof window.spaNavigate === 'function') {
            window.spaNavigate('/discover');
        } else {
            window.location.href = '/discover';
        }
  }
}

async function loadLevelDetails(id) {
  try {
    const response = await fetch(`/api/levels/${id}`);
    if (!response.ok) {
        if (response.status === 404) {
            document.querySelector('.level-container').innerHTML = '<div style="text-align:center; padding:40px;"><h2>Level Not Found</h2><a href="/discover">Back to Discover</a></div>';
            return;
        }
        throw new Error('Failed to load level');
    }
    
    const level = await response.json();
    renderLevel(level);
  } catch (err) {
    console.error('Error loading level:', err);
    alert('Error loading level details');
  }
}

async function loadUserStatus(id) {
    try {
        const response = await fetch(`/api/levels/${id}/user-status`);
        if (response.ok) {
            const status = await response.json();
            updateLikeButtons(status.has_liked, status.has_beaten);
        }
    } catch (err) {
        console.error('Error loading user status', err);
    }
}

function updateLikeButtons(hasLiked, hasBeaten) {
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');
    const ratingNote = document.getElementById('ratingNote');
    
    // Reset classes
    likeBtn.classList.remove('active-like');
    dislikeBtn.classList.remove('active-dislike');
    
    if (hasLiked === true) likeBtn.classList.add('active-like');
    if (hasLiked === false) dislikeBtn.classList.add('active-dislike');
    
    if (!hasBeaten) {
        likeBtn.disabled = true;
        dislikeBtn.disabled = true;
        ratingNote.textContent = '(Must clear level to rate)';
    } else {
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
        ratingNote.textContent = '';
    }
}

async function rateLevelLike() {
    rateLevel(true);
}

async function rateLevelDislike() {
    rateLevel(false);
}

async function rateLevel(isLike) {
    const likeBtn = document.getElementById('likeBtn');
    if (likeBtn.disabled) return;
    
    try {
        const response = await fetch(`/api/levels/${currentLevelId}/like`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_like: isLike })
        });
        
        if (response.ok) {
            // Reload level stats to update counts
            loadLevelDetails(currentLevelId);
            // Verify new status
            loadUserStatus(currentLevelId);
        } else {
            const err = await response.json();
            alert(err.error || 'Failed to rate level');
        }
    } catch (err) {
        console.error('Rating failed', err);
    }
}

function renderLevel(level) {
  document.title = `${level.title} - Limeade`;
  
  // Header Info
  const levelTitle = document.getElementById('levelTitle');
  const creatorLink = document.getElementById('creatorLink');
  const publishedDate = document.getElementById('publishedDate');
  
  if (levelTitle) levelTitle.textContent = level.title;
  if (creatorLink) {
    creatorLink.textContent = level.creator_name || 'Unknown';
    creatorLink.href = `/profile?id=${level.creator_id}`;
  }
  
  const date = new Date(level.published_at || level.created_at);
  if (publishedDate) {
    publishedDate.textContent = date.toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  
  // Avatar
  const avatarEl = document.getElementById('creatorAvatar');
  if (avatarEl) {
    if (level.creator_avatar) {
        avatarEl.innerHTML = `<img src="${level.creator_avatar}" alt="${level.creator_name}">`;
    } else {
        avatarEl.textContent = (level.creator_name || 'U').substring(0, 2).toUpperCase();
    }
  }

  // Thumbnail
  const thumbEl = document.getElementById('levelThumbnail');
  if (thumbEl) {
    if (level.thumbnail_path) {
        thumbEl.src = level.thumbnail_path;
        thumbEl.style.display = 'block';
    } else {
        thumbEl.style.display = 'none';
    }
  }

  // Quick stats
  const statLikes = document.getElementById('statLikes');
  const statPlays = document.getElementById('statPlays');
  if (statLikes) statLikes.textContent = (level.total_likes || 0);
  if (statPlays) statPlays.textContent = (level.total_plays || 0);
  
  // Description
  const descEl = document.getElementById('levelDescription');
  if (descEl) {
    if (level.description) {
        descEl.textContent = level.description;
        descEl.style.fontStyle = 'normal';
        descEl.style.color = 'var(--text-primary)';
    } else {
        descEl.textContent = 'No description provided.';
        descEl.style.fontStyle = 'italic';
        descEl.style.color = 'var(--text-secondary)';
    }
  }

  // Square Card 1: Clear Rate
  const statClearRate = document.getElementById('statClearRate');
  const statClearDetail = document.getElementById('statClearDetail');
  if (statClearRate) statClearRate.textContent = (level.clear_rate || '0.00') + '%';
  if (statClearDetail) {
    statClearDetail.textContent = `${level.total_clears || 0}/${level.total_plays || 0} clears`;
  }

  // Square Card 2: World Record
  const recordEl = document.getElementById('statRecord');
  const holderContainer = document.getElementById('recordHolderContainer');
  const noRecordLabel = document.getElementById('noRecordLabel');

  if (recordEl && holderContainer && noRecordLabel) {
    if (level.world_record_time) {
        recordEl.textContent = formatTime(level.world_record_time);
        noRecordLabel.style.display = 'none';
        holderContainer.style.display = 'flex';
        
        const recordHolderName = document.getElementById('recordHolderName');
        if (recordHolderName) {
          recordHolderName.textContent = level.world_record_holder_name || 'Unknown';
        }
        const holderAvatar = document.getElementById('recordHolderAvatar');
        if (holderAvatar) {
          if (level.world_record_holder_avatar) {
              holderAvatar.innerHTML = `<img src="${level.world_record_holder_avatar}">`;
          } else {
              holderAvatar.textContent = (level.world_record_holder_name || 'U').substring(0, 1).toUpperCase();
          }
        }
    } else {
        recordEl.textContent = '--:--';
        holderContainer.style.display = 'none';
      noRecordLabel.style.display = 'block';
    }
  }

  // Square Card 3: Difficulty
  const diffCard = document.getElementById('difficultyCard');
  const diffLabel = document.getElementById('difficultyLabel');
  const diffSub = document.getElementById('difficultySub');
  
  if (diffCard && diffLabel && diffSub && level.difficulty_label) {
      const { label, color, description, isNew, showRating } = level.difficulty_label;
      diffCard.style.backgroundColor = color;
      // Ensure text is white for colored backgrounds
      diffCard.style.color = '#fff';
      
      diffLabel.textContent = label;
      
      if (isNew) {
          diffSub.textContent = 'New';
      } else if (showRating) {
          diffSub.textContent = `Rating: ${level.difficulty_rating || '?'}`;
      } else {
          diffSub.textContent = 'Unrated';
      }
  }
}

function playLevel() {
    if (typeof window.spaNavigate === 'function') {
        window.spaNavigate(`/play?id=${currentLevelId}`);
    } else {
        window.location.href = `/play?id=${currentLevelId}`;
    }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
}

function switchLeaderboard(type) {
    // Update tabs
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    if (type === 'fastest') document.getElementById('tab-fastest').classList.add('active');
    if (type === 'highest_rated') document.getElementById('tab-highest').classList.add('active'); // Mapped to Top Players logic if needed

    // Map UI type to API type
    let apiType = 'fastest_clear';
    if (type === 'highest_rated') apiType = 'highest_rated_clear'; // technically hard clears
    // or just sort by SR? The API supports fastest_clear, highest_rated_clear, lowest_rated_clear

    currentLeaderboardType = apiType;
    loadLeaderboard(currentLevelId, apiType);
}

async function loadLeaderboard(id, type) {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px;">Loading...</td></tr>';
    
    try {
        const response = await fetch(`/api/levels/${id}/records/${type}`);
        if (!response.ok) throw new Error('Failed to load leaderboard');
        
        const data = await response.json();
        const records = data.records || [];
        
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: #888;">No records yet. Be the first!</td></tr>';
            return;
        }
        
        tbody.innerHTML = records.map((rec, index) => {
            const date = new Date(rec.recorded_at).toLocaleDateString();
            const avatarHtml = rec.avatar_url 
                ? `<img src="${rec.avatar_url}" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:8px;">`
                : `<div style="display:inline-block;width:24px;height:24px;border-radius:50%;background:#eee;vertical-align:middle;margin-right:8px;text-align:center;line-height:24px;font-size:10px;font-weight:bold;color:#555;">${(rec.username||'U')[0]}</div>`;
            
            let valueDisplay = '';
            if (type === 'fastest_clear') {
                valueDisplay = formatTime(rec.completion_time);
            } else {
                // For rated clears, show SR they had
                valueDisplay = `${rec.skill_rating || '?'} SR`;
            }

            // Top 3 medals
            let rankDisplay = index + 1;
            if (index === 0) rankDisplay = '🥇';
            if (index === 1) rankDisplay = '🥈';
            if (index === 2) rankDisplay = '🥉';

            return `
                <tr>
                    <td class="lb-rank">${rankDisplay}</td>
                    <td>
                        <a href="/profile?id=${rec.user_id}" style="text-decoration:none; color:inherit; display:flex; align-items:center;">
                            ${avatarHtml}
                            <span style="font-weight:500">${rec.username || 'Unknown'}</span>
                        </a>
                    </td>
                    <td style="text-align: right; font-family: monospace; font-size: 14px;">${valueDisplay}</td>
                    <td style="text-align: right; font-size: 12px; color: #888;">${date}</td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--danger-color);">Failed to load records</td></tr>';
    }
}
