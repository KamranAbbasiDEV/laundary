(function () {
  const search = document.getElementById('tool-search');
  const mainGrid = document.getElementById('tools-grid');
  const noResults = document.getElementById('no-results');
  const searchMeta = document.getElementById('search-meta');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const allCards = document.querySelectorAll('.tool-card');
  const homepageSections = document.querySelectorAll('.homepage-section');
  let activeFilter = 'all';
  let debounceTimer;

  if (search && allCards.length) {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get('q');
    if (initialQuery) {
      search.value = initialQuery;
      document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    search.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(filterCards, 120);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      search.focus();
      search.select();
    });

    document.querySelectorAll('.section-more[data-jump-filter]').forEach(link => {
      link.addEventListener('click', (e) => {
        const cat = link.dataset.jumpFilter;
        if (!cat) return;
        e.preventDefault();
        filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === cat));
        activeFilter = cat;
        filterCards();
        document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    filterCards();
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      filterCards();
      document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  function filterCards() {
    if (!allCards.length) return;
    const q = (search?.value || '').toLowerCase().trim();
    let visible = 0;
    allCards.forEach(card => {
      const matchFilter = activeFilter === 'all' || card.dataset.category === activeFilter;
      const hay = `${card.dataset.name} ${card.dataset.keywords} ${card.textContent}`.toLowerCase();
      const matchSearch = !q || hay.includes(q);
      const show = matchFilter && matchSearch;
      card.classList.toggle('hidden', !show);
      if (show) visible++;
    });

    if (q) {
      homepageSections.forEach(sec => {
        const any = sec.querySelectorAll('.tool-card:not(.hidden)').length > 0;
        sec.classList.toggle('hidden', !any);
      });
    } else {
      homepageSections.forEach(sec => sec.classList.remove('hidden'));
    }

    if (noResults) noResults.classList.toggle('hidden', visible > 0 || !q);
    if (searchMeta) {
      const total = document.querySelectorAll('#tools-grid .tool-card').length || allCards.length;
      if (q || activeFilter !== 'all') {
        searchMeta.textContent = `${visible} of ${total} tools`;
      } else {
        searchMeta.textContent = `${total} tools available`;
      }
    }
  }

  const root = document.getElementById('tool-root');

  function focusToolInput(container) {
    const el = container.querySelector('textarea, input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), select, button.btn');
    if (el && typeof el.focus === 'function' && el.tagName !== 'BUTTON') el.focus();
  }

  function initTool() {
    if (!root || !root.dataset.tool) return;
    const id = root.dataset.tool;
    if (window.JotTools && typeof window.JotTools[id] === 'function') {
      try {
        window.JotTools[id](root);
        requestAnimationFrame(() => {
          if (window.Jot?.enhanceFileInputs) Jot.enhanceFileInputs(root);
          focusToolInput(root);
        });
      } catch (err) {
        root.innerHTML = `<div class="error" style="padding:1rem">This tool failed to load. Try refreshing the page.</div>`;
        console.error('JotNexus tool error:', id, err);
      }
    } else {
      root.innerHTML = `<div class="error" style="padding:1rem">Tool "${id}" is not available. Rebuild the site.</div>`;
    }
  }

  if (root && root.dataset.tool) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTool);
    else initTool();
  }
})();
