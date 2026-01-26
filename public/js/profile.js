// Profile Page Logic

let currentTab = 'published';

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in (handled by navigation.js mostly, but good to ensure)
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        updateProfileDisplay(user);
        loadTabContent('published');
    }
});

function updateProfileDisplay(user) {
    const profileName = document.getElementById('profileName');
    const profileAvatar = document.getElementById('profileAvatar');

    if (profileName) {
        profileName.textContent = user.name;
    }

    if (profileAvatar) {
        // Get initials from name
        const initials = user.name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        profileAvatar.textContent = initials;
    }
}

function switchProfileTab(tab) {
  // Update active tab styling
  const tabs = document.querySelectorAll('.selector-tab');
  tabs.forEach(t => t.classList.remove('active'));
  
  const activeTab = document.querySelector(`.selector-tab[data-tab="${tab}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  currentTab = tab;
  loadTabContent(tab);
}

async function loadTabContent(tab) {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return;

  const container = document.getElementById('cardsContainer');
  container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 48px;">Loading...</div>';

  try {
    let data;
    
    if (tab === 'published') {
      const response = await fetch(`/api/users/${user.id}/levels`);
      if (response.ok) {
        data = await response.json();
        displayLevels(data.levels || []);
      }
    } else if (tab === 'drafts') {
      const response = await fetch(`/api/users/${user.id}/drafts`);
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

function displayLevels(levels) {
  const container = document.getElementById('cardsContainer');
  
  if (levels.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 48px;">
        <svg class="icon" style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;"><use href="icons.svg#icon-videogame"/></svg>
        <p>No published levels yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = levels.map(level => `
    <div class="card" onclick="window.location.href='play.html?id=${level.id}'">
      <div class="card-image">
        <div class="placeholder-image">
          <svg class="icon" style="width: 48px; height: 48px; opacity: 0.3;"><use href="icons.svg#icon-videogame"/></svg>
        </div>
      </div>
      <div class="card-content">
        <h3 class="card-title">${escapeHtml(level.title)}</h3>
        <p class="card-description">${escapeHtml(level.description || 'No description')}</p>
        <div class="card-stats">
          <span><svg class="icon"><use href="icons.svg#icon-play-arrow"/></svg> ${level.total_plays || 0}</span>
          <span><svg class="icon"><use href="icons.svg#icon-check-circle"/></svg> ${level.total_clears || 0}</span>
          <span><svg class="icon"><use href="icons.svg#icon-favorite"/></svg> ${level.total_likes || 0}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function displayDrafts(drafts) {
  const container = document.getElementById('cardsContainer');
  
  if (drafts.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 48px;">
        <svg class="icon" style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;"><use href="icons.svg#icon-videogame"/></svg>
        <p>No drafts yet. Create one from the editor!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = drafts.map(draft => {
    const updatedDate = new Date(draft.updated_at);
    const formattedDate = updatedDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return `
      <div class="card" onclick="window.location.href='editor.html?id=${draft.id}'">
        <div class="card-image">
          <div class="placeholder-image draft-placeholder">
            <svg class="icon" style="width: 48px; height: 48px; opacity: 0.3;"><use href="icons.svg#icon-edit"/></svg>
          </div>
        </div>
        <div class="card-content">
          <h3 class="card-title">${escapeHtml(draft.title || 'Untitled Draft')}</h3>
          <p class="card-description">Last edited: ${formattedDate}</p>
          <div class="card-stats">
            <span class="draft-badge">Draft</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
