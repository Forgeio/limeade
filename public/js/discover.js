// Discover page functionality

let currentTab = 'hot';
let currentPage = 1;
const itemsPerPage = 12;

// Mock data for demonstration
const mockLevels = {
  hot: generateMockLevels(36, 'hot'),
  top: generateMockLevels(36, 'top'),
  new: generateMockLevels(36, 'new')
};

function generateMockLevels(count, type) {
  const levels = [];
  for (let i = 0; i < count; i++) {
    levels.push({
      id: `${type}-${i}`,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Level ${i + 1}`,
      description: 'An exciting platformer level with challenging obstacles and hidden secrets. Can you complete it?',
      likes: Math.floor(Math.random() * 500),
      dislikes: Math.floor(Math.random() * 50),
      plays: Math.floor(Math.random() * 1000),
      recordTime: `${Math.floor(Math.random() * 5)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
    });
  }
  return levels;
}

// Initialize page
window.addEventListener('DOMContentLoaded', () => {
  loadLevels();
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
  
  loadLevels();
}

// Load levels for current tab and page
function loadLevels() {
  const container = document.getElementById('cardsContainer');
  const levels = mockLevels[currentTab];
  
  if (!levels || levels.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <span class="material-icons">inbox</span>
        <h3>No levels found</h3>
        <p>Check back later for new levels!</p>
      </div>
    `;
    updatePagination(0);
    return;
  }
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageLevels = levels.slice(startIndex, endIndex);
  
  container.innerHTML = pageLevels.map(level => createLevelCard(level)).join('');
  
  // Add event listeners for level cards and play buttons
  container.querySelectorAll('.level-card').forEach(card => {
    const levelId = decodeURIComponent(card.dataset.levelId);
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.play-btn')) {
        playLevel(levelId);
      }
    });
  });
  
  container.querySelectorAll('.play-btn').forEach(btn => {
    const levelId = decodeURIComponent(btn.dataset.levelId);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playLevel(levelId);
    });
  });
  
  updatePagination(levels.length);
}

// Create level card HTML
function createLevelCard(level) {
  const escapedId = encodeURIComponent(level.id);
  const escapedTitle = escapeHtml(level.title);
  const escapedDescription = escapeHtml(level.description);
  
  return `
    <div class="level-card" data-level-id="${escapedId}">
      <div class="level-card-image">
        <span class="material-icons">videogame_asset</span>
      </div>
      <div class="level-card-content">
        <h3 class="level-card-title">${escapedTitle}</h3>
        <p class="level-card-description">${escapedDescription}</p>
        <div class="level-card-stats">
          <div class="stat-item">
            <span class="material-icons">thumb_up</span>
            <span>${level.likes}</span>
          </div>
          <div class="stat-item">
            <span class="material-icons">thumb_down</span>
            <span>${level.dislikes}</span>
          </div>
          <div class="stat-item">
            <span class="material-icons">play_arrow</span>
            <span>${level.plays}</span>
          </div>
        </div>
        <div class="level-card-footer">
          <div class="record-time">
            <span class="material-icons">timer</span>
            <span>${escapeHtml(level.recordTime)}</span>
          </div>
          <button class="play-btn" data-level-id="${escapedId}">
            <span class="material-icons">play_arrow</span>
            <span>Play</span>
          </button>
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
    loadLevels();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function nextPage() {
  const levels = mockLevels[currentTab];
  const totalPages = Math.ceil(levels.length / itemsPerPage);
  
  if (currentPage < totalPages) {
    currentPage++;
    loadLevels();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Play level function (placeholder)
function playLevel(levelId) {
  console.log('Playing level:', levelId);
  // TODO: Navigate to game player when implemented
  alert(`Playing level: ${levelId}\nGame player coming soon!`);
}
