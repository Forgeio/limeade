// Profile Page Logic
(function() {
  let currentTab = 'published';
  let deleteConfirmResolver = null;
  let profileUser = null;

  window.navigateInternal = function(url) {
    if (typeof window.spaNavigate === 'function') {
      window.spaNavigate(url);
    } else {
      window.location.href = url;
    }
  }
  
  // Create alias for internal use
  const navigateInternal = window.navigateInternal;

async function initProfilePage() {
  const profileHeader = document.querySelector('.profile-header');
  if (!profileHeader) return;

    console.log('[Profile] DOMContentLoaded fired');
    
    // Show loading state
  if (profileHeader) profileHeader.style.opacity = '0';
    
    // Wait for navigation.js to sync user from backend first
    // by fetching user directly here as well
    let currentUser = null;
    
    // Try to sync with backend
    try {
        console.log('[Profile] Fetching /auth/user...');
        const res = await fetch('/auth/user');
        console.log('[Profile] /auth/user response:', res.status);
        if (res.ok) {
            const data = await res.json();
            console.log('[Profile] User data:', data);
            currentUser = {
                name: data.username,
                avatar: data.avatar_url,
                provider: data.oauth_provider,
                id: data.id
            };
            localStorage.setItem('user', JSON.stringify(currentUser));
        } else if (res.status === 401) {
            console.log('[Profile] Not authenticated (401)');
            localStorage.removeItem('user');
            currentUser = null;
        }
    } catch (e) {
        console.log('[Profile] Session sync failed, trying local storage', e);
        // Fallback to localStorage
        currentUser = JSON.parse(localStorage.getItem('user'));
    }

    console.log('[Profile] currentUser after sync:', currentUser);

    // Check if we are viewing another user's profile
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id');
    
    console.log('[Profile] profileId from URL:', profileId);
    
    // Determine whose profile to show
    if (profileId) {
        // Fetch public profile info
        console.log('[Profile] Fetching profile for id:', profileId);
        const user = await fetchUserProfile(profileId);
        console.log('[Profile] Fetched user:', user);
        if (user) {
          profileUser = user;
          updateProfileDisplay(user);
            // Show content with fade-in immediately after updating display
            const profileHeader = document.querySelector('.profile-header');
            if (profileHeader) {
                profileHeader.style.transition = 'opacity 0.3s ease';
                profileHeader.style.opacity = '1';
            }
            // Load tab content after display is shown
            await loadTabContent('published', user.id);
            // Hide drafts tab if not owner
            if (!currentUser || String(currentUser.id) !== String(user.id)) {
                const draftsTab = document.querySelector('.selector-tab[data-tab="drafts"]');
                if (draftsTab) draftsTab.style.display = 'none';
            }
        } else {
            // User not found, redirect home
            navigateInternal('/');
            return;
        }
    } else if (currentUser && currentUser.id) {
        // Redirect to own profile with ID in URL for consistency
        console.log('[Profile] Redirecting to own profile with ID:', currentUser.id);
        navigateInternal(`/profile?id=${currentUser.id}`);
        return;
    } else {
        // No ID and not logged in 
        console.log('[Profile] No user, redirecting to login');
        navigateInternal('/login');
        return;
    }

  setupDeleteConfirmModal();
}

document.addEventListener('DOMContentLoaded', initProfilePage);
window.addEventListener('spa:navigate', initProfilePage);

async function fetchUserProfile(id) {
    try {
        const response = await fetch(`/api/users/${id}`);
        if (response.ok) return await response.json();
    } catch (e) { console.error(e); }
    return null;
}


function updateProfileDisplay(user) {
    const profileName = document.getElementById('profileName');
    const profileAvatar = document.getElementById('profileAvatar');
    
    // Handle both API format (username) and localStorage format (name)
    const displayName = user.username || 'Guest User';

    if (profileName) {
        profileName.textContent = displayName;
    }

    if (profileAvatar) {
      if (user.avatar_url) {
        profileAvatar.innerHTML = `<img class="avatar-image" src="${user.avatar_url}" alt="${displayName}">`;
      } else {
        // Get initials from name
        const initials = displayName
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .substring(0, 2);
        profileAvatar.textContent = initials;
      }
    }
    
    // Update member since date
    const memberSince = document.getElementById('memberSince');
    if (memberSince && user.created_at) {
        const date = new Date(user.created_at);
        memberSince.textContent = `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }
    
    // Update stats if available
    if (user.stats) {
        const statClears = document.getElementById('statClears');
        const statRecords = document.getElementById('statRecords');
        const statLevelsCreated = document.getElementById('statLevelsCreated');
        const statPlaytime = document.getElementById('statPlaytime');
        
        if (statClears) statClears.textContent = user.stats.total_clears || 0;
        if (statRecords) statRecords.textContent = user.stats.total_records || 0;
        if (statLevelsCreated) statLevelsCreated.textContent = user.stats.levels_created || 0;
        
        if (statPlaytime) {
            const hours = Math.floor((user.stats.total_playtime || 0) / 3600);
            statPlaytime.textContent = `${hours}h`;
        }
    }
    
    // Update skill rating if available
    if (user.skill_rating !== undefined) {
        const statSkillRating = document.getElementById('statSkillRating');
        if (statSkillRating) {
            const rd = user.rating_deviation || 350;
            statSkillRating.innerHTML = `${user.skill_rating} <span style="font-size: 14px; color: var(--text-secondary);">±${rd}</span>`;
        }
    }
}

  window.switchProfileTab = function(tab) {
    // Update active tab styling
    const tabs = document.querySelectorAll('.selector-tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    const activeTab = document.querySelector(`.selector-tab[data-tab="${tab}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }

    currentTab = tab;
    // Get ID from URL or local storage
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id');
    const userId = profileId || (JSON.parse(localStorage.getItem('user')) || {}).id;
    
    loadTabContent(tab, userId);
  }

async function loadTabContent(tab, userId) {
  // Use passed userId or fall back to current user
  const targetId = userId || (JSON.parse(localStorage.getItem('user')) || {}).id;
  if (!targetId) return;

  const container = document.getElementById('cardsContainer');
  container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 48px;">Loading...</div>';

  try {
    let data;
    
    if (tab === 'published') {
      const response = await fetch(`/api/users/${targetId}/levels`);
      if (response.ok) {
        data = await response.json();
        displayLevels(data.levels || []);
      }
    } else if (tab === 'drafts') {
      const response = await fetch(`/api/users/${targetId}/drafts`);
      if (response.ok) {
        data = await response.json();
        displayDrafts(data.drafts || []);
      }
    } else if (tab === 'liked') {
      // TODO: Implement liked levels
      container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 48px;"><p>Liked levels feature coming soon!</p></div>';
    }
  } catch (err) {
    console.error('Error loading tab content:', err);
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 48px;"><p>Error loading content</p></div>';
  }
}

// Profile level card builder (shared for published and drafts)
function createProfileLevelCard(level, isDraft) {
  const id = level.id;
  const title = escapeHtml(level.title || (isDraft ? 'Untitled Draft' : 'Untitled Level'));
  const description = escapeHtml(level.description || (isDraft ? 'Draft level' : ''));
  const thumbUrl = level.thumbnail_path ? level.thumbnail_path : '';
  const thumbStyle = thumbUrl ? `background-image: url('${thumbUrl}'); background-size: cover; background-position: center;` : '';
  const iconStyle = thumbUrl ? 'display: none;' : 'width: 48px; height: 48px;';

  const badge = isDraft ? '<div class="difficulty-badge" style="background: #9e9e9e;">Draft</div>' : buildDifficultyBadge(level);
  const volatileBadge = level.is_volatile ? '<div class="volatile-badge" title="Volatile / Unpredictable difficulty">⚠️</div>' : '';
  const avatar = buildCreatorAvatar();
  const recordTime = formatRecordTime(level.world_record_time);
  const updatedDate = level.updated_at ? formatDate(level.updated_at) : '';

  const statBlock = isDraft ? `
    <div class="stat-item">
      <svg class="icon"><use href="icons.svg#icon-calendar"/></svg>
      <span>Updated ${updatedDate || '—'}</span>
    </div>
    <div class="stat-item">
      <svg class="icon"><use href="icons.svg#icon-grid-on"/></svg>
      <span>${(level.level_data?.width || 0)}×${(level.level_data?.height || 0)}</span>
    </div>
  ` : `
    <div class="stat-item">
      <svg class="icon"><use href="icons.svg#icon-thumb-up"/></svg>
      <span>${level.total_likes || 0}</span>
    </div>
    <div class="stat-item">
      <svg class="icon"><use href="icons.svg#icon-thumb-down"/></svg>
      <span>${level.total_dislikes || 0}</span>
    </div>
    <div class="stat-item">
      <svg class="icon"><use href="icons.svg#icon-play-arrow"/></svg>
      <span>${level.total_plays || 0}</span>
    </div>
  `;

  const footerLeft = isDraft ? `
    <div class="record-time">
      <svg class="icon"><use href="icons.svg#icon-edit"/></svg>
      <span>Draft ready</span>
    </div>
  ` : `
    <div class="record-time">
      <svg class="icon"><use href="icons.svg#icon-timer"/></svg>
      <span>${recordTime}</span>
    </div>
  `;

  const actions = isDraft ? `
    <div class="level-card-actions">
      <button class="secondary" onclick="editDraft(event, ${id})">Edit</button>
      <button class="primary" onclick="publishDraft(event, ${id})">Publish</button>
      <button class="icon-btn" onclick="deleteLevel(event, ${id})" title="Delete Draft">
        <svg class="icon"><use href="icons.svg#icon-delete"/></svg>
      </button>
    </div>
  ` : `
    <button class="play-btn" data-level-id="${id}" onclick="navigateInternal('/play?id=${id}')">
      <svg class="icon"><use href="icons.svg#icon-play-arrow"/></svg>
      <span>Play</span>
    </button>
  `;

  const cardClick = isDraft ? ' onclick="editDraft(event, ' + id + ')"' : ' onclick="navigateInternal(\'/play?id=' + id + '\')"';

  return `
    <div class="level-card profile-level-card" data-level-id="${id}"${cardClick}>
      <div class="level-card-image" style="${thumbStyle}">
        <svg class="icon" style="${iconStyle}"><use href="icons.svg#icon-videogame"/></svg>
        ${badge || ''}
        ${volatileBadge}
      </div>
      <div class="level-card-content">
        <div class="level-card-header">
          <div class="level-card-title">${title}</div>
          ${avatar}
        </div>
        <p class="level-card-description">${description}</p>
        <div class="level-card-stats">${statBlock}</div>
        <div class="level-card-footer">
          ${footerLeft}
          ${actions}
        </div>
      </div>
    </div>
  `;
}

function buildCreatorAvatar() {
  const displayName = profileUser?.username || 'Player';
  if (profileUser?.avatar_url) {
    return `<div class="avatar-badge"><img src="${profileUser.avatar_url}" alt="${displayName}"></div>`;
  }
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return `<div class="avatar-badge">${initials}</div>`;
}

function buildDifficultyBadge(level) {
  if (!level.difficulty_label) return '';
  const dl = level.difficulty_label;
  const uncertainty = (dl.isUncertain && !dl.isNew) ? `<span class="uncertainty-indicator" title="${dl.uncertaintyBadge}">?</span>` : '';
  return `<div class="difficulty-badge" style="background: ${dl.color};" title="${dl.description}">${dl.label}${uncertainty}</div>`;
}

function formatRecordTime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${minutes}:${String(sec).padStart(2, '0')}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayLevels(levels) {
  const container = document.getElementById('cardsContainer');
  
  container.className = 'cards-grid profile-level-grid';
  
  if (levels.length === 0) {
    container.innerHTML = `
      <div class="profile-empty" style="grid-column: 1 / -1;">
        <svg class="icon" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"><use href="icons.svg#icon-videogame"/></svg>
        <p>No published levels yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = levels.map(level => createProfileLevelCard(level, false)).join('');
}

  // Delete a level (published or draft)
  window.deleteLevel = async function(e, id) {
    e.stopPropagation(); // Prevent card click
    
    const confirmed = await showDeleteConfirm('Are you sure you want to delete this level? This cannot be undone.');
    if (confirmed) {
      try {
        const response = await fetch(`/api/levels/${id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Refresh current tab
          loadTabContent(currentTab);
        } else {
          alert('Failed to delete level');
        }
      } catch (err) {
        console.error('Error deleting level:', err);
        alert('Error deleting level');
      }
    }
  }

function displayDrafts(drafts) {
  const container = document.getElementById('cardsContainer');
  
  // Use legacy horizontal layout for drafts
  container.className = 'drafts-list';
  
  if (drafts.length === 0) {
    container.innerHTML = `
      <div class="profile-empty">
        <svg class="icon" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"><use href="icons.svg#icon-videogame"/></svg>
        <p>No drafts yet. Create one from the editor!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = drafts.map(draft => createDraftCard(draft)).join('');
}

function createDraftCard(draft) {
  const id = draft.id;
  const title = escapeHtml(draft.title || 'Untitled Draft');
  const description = draft.description && draft.description.trim() ? escapeHtml(draft.description) : '';
  const updatedDate = draft.updated_at ? formatDate(draft.updated_at) : '';
  const metaText = updatedDate ? `Updated ${updatedDate}` : 'Recently updated';

  return `
    <div class="draft-card-horizontal" data-level-id="${id}" onclick="editDraft(event, ${id})">
      <button class="icon-btn delete-btn" onclick="deleteLevel(event, ${id})" title="Delete Draft">
        <svg class="icon"><use href="icons.svg#icon-delete"/></svg>
      </button>
      <div class="draft-card-main">
        <div class="draft-card-header">
          <div class="level-card-title">${title}</div>
          <span class="draft-badge">Draft</span>
        </div>
        <p class="draft-card-meta">${metaText}</p>
        ${description ? `<p class="level-card-description">${description}</p>` : ''}
      </div>
      <div class="draft-card-actions">
        <button class="secondary" onclick="editDraft(event, ${id})">Edit</button>
        <button class="primary" onclick="publishDraft(event, ${id})">Publish</button>
      </div>
    </div>
  `;
}

  window.publishDraft = function(e, id) {
    e.stopPropagation();
    // Send user to play mode to verify level before publishing
    navigateInternal(`/play?id=${id}&mode=publish`);
  }

  window.editDraft = function(e, id) {
    e.stopPropagation();
    navigateInternal(`/editor?id=${id}`);
  }

function setupDeleteConfirmModal() {
  const modal = document.getElementById('deleteConfirmModal');
  if (!modal || modal.dataset.bound === 'true') return;
  modal.dataset.bound = 'true';
  if (!modal) return;

  const confirmBtn = document.getElementById('deleteConfirmBtn');
  const cancelBtn = document.getElementById('deleteCancelBtn');
  const closeBtn = document.getElementById('deleteCloseBtn');

  const closeModal = (result) => {
    modal.classList.remove('show');
    if (deleteConfirmResolver) {
      deleteConfirmResolver(result);
      deleteConfirmResolver = null;
    }
  };

  confirmBtn.addEventListener('click', () => closeModal(true));
  cancelBtn.addEventListener('click', () => closeModal(false));
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal(false));
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal(false);
    }
  });
}

function showDeleteConfirm(message) {
  const modal = document.getElementById('deleteConfirmModal');
  const messageEl = document.getElementById('deleteConfirmMessage');
  if (!modal || !messageEl) {
    return Promise.resolve(confirm(message));
  }

  if (deleteConfirmResolver) {
    deleteConfirmResolver(false);
  }

  messageEl.textContent = message;
  modal.classList.add('show');

  return new Promise((resolve) => {
    deleteConfirmResolver = resolve;
  });
}

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
