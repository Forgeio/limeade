// Discover page functionality
(function() {
  let currentSort = 'likes';
  let searchQuery = '';
  let searchDebounceId = null;
  let currentPage = 1;
  const itemsPerPage = 12;

  // Initialize page
  function initDiscoverPage() {
    const pageRoot = document.querySelector('#spa-content[data-page="discover"]');
    if (!pageRoot) return;

    const container = document.getElementById('cardsContainer');
    if (!container) return;

    currentSort = 'likes';
    searchQuery = '';
    currentPage = 1;

    // Rebind page-level handlers for inline HTML onclicks
    window.prevPage = prevPage;
    window.nextPage = nextPage;

    bindDiscoverSearch();
    updateFilterUI();

    loadLevels();
  }

  window.addEventListener('DOMContentLoaded', initDiscoverPage);
  window.addEventListener('spa:navigate', initDiscoverPage);

  function bindDiscoverSearch() {
    const input = document.getElementById('discoverSearchInput');
    const filterBtn = document.getElementById('discoverFilterBtn');
    const filterMenu = document.getElementById('discoverFilterMenu');
    const searchBtn = document.getElementById('discoverSearchBtn');

    if (input && input.dataset.bound !== 'true') {
      input.dataset.bound = 'true';
      input.value = searchQuery;
      input.addEventListener('input', () => {
        const nextValue = input.value.trim();
        if (searchDebounceId) {
          window.clearTimeout(searchDebounceId);
        }
        searchDebounceId = window.setTimeout(() => {
          searchQuery = nextValue;
          currentPage = 1;
          loadLevels();
        }, 300);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runSearch();
        }
      });
    }

    if (searchBtn && searchBtn.dataset.bound !== 'true') {
      searchBtn.dataset.bound = 'true';
      searchBtn.addEventListener('click', (event) => {
        event.preventDefault();
        runSearch();
      });
    }

    if (filterBtn && filterMenu && filterBtn.dataset.bound !== 'true') {
      filterBtn.dataset.bound = 'true';
      filterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = filterMenu.classList.toggle('open');
        filterBtn.classList.toggle('active', isOpen);
        filterBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }

    if (filterMenu && filterMenu.dataset.bound !== 'true') {
      filterMenu.dataset.bound = 'true';
      filterMenu.querySelectorAll('.filter-option').forEach(option => {
        option.addEventListener('click', () => {
          const nextSort = option.dataset.sort;
          if (!nextSort || nextSort === currentSort) return;
          currentSort = nextSort;
          currentPage = 1;
          updateFilterUI();
          filterMenu.classList.remove('open');
          filterBtn?.classList.remove('active');
          filterBtn?.setAttribute('aria-expanded', 'false');
          runSearch();
        });
      });
    }

    if (!window.__discoverFilterOutsideHandler) {
      window.__discoverFilterOutsideHandler = true;
      document.addEventListener('click', () => {
        const menu = document.getElementById('discoverFilterMenu');
        const btn = document.getElementById('discoverFilterBtn');
        if (!menu || !btn) return;
        menu.classList.remove('open');
        btn.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
      });
    }
  }

  function runSearch() {
    const input = document.getElementById('discoverSearchInput');
    searchQuery = input ? input.value.trim() : '';
    currentPage = 1;
    loadLevels();
  }

  function updateFilterUI() {
    const filterMenu = document.getElementById('discoverFilterMenu');
    if (!filterMenu) return;
    filterMenu.querySelectorAll('.filter-option').forEach(option => {
      option.classList.toggle('active', option.dataset.sort === currentSort);
    });
  }

  // Load levels for current tab and page
  async function loadLevels() {
  const container = document.getElementById('cardsContainer');
  
  try {
    // Fetch levels from API
    const params = new URLSearchParams({
      sort: currentSort,
      page: String(currentPage),
      limit: String(itemsPerPage)
    });
    if (searchQuery) {
      params.set('q', searchQuery);
    }

    const response = await fetch(`/api/levels?${params.toString()}`);
    
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
          <p>Try adjusting your search or sort options.</p>
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
          if (typeof window.spaNavigate === 'function') {
            window.spaNavigate(`/level?id=${levelId}`);
          } else {
            window.location.href = `/level?id=${levelId}`;
          }
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
  
  // Format record time (convert seconds to MM:SS)
  let recordTime = '0:00';
  if (level.world_record_time) {
    const minutes = Math.floor(level.world_record_time / 60);
    const seconds = level.world_record_time % 60;
    recordTime = `${minutes}:${String(seconds).padStart(2, '0')}`;
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

  if (!pageInfo || !prevBtn || !nextBtn) return;
  
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
    if (typeof window.spaNavigate === 'function') {
      window.spaNavigate(`/play?id=${levelId}`);
    } else {
      window.location.href = `/play?id=${levelId}`;
    }
  }
})();
