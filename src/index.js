// ===== 书库主界面逻辑 =====

let allBooks = [];
let currentView = 'cn';
let currentSearchType = 'fuzzy';
let bookshelf = [];
let allReadingTime = {};

function parseBookId(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return s;
}

function shortBookId(bookid) {
  const s = String(bookid);
  if (s.length > 12) return s.slice(0, 8) + '…';
  return s;
}

// ===== 初始化 =====
async function init() {
  allBooks = await window.api.getBooks();
  const counts = await window.api.getBookCount();

  // 更新计数
  for (const cat of ['cn', 'en', 'yi', 'local']) {
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = counts[cat] || 0;
  }

  // 加载书架
  bookshelf = await window.api.getBookshelf();
  document.getElementById('count-shelf').textContent = bookshelf.length;

  // 加载阅读时长
  allReadingTime = await window.api.getAllReadingTime();
  updateTotalTime();

  // 渲染当前分类
  renderBookGrid(currentView);

  // 绑定事件
  bindEvents();
}

async function refreshBooks() {
  allBooks = await window.api.getBooks();
  const counts = await window.api.getBookCount();
  for (const cat of ['cn', 'en', 'yi', 'local']) {
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = counts[cat] || 0;
  }
  bookshelf = await window.api.getBookshelf();
  document.getElementById('count-shelf').textContent = bookshelf.length;
}

function updateImportToolbar(view) {
  const toolbar = document.getElementById('importToolbar');
  if (!toolbar) return;
  toolbar.style.display = view === 'local' ? 'flex' : 'none';
}

// ===== 事件绑定 =====
function bindEvents() {
  // 侧边栏导航
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentView = view;

      // 隐藏搜索结果
      document.getElementById('searchResults').style.display = 'none';
      updateImportToolbar(view);

      if (view === 'shelf') {
        document.getElementById('importToolbar').style.display = 'none';
        renderShelf();
      } else {
        document.getElementById('shelfView').style.display = 'none';
        document.getElementById('bookGrid').style.display = 'grid';
        renderBookGrid(view);
      }
    });
  });

  // 搜索标签切换
  document.querySelectorAll('.search-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSearchType = tab.dataset.type;
      const input = document.getElementById('searchInput');
      if (currentSearchType === 'content') {
        input.placeholder = '输入要搜索的内容...';
      } else if (currentSearchType === 'author') {
        input.placeholder = '输入作者名...';
      } else if (currentSearchType === 'title') {
        input.placeholder = '输入完整书名...';
      } else {
        input.placeholder = '输入书名关键词...';
      }
    });
  });

  // 搜索按钮
  document.getElementById('searchBtn').addEventListener('click', doSearch);

  // 搜索回车
  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  const importBtn = document.getElementById('importBtn');
  if (importBtn) {
    importBtn.addEventListener('click', doImportBooks);
  }
  const openDirBtn = document.getElementById('openImportDirBtn');
  if (openDirBtn) {
    openDirBtn.addEventListener('click', async () => {
      await window.api.openImportedDir();
    });
  }
}

async function doImportBooks() {
  const loading = document.getElementById('loading');
  const loadingText = loading.querySelector('p');
  const prevText = loadingText.textContent;
  loadingText.textContent = '正在导入...';
  loading.style.display = 'flex';

  try {
    const result = await window.api.importBooks();
    if (result.canceled) return;

    await refreshBooks();
    if (currentView === 'local') {
      renderBookGrid('local');
    }

    const ok = (result.imported || []).length;
    const err = (result.errors || []).length;
    let msg = `成功导入 ${ok} 本`;
    if (err > 0) {
      const details = result.errors.map(e => `${e.path}: ${e.error}`).join('\n');
      msg += `\n失败 ${err} 本:\n${details}`;
    }
    alert(msg);
  } catch (e) {
    alert('导入失败: ' + (e.message || e));
  } finally {
    loading.style.display = 'none';
    loadingText.textContent = prevText;
  }
}

// ===== 渲染书籍网格 =====
function renderBookGrid(category) {
  const grid = document.getElementById('bookGrid');
  const books = allBooks.filter(b => b.category === category);
  updateImportToolbar(category);

  if (books.length === 0) {
    grid.style.display = 'none';
    document.getElementById('emptyState').style.display = 'flex';
    const emptyP = document.getElementById('emptyState').querySelector('p');
    if (category === 'local') {
      emptyP.textContent = '还没有导入书籍，点击上方「导入书籍」添加 TXT / EPUB / MOBI';
    } else {
      emptyP.textContent = '暂无数据';
    }
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  grid.style.display = 'grid';

  grid.innerHTML = books.map(book => {
    const formatBadge = book.format
      ? `<span class="format-badge">${escapeHtml(String(book.format).toUpperCase())}</span>`
      : '';
    const deleteBtn = category === 'local'
      ? `<div class="book-card-actions"><button class="book-card-delete" data-bookid="${escapeHtml(String(book.bookid))}">删除</button></div>`
      : '';
    return `
    <div class="book-card" data-category="${book.category}" data-bookid="${escapeHtml(String(book.bookid))}">
      <div class="book-card-title">${escapeHtml(book.title)}</div>
      ${book.author ? `<div class="book-card-author">${escapeHtml(book.author)}</div>` : ''}
      <div class="book-card-id">${formatBadge} #${escapeHtml(shortBookId(book.bookid))} · ${categoryLabel(book.category)}</div>
      ${deleteBtn}
    </div>
  `;
  }).join('');

  // 绑定点击事件
  grid.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('book-card-delete')) return;
      const cat = card.dataset.category;
      const bid = parseBookId(card.dataset.bookid);
      showModeSelector(cat, bid);
    });
  });

  grid.querySelectorAll('.book-card-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const bid = parseBookId(btn.dataset.bookid);
      if (!confirm('确定删除这本导入的书？文件与阅读进度将一并清除。')) return;
      const result = await window.api.deleteImportedBook(bid);
      if (!result.success) {
        alert(result.error || '删除失败');
        return;
      }
      await refreshBooks();
      renderBookGrid('local');
    });
  });
}

// ===== 渲染书架 =====
async function renderShelf() {
  const shelfView = document.getElementById('shelfView');
  const grid = document.getElementById('bookGrid');

  bookshelf = await window.api.getBookshelf();
  document.getElementById('count-shelf').textContent = bookshelf.length;

  grid.style.display = 'none';
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('importToolbar').style.display = 'none';

  if (bookshelf.length === 0) {
    shelfView.style.display = 'flex';
    shelfView.style.flexDirection = 'column';
    shelfView.style.alignItems = 'center';
    shelfView.style.justifyContent = 'center';
    shelfView.style.minHeight = '400px';
    shelfView.innerHTML = '<p style="color: var(--text-muted); font-size: 16px;">书架还是空的，去书库找本书读读吧~</p>';
    return;
  }

  shelfView.style.display = 'flex';
  shelfView.style.flexDirection = 'column';
  shelfView.style.gap = '12px';

  shelfView.innerHTML = bookshelf.map(item => {
    const time = formatReadingTime(allReadingTime[`${item.category}_${item.bookid}`] || 0);
    const lastRead = formatTime(item.lastRead);
    return `
      <div class="shelf-card" data-category="${item.category}" data-bookid="${escapeHtml(String(item.bookid))}">
        <div class="shelf-card-info">
          <div class="shelf-card-title">${escapeHtml(item.title)}</div>
          <div class="shelf-card-meta">
            <span>${categoryLabel(item.category)} #${escapeHtml(shortBookId(item.bookid))}</span>
            ${item.author ? `<span>作者: ${escapeHtml(item.author)}</span>` : ''}
            <span>最后阅读: ${lastRead}</span>
          </div>
        </div>
        <div class="shelf-card-time">${time}</div>
        <button class="shelf-card-remove" data-category="${item.category}" data-bookid="${escapeHtml(String(item.bookid))}">移除</button>
      </div>
    `;
  }).join('');

  // 绑定点击
  shelfView.querySelectorAll('.shelf-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('shelf-card-remove')) return;
      const cat = card.dataset.category;
      const bid = parseBookId(card.dataset.bookid);
      showModeSelector(cat, bid);
    });
  });

  // 移除按钮
  shelfView.querySelectorAll('.shelf-card-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cat = btn.dataset.category;
      const bid = parseBookId(btn.dataset.bookid);
      await window.api.removeFromShelf(cat, bid);
      renderShelf();
    });
  });
}

// ===== 搜索 =====
async function doSearch() {
  const keyword = document.getElementById('searchInput').value.trim();
  if (!keyword) return;

  const loading = document.getElementById('loading');
  const grid = document.getElementById('bookGrid');
  const shelfView = document.getElementById('shelfView');
  const resultsDiv = document.getElementById('searchResults');
  const emptyState = document.getElementById('emptyState');

  loading.style.display = 'flex';
  grid.style.display = 'none';
  shelfView.style.display = 'none';
  resultsDiv.style.display = 'none';
  emptyState.style.display = 'none';
  document.getElementById('importToolbar').style.display = 'none';

  let results = [];
  if (currentSearchType === 'content') {
    results = await window.api.searchContent(keyword, null);
  } else {
    results = await window.api.searchBooks(currentSearchType, keyword);
  }

  loading.style.display = 'none';

  if (results.length === 0) {
    emptyState.style.display = 'flex';
    emptyState.querySelector('p').textContent = `未找到与"${keyword}"相关的结果`;
    return;
  }

  resultsDiv.style.display = 'flex';
  resultsDiv.innerHTML = `<div style="margin-bottom:8px;color:var(--text-secondary);font-size:13px;">找到 ${results.length} 条结果</div>` +
    results.map(book => {
      if (currentSearchType === 'content') {
        return `
          <div class="search-result-item" data-category="${book.category}" data-bookid="${escapeHtml(String(book.bookid))}">
            <div class="search-result-header">
              <span class="search-result-title">${escapeHtml(book.title)}</span>
              <span class="search-result-badge">${book.matchCount}处匹配</span>
              ${book.author ? `<span class="search-result-author">· ${escapeHtml(book.author)}</span>` : ''}
            </div>
            <div class="search-result-snippets">
              ${book.snippets.map(s => `<div class="search-result-snippet">${highlightKeyword(escapeHtml(s.text), keyword)}</div>`).join('')}
            </div>
          </div>
        `;
      }
      return `
        <div class="search-result-item" data-category="${book.category}" data-bookid="${escapeHtml(String(book.bookid))}">
          <div class="search-result-header">
            <span class="search-result-title">${highlightKeyword(escapeHtml(book.title), keyword)}</span>
            <span class="search-result-badge">${categoryLabel(book.category)} #${escapeHtml(shortBookId(book.bookid))}</span>
          </div>
          ${book.author ? `<div class="search-result-author">作者: ${highlightKeyword(escapeHtml(book.author), keyword)}</div>` : ''}
        </div>
      `;
    }).join('');

  // 绑定点击
  resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const cat = item.dataset.category;
      const bid = parseBookId(item.dataset.bookid);
      showModeSelector(cat, bid);
    });
  });
}

// ===== 模式选择器 =====
let pendingBook = null;

function showModeSelector(category, bookid) {
  pendingBook = { category, bookid };
  document.querySelector('.mode-selector-overlay').classList.add('show');
  document.querySelector('.mode-selector').classList.add('show');
}

function hideModeSelector() {
  document.querySelector('.mode-selector-overlay').classList.remove('show');
  document.querySelector('.mode-selector').classList.remove('show');
  pendingBook = null;
}

function setupModeSelector() {
  const overlay = document.createElement('div');
  overlay.className = 'mode-selector-overlay';

  const selector = document.createElement('div');
  selector.className = 'mode-selector';
  selector.innerHTML = `
    <div class="mode-selector-title">选择阅读模式</div>
    <div class="mode-options">
      <div class="mode-option" data-mode="window">
        <div class="mode-option-icon">🪟</div>
        <div class="mode-option-name">窗口模式</div>
        <div class="mode-option-desc">标准窗口阅读</div>
      </div>
      <div class="mode-option" data-mode="fullscreen">
        <div class="mode-option-icon">🖥️</div>
        <div class="mode-option-name">全屏模式</div>
        <div class="mode-option-desc">沉浸式全屏</div>
      </div>
      <div class="mode-option" data-mode="moyu">
        <div class="mode-option-icon">🐟</div>
        <div class="mode-option-name">摸鱼模式</div>
        <div class="mode-option-desc">隐蔽长条栏</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(selector);

  overlay.addEventListener('click', hideModeSelector);

  selector.querySelectorAll('.mode-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      if (!pendingBook) return;
      const mode = opt.dataset.mode;

      // 获取阅读进度
      const progress = await window.api.getProgress(pendingBook.category, pendingBook.bookid);
      const page = progress ? progress.page : 0;

      await window.api.openReader(pendingBook.category, pendingBook.bookid, page, mode);
      hideModeSelector();

      // 刷新书架
      bookshelf = await window.api.getBookshelf();
      document.getElementById('count-shelf').textContent = bookshelf.length;
    });
  });
}

// ===== 工具函数 =====
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function highlightKeyword(text, keyword) {
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), (match) => `<mark>${match}</mark>`);
}

function categoryLabel(cat) {
  const labels = { cn: '中文', en: '英文', yi: '译文', local: '导入' };
  return labels[cat] || cat;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatReadingTime(seconds) {
  if (!seconds || seconds === 0) return '0分钟';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}小时${mins}分钟`;
  return `${mins}分钟`;
}

function updateTotalTime() {
  let total = 0;
  for (const key in allReadingTime) {
    total += allReadingTime[key];
  }
  document.getElementById('totalTime').textContent = formatReadingTime(total);
}

// ===== 启动 =====
setupModeSelector();
init();

// 定时刷新阅读时长
setInterval(async () => {
  allReadingTime = await window.api.getAllReadingTime();
  updateTotalTime();
  if (currentView === 'shelf') {
    renderShelf();
  }
}, 30000);
