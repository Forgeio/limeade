// Leaderboards page functionality

let currentTab = 'global-clears';
let currentPage = 1;
const itemsPerPage = 10;

// Mock data for demonstration
const mockPlayers = {
  'global-clears': generateMockPlayers(30, 'clears'),
  'global-records': generateMockPlayers(30, 'records'),
  'friend-clears': generateMockPlayers(15, 'clears'),
  'friend-records': generateMockPlayers(15, 'records')
};

function generateMockPlayers(count, type) {
  const players = [];
  const names = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Quinn', 'Avery', 'Drew'];
  
  for (let i = 0; i < count; i++) {
    const name = `${names[i % names.length]} ${String.fromCharCode(65 + Math.floor(i / names.length))}`;
    players.push({
      id: i + 1,
      rank: i + 1,
      name: name,
      clears: type === 'clears' ? Math.floor(1000 - i * 20 - Math.random() * 20) : Math.floor(500 - i * 10),
      records: type === 'records' ? Math.floor(100 - i * 2 - Math.random() * 2) : Math.floor(50 - i),
      playtime: `${Math.floor(50 + i * 2)}h`
    });
  }
  return players;
}

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
function loadPlayers() {
  const container = document.getElementById('cardsContainer');
  const players = mockPlayers[currentTab];
  
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
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pagePlayers = players.slice(startIndex, endIndex);
  
  container.innerHTML = pagePlayers.map(player => createPlayerCard(player)).join('');
  updatePagination(players.length);
}

// Create player card HTML
function createPlayerCard(player) {
  const rankClass = player.rank === 1 ? 'gold' : player.rank === 2 ? 'silver' : player.rank === 3 ? 'bronze' : '';
  const rankIcon = player.rank <= 3 ? 
    `<span class="material-icons">emoji_events</span>` : 
    player.rank;
  
  const initials = player.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase();
  
  return `
    <div class="player-card" onclick="viewProfile('${player.id}')">
      <div class="player-rank ${rankClass}">
        ${player.rank <= 3 ? rankIcon : player.rank}
      </div>
      <div class="player-avatar-large">
        ${initials}
      </div>
      <div class="player-info">
        <div class="player-name">${player.name}</div>
        <div class="player-stats">
          <div class="player-stat">
            <span class="material-icons">check_circle</span>
            <span>${player.clears} clears</span>
          </div>
          <div class="player-stat">
            <span class="material-icons">emoji_events</span>
            <span>${player.records} records</span>
          </div>
          <div class="player-stat">
            <span class="material-icons">schedule</span>
            <span>${player.playtime}</span>
          </div>
        </div>
      </div>
    </div>
  `;
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
  const players = mockPlayers[currentTab];
  const totalPages = Math.ceil(players.length / itemsPerPage);
  
  if (currentPage < totalPages) {
    currentPage++;
    loadPlayers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// View player profile (placeholder)
function viewProfile(playerId) {
  console.log('Viewing profile:', playerId);
  // TODO: Navigate to player profile when implemented
  alert(`Viewing profile for player ${playerId}\nProfile page coming soon!`);
}
