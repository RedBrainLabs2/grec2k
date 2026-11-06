/**
 * grec2k — Alo Yoga Inspired Luxury E-Commerce Web App
 * Clean, Bright White Layout with Petrol Highlights & Direct Weblink Integration
 */

(function () {
  'use strict';

  // --- App State ---
  const state = {
    allProducts: [],
    filteredProducts: [],
    department: 'all',          // 'all', 'men', 'women', 'curated'
    category: 'all',
    brand: 'all',
    pricePreset: 'all',         // 'all', 'under25', '25-50', '50-100', '100plus'
    searchQuery: '',
    sortBy: 'featured',         // 'featured', 'price-asc', 'price-desc', 'brand-asc', 'name-asc'
    viewMode: 'standard',       // 'standard', 'compact', 'list'
    linkPreference: 'direct',   // 'direct' (Original Weidian/Taobao) or 'agent' (Litbuy)
    currency: 'EUR',
    currentPage: 1,
    pageSize: 48,
    wishlist: new Set(),
    quickViewProduct: null,
    categoriesWithCounts: {},
    topBrands: []
  };

  const CURRENCY_RATES = {
    EUR: 0.92,
    USD: 1.0,
    GBP: 0.79,
    JPY: 154.5
  };

  const CURRENCY_SYMBOLS = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    JPY: '¥'
  };

  // --- DOM Elements ---
  const elements = {
    collectionTitle: document.getElementById('collection-main-title'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    deptLinks: document.querySelectorAll('.dept-link'),
    categoriesScroll: document.getElementById('categories-scroll'),
    brandSelect: document.getElementById('brand-select'),
    sortSelect: document.getElementById('sort-select'),
    currencySelect: document.getElementById('currency-select'),
    pageSizeSelect: document.getElementById('pagesize-select'),
    pricePills: document.querySelectorAll('.price-pill'),
    viewBtns: document.querySelectorAll('.view-btn'),
    linkPrefBtns: document.querySelectorAll('.link-pref-btn'),
    productsGrid: document.getElementById('products-grid'),
    resultsCount: document.getElementById('results-count'),
    activeFiltersRow: document.getElementById('active-filters-row'),
    paginationSection: document.getElementById('pagination-section'),
    pageNumbers: document.getElementById('page-numbers'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    pageInfo: document.getElementById('page-info'),
    wishlistToggleBtn: document.getElementById('wishlist-toggle-btn'),
    wishlistCountBadge: document.getElementById('wishlist-count-badge'),
    drawerCount: document.getElementById('drawer-count'),
    wishlistBackdrop: document.getElementById('wishlist-backdrop'),
    wishlistCloseBtn: document.getElementById('wishlist-close-btn'),
    wishlistItemsContainer: document.getElementById('wishlist-items-container'),
    wishlistTotalVal: document.getElementById('wishlist-total-val'),
    wishlistExportBtn: document.getElementById('wishlist-export-btn'),
    wishlistClearBtn: document.getElementById('wishlist-clear-btn'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalContainer: document.getElementById('modal-container'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    toastContainer: document.getElementById('toast-container')
  };

  // --- Initializer ---
  function init() {
    loadWishlist();
    loadLinkPreference();
    setupEventListeners();

    if (window.EXCLUSIVE_PRODUCTS && window.EXCLUSIVE_PRODUCTS.length > 0) {
      handleProductsLoaded(window.EXCLUSIVE_PRODUCTS);
    } else {
      fetch('./data/products.json')
        .then(res => res.json())
        .then(data => handleProductsLoaded(data))
        .catch(err => {
          console.error("Failed to load products:", err);
          showToast("Katalog wird geladen...");
        });
    }
  }

  function handleProductsLoaded(data) {
    state.allProducts = data;
    computeMetadata();
    renderCategoryPills();
    populateBrandSelect();
    applyFilters();
  }

  // --- Metadata Calculation ---
  function computeMetadata() {
    const cats = {};
    const brands = {};

    state.allProducts.forEach(p => {
      cats[p.category] = (cats[p.category] || 0) + 1;
      if (p.brand && p.brand !== 'Exclusive') {
        brands[p.brand] = (brands[p.brand] || 0) + 1;
      }
    });

    state.categoriesWithCounts = cats;
    state.topBrands = Object.entries(brands)
      .sort((a, b) => b[1] - a[1])
      .map(entry => ({ name: entry[0], count: entry[1] }));
  }

  // --- Alo Yoga Category Pills ---
  function renderCategoryPills() {
    if (!elements.categoriesScroll) return;

    const sortedCats = Object.entries(state.categoriesWithCounts)
      .sort((a, b) => b[1] - a[1]);

    let html = `
      <button class="alo-cat-pill ${state.category === 'all' ? 'active' : ''}" data-category="all">
        <span>Alle Styles</span>
        <span class="alo-cat-count">(${state.allProducts.length})</span>
      </button>
    `;

    sortedCats.forEach(([cat, count]) => {
      const isActive = state.category === cat;
      html += `
        <button class="alo-cat-pill ${isActive ? 'active' : ''}" data-category="${escapeHtml(cat)}">
          <span>${escapeHtml(cat)}</span>
          <span class="alo-cat-count">(${count})</span>
        </button>
      `;
    });

    elements.categoriesScroll.innerHTML = html;

    elements.categoriesScroll.querySelectorAll('.alo-cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        state.category = btn.getAttribute('data-category');
        state.currentPage = 1;
        updateCategoryPillsActiveState();
        applyFilters();
      });
    });
  }

  function updateCategoryPillsActiveState() {
    if (!elements.categoriesScroll) return;
    elements.categoriesScroll.querySelectorAll('.alo-cat-pill').forEach(btn => {
      const cat = btn.getAttribute('data-category');
      btn.classList.toggle('active', state.category === cat);
    });
  }

  function populateBrandSelect() {
    if (!elements.brandSelect) return;
    let html = `<option value="all">Marke: Alle (${state.topBrands.length})</option>`;
    state.topBrands.forEach(b => {
      html += `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)} (${b.count})</option>`;
    });
    elements.brandSelect.innerHTML = html;
  }

  // --- Filter and Sort Core ---
  function applyFilters() {
    let result = state.allProducts;

    // 1. Department
    if (state.department !== 'all') {
      if (state.department === 'men') {
        result = result.filter(p => p.department === 'Men / Unisex');
      } else if (state.department === 'women') {
        result = result.filter(p => p.department === 'Women');
      } else if (state.department === 'curated') {
        result = result.filter(p => p.sheet === 'Curated' || p.category === 'Curated Selection');
      }
    }

    // 2. Category
    if (state.category !== 'all') {
      result = result.filter(p => p.category === state.category);
    }

    // 3. Brand
    if (state.brand !== 'all') {
      result = result.filter(p => p.brand.toLowerCase() === state.brand.toLowerCase());
    }

    // 4. Price Presets
    if (state.pricePreset !== 'all') {
      const rate = CURRENCY_RATES[state.currency] || 0.92;
      if (state.pricePreset === 'under25') {
        result = result.filter(p => (p.price * rate) > 0 && (p.price * rate) < 25);
      } else if (state.pricePreset === '25-50') {
        result = result.filter(p => (p.price * rate) >= 25 && (p.price * rate) <= 50);
      } else if (state.pricePreset === '50-100') {
        result = result.filter(p => (p.price * rate) > 50 && (p.price * rate) <= 100);
      } else if (state.pricePreset === '100plus') {
        result = result.filter(p => (p.price * rate) > 100);
      }
    }

    // 5. Search Query
    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase().trim();
      const terms = q.split(/\s+/);
      result = result.filter(p => {
        const fullText = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
        return terms.every(term => fullText.includes(term));
      });
    }

    // 6. Sort
    result = sortProducts(result, state.sortBy);

    state.filteredProducts = result;
    renderActiveFilterBadges();
    renderProducts();
    renderPagination();
  }

  function sortProducts(items, sortBy) {
    const list = [...items];
    switch (sortBy) {
      case 'price-asc':
        return list.sort((a, b) => (a.price || 0) - (b.price || 0));
      case 'price-desc':
        return list.sort((a, b) => (b.price || 0) - (a.price || 0));
      case 'brand-asc':
        return list.sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));
      case 'name-asc':
        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'featured':
      default:
        return list;
    }
  }

  // --- Currency Formatting ---
  function formatPrice(amountInUSD) {
    if (!amountInUSD || isNaN(amountInUSD) || amountInUSD <= 0) {
      return 'Auf Anfrage';
    }
    const rate = CURRENCY_RATES[state.currency] || 0.92;
    const symbol = CURRENCY_SYMBOLS[state.currency] || '€';
    const converted = amountInUSD * rate;

    if (state.currency === 'JPY') {
      return `${Math.round(converted).toLocaleString()} ${symbol}`;
    }
    return `${converted.toFixed(2).replace('.', ',')} ${symbol}`;
  }

  // --- Render Alo Yoga Product Cards ---
  function renderProducts() {
    if (!elements.productsGrid) return;

    const total = state.filteredProducts.length;
    elements.resultsCount.textContent = total.toLocaleString();

    if (total === 0) {
      elements.productsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 80px 20px;">
          <h3 style="font-size: 1.2rem; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Keine Styles gefunden</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">Passe die Filter an oder leere die Suche.</p>
          <button id="reset-filters-btn" class="alo-btn-primary" style="max-width: 200px; margin: 0 auto;">Filter zurücksetzen</button>
        </div>
      `;
      const resetBtn = document.getElementById('reset-filters-btn');
      if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
      return;
    }

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, total);
    const pageItems = state.filteredProducts.slice(startIdx, endIdx);

    elements.productsGrid.innerHTML = pageItems.map(p => createAloProductCardHtml(p)).join('');
    attachCardListeners();
  }

  function getActiveTargetUrl(product) {
    if (state.linkPreference === 'agent') {
      return product.agentLink || product.weblink || product.origLink || '#';
    }
    return product.origLink || product.weblink || product.agentLink || '#';
  }

  function createAloProductCardHtml(p) {
    const isWishlisted = state.wishlist.has(p.id);
    const targetUrl = getActiveTargetUrl(p);
    const directStoreUrl = p.origLink || p.weblink || '#';
    const agentUrl = p.agentLink || '#';
    const priceFormatted = formatPrice(p.price);

    const isWomen = p.department === 'Women';
    const deptTag = isWomen ? 'Damen' : (p.sheet === 'Curated' ? 'Curated' : 'Herren');

    return `
      <article class="alo-card" data-id="${p.id}">
        <div class="alo-card-image-box">
          <span class="alo-card-badge">${deptTag}</span>
          
          <button class="alo-card-save-btn ${isWishlisted ? 'active' : ''}" data-id="${p.id}" title="${isWishlisted ? 'Von Merkliste entfernen' : 'Merken'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${isWishlisted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>

          <!-- Product Image links directly to weblink -->
          <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer" class="alo-card-image-link" title="Weblink öffnen: ${escapeHtml(p.name)}">
            <img 
              src="${escapeHtml(p.image)}" 
              alt="${escapeHtml(p.name)}" 
              class="alo-card-img" 
              loading="lazy" 
              onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'380\\' viewBox=\\'0 0 300 380\\'><rect width=\\'300\\' height=\\'380\\' fill=\\'%23f4f4f4\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%230e7490\\' font-family=\\'sans-serif\\' font-size=\\'14\\' font-weight=\\'bold\\' text-anchor=\\'middle\\'>GREC2K</text></svg>';"
            />
          </a>

          <div class="alo-card-hover-bar">
            <a href="${escapeHtml(directStoreUrl)}" target="_blank" rel="noopener noreferrer" class="alo-hover-btn petrol">
              Store ↗
            </a>
            <a href="${escapeHtml(agentUrl)}" target="_blank" rel="noopener noreferrer" class="alo-hover-btn">
              Agent
            </a>
          </div>
        </div>

        <div class="alo-card-info">
          <div class="alo-card-brand">${escapeHtml(p.brand)}</div>
          <h3 class="alo-card-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>

          <div class="alo-card-meta">
            <span class="alo-card-price">${priceFormatted}</span>
            <span class="alo-card-category">${escapeHtml(p.category)}</span>
          </div>

          <div class="alo-card-actions">
            <a href="${escapeHtml(directStoreUrl)}" target="_blank" rel="noopener noreferrer" class="alo-action-btn petrol">
              Store ↗
            </a>
            <a href="${escapeHtml(agentUrl)}" target="_blank" rel="noopener noreferrer" class="alo-action-btn">
              Agent
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function attachCardListeners() {
    elements.productsGrid.querySelectorAll('.alo-card-save-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        toggleWishlist(id);
      });
    });

    elements.productsGrid.querySelectorAll('.alo-card-title').forEach(titleEl => {
      titleEl.addEventListener('click', () => {
        const card = titleEl.closest('.alo-card');
        if (card) openQuickView(card.getAttribute('data-id'));
      });
    });
  }

  // --- Active Filter Chips ---
  function renderActiveFilterBadges() {
    if (!elements.activeFiltersRow) return;

    const badges = [];
    if (state.department !== 'all') {
      const dMap = { men: 'Herren', women: 'Damen', curated: 'Curated' };
      badges.push({ type: 'department', label: `Bereich: ${dMap[state.department]}` });
    }
    if (state.category !== 'all') {
      badges.push({ type: 'category', label: `Kategorie: ${state.category}` });
    }
    if (state.brand !== 'all') {
      badges.push({ type: 'brand', label: `Marke: ${state.brand}` });
    }
    if (state.pricePreset !== 'all') {
      const pMap = { under25: '< 25€', '25-50': '25–50€', '50-100': '50–100€', '100plus': '> 100€' };
      badges.push({ type: 'price', label: `Preis: ${pMap[state.pricePreset]}` });
    }
    if (state.searchQuery.trim() !== '') {
      badges.push({ type: 'search', label: `Suche: "${state.searchQuery}"` });
    }

    if (badges.length === 0) {
      elements.activeFiltersRow.innerHTML = '';
      return;
    }

    let html = badges.map(b => `
      <span class="alo-chip">
        <span>${escapeHtml(b.label)}</span>
        <span class="alo-chip-close" data-type="${b.type}">&times;</span>
      </span>
    `).join('');

    html += `<span class="alo-clear-all-link" id="clear-all-chips">Filter löschen</span>`;
    elements.activeFiltersRow.innerHTML = html;

    elements.activeFiltersRow.querySelectorAll('.alo-chip-close').forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.getAttribute('data-type');
        if (type === 'department') {
          state.department = 'all';
          updateCollectionTitle();
        }
        if (type === 'category') state.category = 'all';
        if (type === 'brand') {
          state.brand = 'all';
          elements.brandSelect.value = 'all';
        }
        if (type === 'price') {
          state.pricePreset = 'all';
          updatePricePillsActiveState();
        }
        if (type === 'search') {
          state.searchQuery = '';
          elements.searchInput.value = '';
          elements.searchClear.classList.remove('visible');
        }
        state.currentPage = 1;
        updateDeptLinksActiveState();
        updateCategoryPillsActiveState();
        applyFilters();
      });
    });

    const clearAll = document.getElementById('clear-all-chips');
    if (clearAll) clearAll.addEventListener('click', resetAllFilters);
  }

  function resetAllFilters() {
    state.department = 'all';
    state.category = 'all';
    state.brand = 'all';
    state.pricePreset = 'all';
    state.searchQuery = '';
    state.currentPage = 1;

    if (elements.searchInput) elements.searchInput.value = '';
    if (elements.searchClear) elements.searchClear.classList.remove('visible');
    if (elements.brandSelect) elements.brandSelect.value = 'all';

    updateCollectionTitle();
    updateDeptLinksActiveState();
    updateCategoryPillsActiveState();
    updatePricePillsActiveState();
    applyFilters();
  }

  function updateCollectionTitle() {
    if (!elements.collectionTitle) return;
    const titles = {
      all: 'Shop All',
      men: 'Herren — Shop All',
      women: 'Damen — Shop All',
      curated: 'Curated Drops'
    };
    elements.collectionTitle.textContent = titles[state.department] || 'Shop All';
  }

  function updateDeptLinksActiveState() {
    elements.deptLinks.forEach(link => {
      const dept = link.getAttribute('data-dept');
      link.classList.toggle('active', state.department === dept);
    });
  }

  function updatePricePillsActiveState() {
    elements.pricePills.forEach(p => {
      const preset = p.getAttribute('data-price');
      p.classList.toggle('active', state.pricePreset === preset);
    });
  }

  // --- Pagination ---
  function renderPagination() {
    if (!elements.paginationSection) return;

    const total = state.filteredProducts.length;
    const totalPages = Math.ceil(total / state.pageSize);

    if (totalPages <= 1) {
      elements.paginationSection.style.display = 'none';
      return;
    }
    elements.paginationSection.style.display = 'flex';

    elements.prevPageBtn.disabled = state.currentPage <= 1;
    elements.nextPageBtn.disabled = state.currentPage >= totalPages;

    const startNum = (state.currentPage - 1) * state.pageSize + 1;
    const endNum = Math.min(state.currentPage * state.pageSize, total);
    elements.pageInfo.textContent = `${startNum}–${endNum} von ${total.toLocaleString()} Styles`;

    let pageBtnsHtml = '';
    const maxVisible = 5;
    let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      pageBtnsHtml += `<button class="alo-page-btn" data-page="1">1</button>`;
      if (startPage > 2) pageBtnsHtml += `<span style="color:var(--text-muted);">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      pageBtnsHtml += `<button class="alo-page-btn ${p === state.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pageBtnsHtml += `<span style="color:var(--text-muted);">...</span>`;
      pageBtnsHtml += `<button class="alo-page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    elements.pageNumbers.innerHTML = pageBtnsHtml;

    elements.pageNumbers.querySelectorAll('.alo-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.getAttribute('data-page'), 10);
        goToPage(page);
      });
    });
  }

  function goToPage(page) {
    state.currentPage = page;
    renderProducts();
    renderPagination();
    window.scrollTo({ top: elements.productsGrid.offsetTop - 120, behavior: 'smooth' });
  }

  // --- Quick View Modal ---
  function openQuickView(id) {
    const product = state.allProducts.find(p => p.id === id);
    if (!product) return;

    state.quickViewProduct = product;
    const isWishlisted = state.wishlist.has(product.id);
    const directStoreUrl = product.origLink || product.weblink || '#';
    const agentUrl = product.agentLink || '#';
    const priceFormatted = formatPrice(product.price);

    elements.modalContainer.innerHTML = `
      <button class="alo-modal-close" id="modal-inner-close" title="Schließen">&times;</button>

      <div class="alo-modal-grid">
        <div class="alo-modal-img-wrap">
          <img 
            src="${escapeHtml(product.image)}" 
            alt="${escapeHtml(product.name)}" 
            class="alo-modal-img" 
          />
        </div>

        <div class="alo-modal-info">
          <div class="alo-modal-brand">${escapeHtml(product.brand)}</div>
          <h2 class="alo-modal-title">${escapeHtml(product.name)}</h2>

          <div class="alo-modal-price">${priceFormatted}</div>

          <div class="alo-modal-table">
            <div class="alo-modal-row">
              <span>Artikel ID</span>
              <span>${product.id}</span>
            </div>
            <div class="alo-modal-row">
              <span>Kategorie</span>
              <span>${escapeHtml(product.category)}</span>
            </div>
            <div class="alo-modal-row">
              <span>Bereich</span>
              <span>${escapeHtml(product.department)}</span>
            </div>
            <div class="alo-modal-row">
              <span>Rabattcode</span>
              <span style="color:var(--petrol-accent)">GREC2K (bis zu 40% Rabatt)</span>
            </div>
          </div>

          <div class="alo-modal-actions">
            <a href="${escapeHtml(directStoreUrl)}" target="_blank" rel="noopener noreferrer" class="alo-btn-primary" style="background:var(--petrol-accent);">
              Original Store Öffnen ↗
            </a>
            <a href="${escapeHtml(agentUrl)}" target="_blank" rel="noopener noreferrer" class="alo-btn-primary">
              Über Litbuy Agent Bestellen
            </a>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
              <button class="alo-btn-secondary" id="modal-wishlist-toggle">
                ${isWishlisted ? 'Aus Merkliste entfernen' : 'Auf Merkliste setzen'}
              </button>
              <button class="alo-btn-secondary" id="modal-copy-link">
                Link kopieren
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    elements.modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';

    document.getElementById('modal-inner-close').addEventListener('click', closeModal);
    document.getElementById('modal-wishlist-toggle').addEventListener('click', () => {
      toggleWishlist(product.id);
      openQuickView(product.id);
    });
    document.getElementById('modal-copy-link').addEventListener('click', () => {
      copyToClipboard(directStoreUrl);
      showToast('Store Link kopiert');
    });
  }

  function closeModal() {
    elements.modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  // --- Wishlist Management ---
  function loadWishlist() {
    try {
      const saved = localStorage.getItem('grec2k_wishlist');
      if (saved) {
        state.wishlist = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not load wishlist");
    }
    updateWishlistBadge();
  }

  function saveWishlist() {
    try {
      localStorage.setItem('grec2k_wishlist', JSON.stringify(Array.from(state.wishlist)));
    } catch (e) {
      console.warn("Could not save wishlist");
    }
    updateWishlistBadge();
  }

  function updateWishlistBadge() {
    const count = state.wishlist.size;
    if (elements.wishlistCountBadge) elements.wishlistCountBadge.textContent = `(${count})`;
    if (elements.drawerCount) elements.drawerCount.textContent = count;
  }

  function toggleWishlist(id) {
    if (state.wishlist.has(id)) {
      state.wishlist.delete(id);
      showToast('Von Merkliste entfernt');
    } else {
      state.wishlist.add(id);
      showToast('Zur Merkliste hinzugefügt');
    }
    saveWishlist();
    renderProducts();
    renderWishlistDrawer();
  }

  function openWishlistDrawer() {
    renderWishlistDrawer();
    elements.wishlistBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeWishlistDrawer() {
    elements.wishlistBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderWishlistDrawer() {
    if (!elements.wishlistItemsContainer) return;

    const ids = Array.from(state.wishlist);
    const items = state.allProducts.filter(p => ids.includes(p.id));

    if (items.length === 0) {
      elements.wishlistItemsContainer.innerHTML = `
        <div class="alo-drawer-empty">
          <p>Noch keine Styles gemerkt.</p>
        </div>
      `;
      elements.wishlistTotalVal.textContent = formatPrice(0);
      return;
    }

    let totalPrice = 0;
    const itemsHtml = items.map(item => {
      totalPrice += (item.price || 0);
      const targetUrl = getActiveTargetUrl(item);
      return `
        <div class="alo-saved-item">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="alo-saved-thumb">
          <div class="alo-saved-meta">
            <span class="alo-saved-brand">${escapeHtml(item.brand)}</span>
            <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer" class="alo-saved-title" title="${escapeHtml(item.name)}">
              ${escapeHtml(item.name)}
            </a>
            <span class="alo-saved-price">${formatPrice(item.price)}</span>
          </div>
          <button class="alo-saved-remove" data-id="${item.id}" title="Entfernen">&times;</button>
        </div>
      `;
    }).join('');

    elements.wishlistItemsContainer.innerHTML = itemsHtml;
    elements.wishlistTotalVal.textContent = formatPrice(totalPrice);

    elements.wishlistItemsContainer.querySelectorAll('.alo-saved-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        toggleWishlist(id);
      });
    });
  }

  function exportWishlist() {
    const ids = Array.from(state.wishlist);
    const items = state.allProducts.filter(p => ids.includes(p.id));
    if (items.length === 0) {
      showToast('Keine Artikel zum Exportieren');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID,Brand,Name,Price,Category,Department,StoreLink,AgentLink\n";
    items.forEach(i => {
      const row = [
        i.id,
        `"${(i.brand || '').replace(/"/g, '""')}"`,
        `"${(i.name || '').replace(/"/g, '""')}"`,
        i.price || 0,
        `"${(i.category || '').replace(/"/g, '""')}"`,
        `"${(i.department || '').replace(/"/g, '""')}"`,
        `"${(i.origLink || i.weblink || '').replace(/"/g, '""')}"`,
        `"${(i.agentLink || '').replace(/"/g, '""')}"`
      ].join(',');
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `grec2k_gemerkt_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Export erfolgreich');
  }

  // --- Link Destination Preference ---
  function loadLinkPreference() {
    const saved = localStorage.getItem('grec2k_link_pref');
    if (saved && ['direct', 'agent'].includes(saved)) {
      state.linkPreference = saved;
    }
    updateLinkPrefButtons();
  }

  function setLinkPreference(pref) {
    state.linkPreference = pref;
    localStorage.setItem('grec2k_link_pref', pref);
    updateLinkPrefButtons();
    renderProducts();
    showToast(`Klick-Ziel: ${pref === 'direct' ? 'Original Store' : 'Litbuy Agent'}`);
  }

  function updateLinkPrefButtons() {
    elements.linkPrefBtns.forEach(btn => {
      const p = btn.getAttribute('data-pref');
      btn.classList.toggle('active', state.linkPreference === p);
    });
  }

  // --- Toast ---
  function showToast(message) {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'alo-toast';
    toast.innerHTML = `<span class="alo-toast-dot"></span><span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    let searchTimer = null;
    elements.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      const val = e.target.value;
      elements.searchClear.classList.toggle('visible', val.length > 0);
      searchTimer = setTimeout(() => {
        state.searchQuery = val;
        state.currentPage = 1;
        applyFilters();
      }, 200);
    });

    elements.searchClear.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.searchClear.classList.remove('visible');
      state.searchQuery = '';
      state.currentPage = 1;
      applyFilters();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeWishlistDrawer();
      }
    });

    elements.deptLinks.forEach(link => {
      link.addEventListener('click', () => {
        state.department = link.getAttribute('data-dept');
        state.currentPage = 1;
        updateCollectionTitle();
        updateDeptLinksActiveState();
        applyFilters();
      });
    });

    elements.brandSelect.addEventListener('change', (e) => {
      state.brand = e.target.value;
      state.currentPage = 1;
      applyFilters();
    });

    elements.pricePills.forEach(pill => {
      pill.addEventListener('click', () => {
        state.pricePreset = pill.getAttribute('data-price');
        state.currentPage = 1;
        updatePricePillsActiveState();
        applyFilters();
      });
    });

    elements.sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      applyFilters();
    });

    elements.currencySelect.addEventListener('change', (e) => {
      state.currency = e.target.value;
      renderProducts();
      renderWishlistDrawer();
      showToast(`Währung: ${state.currency}`);
    });

    if (elements.pageSizeSelect) {
      elements.pageSizeSelect.addEventListener('change', (e) => {
        state.pageSize = parseInt(e.target.value, 10);
        state.currentPage = 1;
        renderProducts();
        renderPagination();
      });
    }

    elements.viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-view');
        state.viewMode = mode;
        elements.productsGrid.className = `alo-product-grid ${mode === 'compact' ? 'compact' : (mode === 'list' ? 'list' : '')}`;
      });
    });

    elements.linkPrefBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const pref = btn.getAttribute('data-pref');
        setLinkPreference(pref);
      });
    });

    elements.prevPageBtn.addEventListener('click', () => {
      if (state.currentPage > 1) goToPage(state.currentPage - 1);
    });
    elements.nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(state.filteredProducts.length / state.pageSize);
      if (state.currentPage < totalPages) goToPage(state.currentPage + 1);
    });

    elements.wishlistToggleBtn.addEventListener('click', openWishlistDrawer);
    elements.wishlistCloseBtn.addEventListener('click', closeWishlistDrawer);
    elements.wishlistBackdrop.addEventListener('click', (e) => {
      if (e.target === elements.wishlistBackdrop) closeWishlistDrawer();
    });
    elements.wishlistExportBtn.addEventListener('click', exportWishlist);
    elements.wishlistClearBtn.addEventListener('click', () => {
      if (confirm('Merkliste leeren?')) {
        state.wishlist.clear();
        saveWishlist();
        renderProducts();
        renderWishlistDrawer();
        showToast('Merkliste geleert');
      }
    });

    elements.modalCloseBtn.addEventListener('click', closeModal);
    elements.modalBackdrop.addEventListener('click', (e) => {
      if (e.target === elements.modalBackdrop) closeModal();
    });

    document.querySelectorAll('.badge-code').forEach(badge => {
      badge.addEventListener('click', () => {
        copyToClipboard('GREC2K');
        showToast('Code "GREC2K" kopiert');
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
