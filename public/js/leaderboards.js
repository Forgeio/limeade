// Leaderboards page functionality

let currentTab = 'skill-rating';
let currentPage = 1;
const itemsPerPage = 15;

// Initialize page
window.addEventListener('DOMContentLoaded', () => {
  loadPlayers();
});

// Switch between tabs
function switchTab(tab) {
  currentTab = tab;
  currentPage = 1;
  
  // Update active tab styling
  document.querySelectorAll('.selector-tab').forEach(tabBtn => {
    tabBtn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  
  loadPlayers();
}

// Load players for current tab and page
async function loadPlayers() {
  const container = document.getElementById('cardsContainer');
  
  try {
    // Determine leaderboard type
    let leaderboardType = 'skill_rating';
    if (currentTab === 'global-clears') {
      leaderboardType = 'clears';
    } else if (currentTab === 'global-records') {
      leaderboardType = 'records';
    } else if (currentTab === 'seasonal-rating') {
      leaderboardType = 'seasonal_rating';
    } else if (currentTab === 'blind-mode') {
      leaderboardType = 'blind_mode_rating';
    }
    
    // Fetch players from API
    const response = await fetch(`/api/users/leaderboard/${leaderboardType}?page=${currentPage}&limit=${itemsPerPage}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard');
    }
    
    const data = await response.json();
    const players = data.players;
    
    if (!players || players.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="material-icons">group</span>
          <h3>No players found</h3>
          <p>Check back later for leaderboard data!</p>
        </div>
      `;
      updatePagination(0);
      return;
    }
    
    // Add rank based on page and index
    const rankedPlayers = players.map((player, index) => ({
      ...player,
      rank: (currentPage - 1) * itemsPerPage + index + 1
    }));
    
    container.innerHTML = rankedPlayers.map(player => createPlayerCard(player, leaderboardType)).join('');
    
    updatePagination(data.pagination.totalCount);
  } catch (err) {
    console.error('Error loading leaderboard:', err);
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <span class="material-icons">error</span>
        <h3>Error loading leaderboard</h3>
        <p>Please try again later.</p>
      </div>
    `;
  }
}

// Create player card HTML
function createPlayerCard(player, leaderboardType) {
  const rankClass = player.rank === 1 ? 'gold' : player.rank === 2 ? 'silver' : player.rank === 3 ? 'bronze' : '';
  const rankIcon = player.rank <= 3 ? 
    `<svg class="icon" style="width: 24px; height: 24px;"><use href="icons.svg#icon-trophy"/></svg>` : 
    player.rank;
  
  const initials = player.username
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
  
  const escapedName = escapeHtml(player.username);
  
  // Determine main stat based on leaderboard type
  let mainStat = '';
  let mainStatLabel = '';
  
  if (leaderboardType === 'skill_rating' || leaderboardType === 'seasonal_rating' || leaderboardType === 'blind_mode_rating') {
    const rating = player.rating || player.skill_rating || 1500;
    const rd = player.rating_deviation || 350;
    mainStat = `${rating} <span style="font-size: 14px; color: var(--text-secondary);">±${rd}</span>`;
    mainStatLabel = leaderboardType === 'seasonal_rating' ? 'Seasonal SR' : 
                    leaderboardType === 'blind_mode_rating' ? 'Blind SR' : 'Skill Rating';
  } else if (leaderboardType === 'clears') {
    mainStat = player.total_clears || 0;
    mainStatLabel = 'Total Clears';
  } else if (leaderboardType === 'records') {
    mainStat = player.total_records || 0;
    mainStatLabel = 'World Records';
  }
  
  // Format playtime (convert seconds to hours)
  const playtimeHours = Math.floor((player.total_playtime || 0) / 3600);
  const escapedPlaytime = `${playtimeHours}h`;
  
  return `
    <div class="player-card" onclick="viewProfile(${player.id})" style="cursor: pointer;">
      <div class="player-rank ${rankClass}">
        ${player.rank <= 3 ? rankIcon : player.rank}
      </div>
      <div class="player-avatar-large">
        ${initials}
      </div>
      <div class="player-info">
        <div class="player-name">${escapedName}</div>
        <div class="player-main-stat">
          <span style="font-size: 24px; font-weight: 700; color: var(--primary-color);">${mainStat}</span>
          <span style="font-size: 12px; color: var(--text-secondary);">${mainStatLabel}</span>
        </div>
        <div class="player-stats">
          <div class="player-stat">
            <svg class="icon"><use href="icons.svg#icon-check-circle"/></svg>
            <span>${player.total_clears || 0} clears</span>
          </div>
          <div class="player-stat">
            <svg class="icon"><use href="icons.svg#icon-trophy"/></svg>
            <span>${player.total_records || 0} records</span>
          </div>
          <div class="player-stat">
            <svg class="icon"><use href="icons.svg#icon-schedule"/></svg>
            <span>${escapedPlaytime}</span>
          </div>
        </div>
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

// Update pagination controls
function updatePagination(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}

// Pagination functions
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    loadPlayers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function nextPage() {
  currentPage++;
  loadPlayers();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// View player profile
function viewProfile(playerId) {
  window.location.href = `/profile?id=${playerId}`;
}
