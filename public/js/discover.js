// Discover page functionality

let currentTab = 'hot';
let currentPage = 1;
let searchQuery = '';
const itemsPerPage = 12;

// Initialize page
window.addEventListener('DOMContentLoaded', () => {
  loadLevels();
  
  // Set the correct radio button based on currentTab
  const sortRadios = document.querySelectorAll('input[name="sort"]');
  sortRadios.forEach(radio => {
    radio.checked = radio.value === currentTab;
  });
  
  // Add search input listener
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });
  }
  
  // Close filter menu when clicking outside
  document.addEventListener('click', (e) => {
    const filterMenu = document.getElementById('filterMenu');
    const filterBtn = document.getElementById('filterBtn');
    if (filterMenu && filterBtn && !filterMenu.contains(e.target) && !filterBtn.contains(e.target)) {
      filterMenu.classList.remove('show');
      filterBtn.classList.remove('active');
    }
  });
});

// Perform search
function performSearch() {
  const searchInput = document.getElementById('searchInput');
  searchQuery = searchInput ? searchInput.value.trim() : '';
  currentPage = 1;
  loadLevels();
}

// Toggle filter menu
function toggleFilterMenu() {
  const filterMenu = document.getElementById('filterMenu');
  const filterBtn = document.getElementById('filterBtn');
  if (filterMenu && filterBtn) {
    filterMenu.classList.toggle('show');
    filterBtn.classList.toggle('active');
  }
}

// Apply filters
function applyFilters() {
  const sortRadios = document.querySelectorAll('input[name="sort"]');
  sortRadios.forEach(radio => {
    if (radio.checked) {
      currentTab = radio.value;
    }
  });
  currentPage = 1;
  loadLevels();
  
  // Close filter menu
  const filterMenu = document.getElementById('filterMenu');
  const filterBtn = document.getElementById('filterBtn');
  if (filterMenu && filterBtn) {
    filterMenu.classList.remove('show');
    filterBtn.classList.remove('active');
  }
}

// Switch between tabs (legacy support)
function switchTab(tab) {
  currentTab = tab;
  currentPage = 1;
  loadLevels();
}

// Load levels for current tab and page
async function loadLevels() {
  const container = document.getElementById('cardsContainer');
  
  try {
    // Build query parameters
    let url = `/api/levels?filter=${currentTab}&page=${currentPage}&limit=${itemsPerPage}`;
    if (searchQuery) {
      url += `&search=${encodeURIComponent(searchQuery)}`;
    }
    
    // Fetch levels from API
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch levels');
    }
    
    const data = await response.json();
    const levels = data.levels;
    
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
    
    container.innerHTML = levels.map(level => createLevelCard(level)).join('');
    
    // Add event listeners for level cards and play buttons
    container.querySelectorAll('.level-card').forEach(card => {
      const levelId = card.dataset.levelId;
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.play-btn')) {
          // Navigate to level detail page
          window.location.href = `/level?id=${levelId}`;
        }
      });
    });
    
    container.querySelectorAll('.play-btn').forEach(btn => {
      const levelId = btn.dataset.levelId;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playLevel(levelId);
      });
    });
    
    updatePagination(data.pagination.totalCount);
  } catch (err) {
    console.error('Error loading levels:', err);
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <span class="material-icons">error</span>
        <h3>Error loading levels</h3>
        <p>Please try again later.</p>
      </div>
    `;
  }
}

// Create level card HTML
function createLevelCard(level) {
  const escapedId = level.id;
  const escapedTitle = escapeHtml(level.title);
  const escapedDescription = escapeHtml(level.description || '');
  
  // Format record time (convert decimal seconds to M:SS.mmm)
  let recordTime = '--:--';
  if (level.world_record_time) {
    const totalSeconds = parseFloat(level.world_record_time);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    recordTime = `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
  }
  
  const thumbUrl = level.thumbnail_path ? level.thumbnail_path : '';
  const thumbStyle = thumbUrl ? `background-image: url('${thumbUrl}'); background-size: cover; background-position: center;` : '';
  const iconStyle = thumbUrl ? 'display: none;' : 'width: 48px; height: 48px;';

  // Difficulty badge
  let difficultyBadge = '';
  if (level.difficulty_label) {
    const dl = level.difficulty_label;
    
    // For "New" levels, don't show uncertainty indicator since the whole badge is "New"
    const uncertaintyIndicator = (dl.isUncertain && !dl.isNew) ? 
      `<span class="uncertainty-indicator" title="${dl.uncertaintyBadge}">?</span>` : '';
    
    difficultyBadge = `
      <div class="difficulty-badge" style="background: ${dl.color};" title="${dl.description}">
        ${dl.label}
        ${uncertaintyIndicator}
      </div>
    `;
  }

  // Volatility indicator
  const volatileBadge = level.is_volatile ? 
    '<div class="volatile-badge" title="Volatile / Unpredictable difficulty">⚠️</div>' : '';

  return `
    <div class="level-card" data-level-id="${escapedId}">
      <div class="level-card-image" style="${thumbStyle}">
        <svg class="icon" style="${iconStyle}"><use href="icons.svg#icon-videogame"/></svg>
        ${difficultyBadge}
        ${volatileBadge}
      </div>
      <div class="level-card-content">
        <h3 class="level-card-title">${escapedTitle}</h3>
        <p class="level-card-description">${escapedDescription}</p>
        <div class="level-card-stats">
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
        </div>
        <div class="level-card-footer">
          <div class="record-time">
            <svg class="icon"><use href="icons.svg#icon-timer"/></svg>
            <span>${recordTime}</span>
          </div>
          <button class="play-btn" data-level-id="${escapedId}">
            <svg class="icon"><use href="icons.svg#icon-play-arrow"/></svg>
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
  currentPage++;
  loadLevels();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Play level function
function playLevel(levelId) {
  window.location.href = `/play?id=${levelId}`;
}
