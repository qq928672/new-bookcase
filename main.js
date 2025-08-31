   // ======= 資料模型與工具 =======
    const STORAGE_KEY = 'bookIslandData.v1';
    const defaultCover = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e3f2fd"/>
            <stop offset="100%" stop-color="#fce4ec"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <g fill="#90a4ae" font-family="'Noto Sans TC', system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial" font-size="22" text-anchor="middle">
          <text x="200" y="290">No Cover</text>
          <text x="200" y="324">封面預覽</text>
        </g>
      </svg>
    `);

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

    function loadData() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) throw new Error('empty');
        const data = JSON.parse(raw);
        if (!data.shelves || !data.books) throw new Error('bad shape');
        return data;
      } catch {
        const firstShelfId = uid('s');
        const seed = {
          shelves: [{ id: firstShelfId, name: '我的書櫃', createdAt: Date.now() }],
          books: [],
          activeShelfId: firstShelfId
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
    }

    function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

    let state = loadData();

    // ======= UI 元件 =======
    const shelfList = $('#shelfList');
    const activeShelfTitle = $('#activeShelfTitle');
    const bookCount = $('#bookCount');
    const bookGrid = $('#bookGrid');
    const emptyState = $('#emptyState');
    const API_URL = "https://book-api-hjb9.onrender.com";

    // 搜尋與篩選（桌機、手機共用）
    const searchInputs = [$('#searchInput'), $('#mSearchInput')];
    const statusFilters = [$('#statusFilter'), $('#mStatusFilter')];

    // Modal 與表單元素
    const bookModal = new bootstrap.Modal('#bookModal');
    const shelfModal = new bootstrap.Modal('#shelfModal');
    const bookForm = $('#bookForm');
    const shelfForm = $('#shelfForm');

    const bookIdInput = $('#bookId');
    const coverUrlInput = $('#coverUrl');
    const coverPreview = $('#coverPreview');
    const titleInput = $('#title');
    const authorInput = $('#author');
    const statusSelect = $('#status');
    const ratingInput = $('#rating');
    const notesInput = $('#notes');

    const ratingStars = $('#ratingStars');

    const shelfIdInput = $('#shelfId');
    const shelfNameInput = $('#shelfName');

    // ======= 渲染邏輯 =======
    function getActiveShelf() {
      return state.shelves.find(s => s.id === state.activeShelfId);
    }

    function countBooksByShelf(shelfId) {
      return state.books.filter(b => b.shelfId === shelfId).length;
    }

    function renderShelves() {
      shelfList.innerHTML = '';
      state.shelves.forEach(s => {
        const isActive = s.id === state.activeShelfId;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center ' + (isActive ? 'active' : '');
        item.innerHTML = `
          <div class="d-flex align-items-center gap-2">
            <i class="bi ${isActive ? 'bi-folder2-open' : 'bi-folder2'}"></i>
            <span>${s.name}</span>
          </div>
          <span class="badge text-bg-light">${countBooksByShelf(s.id)}</span>
        `;
        item.addEventListener('click', () => {
          state.activeShelfId = s.id;
          saveData();
          renderShelves();
          renderBooks();
          const canvasEl = document.getElementById('shelfCanvas');
          const oc = bootstrap.Offcanvas.getInstance(canvasEl);
          if (oc) oc.hide();
        });
        shelfList.appendChild(item);
      });
    }

    function statusBadge(status) {
      const map = { '未讀': 'secondary', '閱讀中': 'info', '已讀': 'success' };
      const cls = map[status] || 'secondary';
      return `<span class="badge text-bg-${cls} badge-status">${status}</span>`;
    }

    function starHtml(n = 0) {
      let h = '';
      for (let i = 1; i <= 5; i++) h += `<i class="bi ${i <= n ? 'bi-star-fill text-warning' : 'bi-star text-muted'}"></i>`;
      return h;
    }

    function currentSearchText() {
      return (searchInputs.map(i => i?.value || '').find(v => v.length > 0) || '').trim();
    }
    function currentStatusFilter() {
      return (statusFilters.map(s => s?.value || '').find(v => v.length > 0) || '').trim();
    }

    function renderBooks() {
      const shelf = getActiveShelf();
      activeShelfTitle.textContent = shelf ? shelf.name : '（未選擇）';

      let books = state.books.filter(b => b.shelfId === (shelf?.id));
      const q = currentSearchText().toLowerCase();
      if (q) books = books.filter(b =>
        (b.title || '').toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q) ||
        (b.notes || '').toLowerCase().includes(q)
      );
      const f = currentStatusFilter();
      if (f) books = books.filter(b => b.status === f);

      books.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

      bookCount.textContent = `共 ${books.length} 本書`;

      bookGrid.innerHTML = '';

      if (books.length === 0) {
        emptyState.classList.remove('d-none');
        return;
      } else {
        emptyState.classList.add('d-none');
      }

      books.forEach(b => {
        const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-md-3 col-lg-2';
        col.innerHTML = `
          <div class="card island h-100">
            <div class="cover-wrap">
              <div class="cover"><img alt="封面" loading="lazy"></div>
            </div>
            <div class="card-body d-flex flex-column">
              <div class="d-flex align-items-start justify-content-between gap-2 mb-1">
                <h6 class="card-title mb-0" title="${b.title}">${b.title}</h6>
                ${statusBadge(b.status)}
              </div>
              <div class="text-secondary small mb-2">${b.author || '—'}</div>
              <div class="mb-2">${starHtml(b.rating || 0)}</div>
              <p class="card-text note-snippet flex-grow-1">${(b.notes || '').replace(/</g, '&lt;')}</p>
              <div class="d-flex gap-2 mt-2">
                <button class="btn btn-sm btn-outline-primary flex-fill" data-action="edit"><i class="bi bi-pencil-square me-1"></i>編輯</button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete"><i class="bi bi-trash3"></i></button>
              </div>
            </div>
          </div>`;

        const img = col.querySelector('img');
        img.src = b.coverUrl || defaultCover;
        img.onerror = () => { img.src = defaultCover; };

        const editBtn = col.querySelector('[data-action="edit"]');
        editBtn.addEventListener('click', () => openBookModal(b));
        const delBtn = col.querySelector('[data-action="delete"]');
        delBtn.addEventListener('click', () => deleteBook(b.id));

        bookGrid.appendChild(col);
      })
    }

    // ======= 書籍 CRUD =======
    function openBookModal(book = null) {
      // reset form
      bookForm.classList.remove('was-validated');
      bookIdInput.value = book?.id || '';
      coverUrlInput.value = book?.coverUrl || '';
      titleInput.value = book?.title || '';
      authorInput.value = book?.author || '';
      statusSelect.value = book?.status || '未讀';
      ratingInput.value = book?.rating || 0;
      notesInput.value = book?.notes || '';
      updateStars(+ratingInput.value);
      updateCoverPreview();
      $('#bookModalTitle').textContent = book ? '編輯書籍' : '新增書籍';
      bookModal.show();
    }

    function updateCoverPreview() {
      const url = coverUrlInput.value.trim();
      coverPreview.src = url || defaultCover;
      coverPreview.onerror = () => { coverPreview.src = defaultCover; };
    }

    function updateStars(n) {
      ratingInput.value = n;
      ratingStars.querySelectorAll('.star').forEach(st => {
        const v = +st.dataset.val;
        st.classList.toggle('active', v <= n);
        st.classList.toggle('bi-star-fill', v <= n);
        st.classList.toggle('bi-star', v > n);
      });
    }
    async function autofillFromBooksUrl() {
      const url = document.getElementById('bookUrlInput').value.trim();
      if (!url) { alert('請貼上博客來網址'); return; }

      try {
        const res = await fetch(`${API_URL}/book?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.error) { alert('錯誤：' + data.error); return; }

        // ✅ 用已存在的變數，對應到 #title / #author / #coverUrl
        titleInput.value = data.title || '';
        titleInput.title = data.title || '';   // ← hover 顯示完整書名
        authorInput.value = (data.author || '').split(',').map(s => s.trim()).join('、');
        coverUrlInput.value = data.cover || '';

        // 更新封面預覽（你已有 updateCoverPreview 與 coverPreview 變數）
        updateCoverPreview();

        // 如果未建立 ISBN 欄位就不要寫它（避免再度報 null）
        // const isbnEl = document.getElementById('isbnInput');
        // if (isbnEl) isbnEl.value = data.isbn || '';
      } catch (e) {
        alert('連線失敗：' + e);
        console.error(e);
      }
    }

    // 綁定按鈕
    document.getElementById('fetchBookBtn')
      ?.addEventListener('click', autofillFromBooksUrl);

    function saveBookFromForm(e) {
      e.preventDefault();
      bookForm.classList.add('was-validated');
      if (!bookForm.checkValidity()) return;

      const id = bookIdInput.value || uid('b');
      const isNew = !bookIdInput.value;
      const payload = {
        id,
        shelfId: state.activeShelfId,
        title: titleInput.value.trim(),
        author: authorInput.value.trim(),
        coverUrl: coverUrlInput.value.trim(),
        status: statusSelect.value,
        rating: +ratingInput.value || 0,
        notes: notesInput.value.trim(),
      };
      const now = Date.now();

      if (isNew) {
        payload.createdAt = now; payload.updatedAt = now;
        state.books.push(payload);
      } else {
        const idx = state.books.findIndex(b => b.id === id);
        if (idx >= 0) {
          state.books[idx] = { ...state.books[idx], ...payload, updatedAt: now };
        }
      }
      saveData();
      renderBooks();
      bookModal.hide();
    }

    function deleteBook(id) {
      if (!confirm('確定要刪除這本書嗎？')) return;
      state.books = state.books.filter(b => b.id !== id);
      saveData();
      renderBooks();
    }

    // ======= 書櫃 CRUD =======
    function openShelfModal(shelf = null) {
      shelfForm.classList.remove('was-validated');
      shelfIdInput.value = shelf?.id || '';
      shelfNameInput.value = shelf?.name || '';
      $('#shelfModalTitle').textContent = shelf ? '重命名書櫃' : '新增書櫃';
      shelfModal.show();
    }

    function saveShelfFromForm(e) {
      e.preventDefault();
      shelfForm.classList.add('was-validated');
      if (!shelfForm.checkValidity()) return;

      const id = shelfIdInput.value || uid('s');
      const isNew = !shelfIdInput.value;
      const name = shelfNameInput.value.trim();
      if (isNew) {
        state.shelves.push({ id, name, createdAt: Date.now() });
        state.activeShelfId = id;
      } else {
        const s = state.shelves.find(s => s.id === id);
        if (s) s.name = name;
      }
      saveData();
      renderShelves();
      renderBooks();
      shelfModal.hide();
    }

    function deleteActiveShelf() {
      const shelf = getActiveShelf();
      if (!shelf) return;
      const hasBooks = state.books.some(b => b.shelfId === shelf.id);
      const msg = hasBooks ? '此書櫃內含有書籍，刪除將一併移除。確定要刪除嗎？' : '確定要刪除這個書櫃嗎？';
      if (!confirm(msg)) return;

      // 刪書
      state.books = state.books.filter(b => b.shelfId !== shelf.id);
      // 刪櫃
      state.shelves = state.shelves.filter(s => s.id !== shelf.id);
      // 切換到第一個或新建
      if (state.shelves.length) {
        state.activeShelfId = state.shelves[0].id;
      } else {
        const nid = uid('s');
        state.shelves.push({ id: nid, name: '我的書櫃', createdAt: Date.now() });
        state.activeShelfId = nid;
      }
      saveData();
      renderShelves();
      renderBooks();
    }

    // ======= 事件繫結 =======

    // 搜尋 + 篩選
    searchInputs.forEach(inp => inp && inp.addEventListener('input', renderBooks));
    statusFilters.forEach(sel => sel && sel.addEventListener('change', renderBooks));

    // 新增書籍
    $('#addBookBtn').addEventListener('click', () => openBookModal());
    $('#emptyAddBook').addEventListener('click', () => openBookModal());

    // 書籍表單提交＆星星點擊
    bookForm.addEventListener('submit', saveBookFromForm);
    coverUrlInput.addEventListener('input', updateCoverPreview);
    ratingStars.querySelectorAll('.star').forEach(st => st.addEventListener('click', e => updateStars(+e.currentTarget.dataset.val)));

    // 書櫃新增/重命名/刪除
    $('#addShelfBtn').addEventListener('click', () => openShelfModal());
    $('#renameShelfBtn').addEventListener('click', () => openShelfModal(getActiveShelf()));
    $('#deleteShelfBtn').addEventListener('click', deleteActiveShelf);
    shelfForm.addEventListener('submit', saveShelfFromForm);

    // ======= 初始化 =======
    renderShelves();
    renderBooks();