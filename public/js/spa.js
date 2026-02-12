(function () {
  const EXCLUDED_ROUTES = ['/login', '/setup-username'];

  function isExcluded(url) {
    const target = new URL(url, window.location.origin);
    return EXCLUDED_ROUTES.some((route) => target.pathname.startsWith(route));
  }

  function showLoadingIndicator() {
    let indicator = document.getElementById('spa-loading-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'spa-loading-indicator';
      indicator.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">Loading...</div>
      `;
      document.body.appendChild(indicator);
    }
    indicator.classList.add('active');
  }

  function hideLoadingIndicator() {
    const indicator = document.getElementById('spa-loading-indicator');
    if (indicator) {
      indicator.classList.remove('active');
    }
  }

  function updateNavActive(pathname) {
    const navButtons = document.querySelectorAll('.nav-btn[data-nav]');
    navButtons.forEach((btn) => btn.classList.remove('active'));

    if (pathname === '/' || pathname.startsWith('/discover')) {
      document.querySelector('.nav-btn[data-nav="discover"]')?.classList.add('active');
      return;
    }

    if (pathname.startsWith('/leaderboards')) {
      document.querySelector('.nav-btn[data-nav="leaderboards"]')?.classList.add('active');
    }
  }

  function syncInlineStyles(doc) {
    const styles = doc.querySelectorAll('style[data-spa-inline]');
    styles.forEach((style) => {
      const key = style.getAttribute('data-spa-inline') || '';
      if (key && document.head.querySelector(`style[data-spa-inline="${key}"]`)) return;
      const clone = style.cloneNode(true);
      document.head.appendChild(clone);
    });
  }

  async function loadScripts(doc) {
    const scripts = Array.from(doc.querySelectorAll('script'));
    const tasks = [];

    scripts.forEach((script) => {
      const src = script.getAttribute('src');
      if (!src) return;
      if (src.includes('navigation.js') || src.includes('spa.js')) return;
      if (document.querySelector(`script[src="${src}"]`)) return;

      tasks.push(new Promise((resolve) => {
        const tag = document.createElement('script');
        tag.src = src;
        tag.onload = () => resolve();
        tag.onerror = () => resolve();
        document.body.appendChild(tag);
      }));
    });

    await Promise.all(tasks);
  }

  async function spaNavigate(url, options = {}) {
    if (isExcluded(window.location.href) || isExcluded(url)) {
      window.location.href = url;
      return;
    }

    const target = new URL(url, window.location.origin);
    const current = window.location.pathname + window.location.search;
    const next = target.pathname + target.search;

    if (current === next && !options.replace) return;

    // Cleanup before navigating away
    window.dispatchEvent(new CustomEvent('spa:beforenavigate', { detail: { path: target.pathname } }));

    showLoadingIndicator();

    try {
      const response = await fetch(next, {
        headers: { 'X-Requested-With': 'spa' }
      });

      if (!response.ok) {
        hideLoadingIndicator();
        window.location.href = url;
        return;
      }

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newContent = doc.querySelector('#spa-content');

      if (!newContent) {
        hideLoadingIndicator();
        window.location.href = url;
        return;
      }

      const currentContent = document.querySelector('#spa-content');
      if (!currentContent) {
        hideLoadingIndicator();
        window.location.href = url;
        return;
      }

      document.title = doc.title || document.title;
      document.body.className = doc.body.className;
      syncInlineStyles(doc);
      currentContent.replaceWith(newContent);

      updateNavActive(target.pathname);
      await loadScripts(doc);

      if (options.replace) {
        window.history.replaceState({}, '', next);
      } else {
        window.history.pushState({}, '', next);
      }

      window.scrollTo({ top: 0, behavior: 'auto' });
      
      hideLoadingIndicator();
      window.dispatchEvent(new CustomEvent('spa:navigate', { detail: { path: target.pathname, search: target.search } }));
    } catch (err) {
      console.error('[SPA] Navigation failed', err);
      hideLoadingIndicator();
      window.location.href = url;
    }
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (link.hasAttribute('download')) return;
    if (link.target && link.target !== '_self') return;
    if (link.dataset.spa === 'false') return;

    const target = new URL(href, window.location.origin);
    if (target.origin !== window.location.origin) return;

    event.preventDefault();
    spaNavigate(target.href);
  });

  window.addEventListener('popstate', () => {
    spaNavigate(window.location.href, { replace: true });
  });

  window.spaNavigate = spaNavigate;
  updateNavActive(window.location.pathname);
})();
