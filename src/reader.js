// ===== 阅读器逻辑 =====

// 获取 URL 参数
const urlParams = new URLSearchParams(window.location.search);
const MODE = urlParams.get('mode') || 'window';
const CATEGORY = urlParams.get('category') || 'cn';
const BOOKID = parseInt(urlParams.get('bookid') || '1');
const START_PAGE = parseInt(urlParams.get('page') || '0');

// 状态
let bookContent = '';
let bookLines = [];
let currentPage = START_PAGE;
let totalPages = 0;
let linesPerPage = 30;
let fontSize = 18;
let bookmarks = [];
let readingTimeSeconds = 0;
let readingTimer = null;
let lastSaveTime = 0;

// 摸鱼模式分页大小（动态计算）
let moyuCharsPerPage = 40;
let moyuPageContent = [];
let moyuCurrentPage = 0;

// 章节列表
let chapters = [];          // [{ title, lineIndex }]
let moyuLineOffsets = [];   // moyuLineOffsets[i] = bookLines[i] 在摸鱼 fullText 中的字符偏移

// 章节匹配正则（参考 dooshu README 正则规则）
// 匹配：第N章/节/回/卷/部/篇（中文数字或阿拉伯数字）
// 匹配：Chapter N（英文）
const CHAPTER_REGEX = /^第[\d一二三四五六七八九十百千万零两壹贰叁肆伍陆柒捌玖拾佰仟]+[章节回卷部篇]\s*.*|^Chapter\s+[\dIVXLCDMivxlcdm]+.*/i;

// 主题预设
const THEME_PRESETS = {
  dark: {
    bgPrimary: '#1a1a2e',
    bgSecondary: '#16213e',
    bgTertiary: '#0f3460',
    textPrimary: '#e0e0e0',
    textSecondary: '#a0a0b0',
    textMuted: '#666680',
    accent: '#e94560',
    border: '#2a2a4e'
  },
  light: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f0f0f5',
    bgTertiary: '#e0e0ea',
    textPrimary: '#333333',
    textSecondary: '#666666',
    textMuted: '#999999',
    accent: '#e94560',
    border: '#d0d0da'
  },
  sepia: {
    bgPrimary: '#f4ecd8',
    bgSecondary: '#ebe0c8',
    bgTertiary: '#dfd3b8',
    textPrimary: '#5b4636',
    textSecondary: '#7a6552',
    textMuted: '#a09080',
    accent: '#c47d3c',
    border: '#d0c4a8'
  },
  night: {
    bgPrimary: '#000000',
    bgSecondary: '#0a0a0a',
    bgTertiary: '#1a1a1a',
    textPrimary: '#888888',
    textSecondary: '#666666',
    textMuted: '#444444',
    accent: '#444444',
    border: '#222222'
  }
};
let currentTheme = null;
let saveThemeTimer = null;

// ===== 初始化 =====
async function init() {
  // 设置模式
  document.body.className = `mode-${MODE}`;

  if (MODE === 'moyu') {
    document.getElementById('readerContainer').style.display = 'none';
    document.getElementById('moyuContainer').style.display = 'flex';
    document.getElementById('moyuHideDivider').style.display = 'block';
    document.getElementById('moyuHideItem').style.display = 'block';
  } else {
    document.getElementById('readerContainer').style.display = 'flex';
    document.getElementById('moyuContainer').style.display = 'none';
    document.getElementById('moyuHideDivider').style.display = 'none';
    document.getElementById('moyuHideItem').style.display = 'none';
  }

  // 加载书籍内容
  bookContent = await window.api.readBook(CATEGORY, BOOKID);
  if (!bookContent) {
    document.getElementById('readerText').textContent = '无法加载书籍内容';
    document.getElementById('moyuText').textContent = '无法加载书籍内容';
    return;
  }

  // 按行分割
  bookLines = bookContent.split('\n').filter(line => line.trim() !== '');

  // 解析章节 & 预计算摸鱼模式行偏移
  parseChapters();
  computeMoyuLineOffsets();
  renderChapterList();

  // 获取书名
  const titleLine = bookLines[0] || '未知书名';
  let bookTitle = titleLine;
  let bookAuthor = '';
  if (titleLine.includes(' - ')) {
    const parts = titleLine.split(' - ');
    bookTitle = parts[0].trim();
    bookAuthor = parts.slice(1).join(' - ').trim();
  }

  // 设置标题
  document.getElementById('bookTitle').textContent = bookTitle;
  document.getElementById('bookInfo').textContent = `${bookTitle}${bookAuthor ? ' · ' + bookAuthor : ''}`;
  document.title = bookTitle;

  // 加载进度
  const progress = await window.api.getProgress(CATEGORY, BOOKID);
  if (progress && progress.page !== undefined) {
    currentPage = progress.page;
  }

  // 加载书签
  bookmarks = await window.api.getBookmarks(CATEGORY, BOOKID);
  renderBookmarks();

  // 加载阅读时长
  const savedTime = await window.api.getReadingTime(CATEGORY, BOOKID);
  readingTimeSeconds = 0; // 本次会话从0开始，总时长在底部显示
  updateReadingTimeDisplay(savedTime || 0);

  // 加载主题
  currentTheme = await window.api.getTheme();
  applyTheme(currentTheme);

  // 计算分页
  calculatePages();

  // 渲染内容
  renderPage();

  // 开始计时
  startReadingTimer();

  // 绑定事件
  bindEvents();
}

// ===== 分页计算 =====
function calculateMoyuCharsPerPage() {
  const moyuText = document.getElementById('moyuText');
  if (!moyuText) return 40;

  const containerWidth = moyuText.clientWidth;
  if (containerWidth <= 0) return 40;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const style = getComputedStyle(moyuText);
  const fontSize = style.fontSize || '13px';
  const fontFamily = style.fontFamily || '"Microsoft YaHei", sans-serif';
  ctx.font = `${fontSize} ${fontFamily}`;

  const fullText = bookLines.join(' ').replace(/\s+/g, ' ').trim();
  let width = 0;
  let count = 0;
  const maxWidth = containerWidth - 6;

  while (count < fullText.length && width < maxWidth) {
    width += ctx.measureText(fullText[count]).width;
    if (width < maxWidth) count++;
  }

  return Math.max(10, count);
}

function calculatePages() {
  if (MODE === 'moyu') {
    // 摸鱼模式：动态测量可见宽度后按字符精确分页
    moyuCharsPerPage = calculateMoyuCharsPerPage();
    const fullText = bookLines.join(' ').replace(/\s+/g, ' ').trim();
    moyuPageContent = [];
    for (let i = 0; i < fullText.length; i += moyuCharsPerPage) {
      moyuPageContent.push(fullText.substring(i, i + moyuCharsPerPage));
    }
    totalPages = moyuPageContent.length;
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;
    moyuCurrentPage = currentPage;
  } else {
    // 窗口/全屏模式：按行分页
    totalPages = Math.ceil(bookLines.length / linesPerPage);
    // 第一行是书名，从第二行开始阅读
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;
  }
}

// ===== 渲染页面 =====
function renderPage() {
  if (MODE === 'moyu') {
    renderMoyuPage();
  } else {
    renderReaderPage();
  }
  updateProgress();
  highlightCurrentChapter();
  saveProgressDebounced();
}

function renderReaderPage() {
  const readerText = document.getElementById('readerText');
  const startIdx = currentPage * linesPerPage;
  const endIdx = Math.min(startIdx + linesPerPage, bookLines.length);
  const lines = bookLines.slice(startIdx, endIdx);

  readerText.style.fontSize = fontSize + 'px';
  readerText.textContent = lines.join('\n');

  // 更新页码
  document.getElementById('pageInfo').textContent = `${currentPage + 1} / ${totalPages}`;
}

function renderMoyuPage() {
  const moyuText = document.getElementById('moyuText');
  if (moyuPageContent.length === 0) {
    moyuText.textContent = '无内容';
    return;
  }
  const text = moyuPageContent[moyuCurrentPage] || '';
  moyuText.textContent = text;
  document.getElementById('moyuPage').textContent = `${moyuCurrentPage + 1}/${totalPages}`;
}

// ===== 翻页 =====
function nextPage() {
  if (MODE === 'moyu') {
    if (moyuCurrentPage < totalPages - 1) {
      moyuCurrentPage++;
      currentPage = moyuCurrentPage;
      renderMoyuPage();
      updateProgress();
      saveProgressDebounced();
    }
  } else {
    if (currentPage < totalPages - 1) {
      currentPage++;
      renderReaderPage();
      scrollToTop();
    }
  }
}

function prevPage() {
  if (MODE === 'moyu') {
    if (moyuCurrentPage > 0) {
      moyuCurrentPage--;
      currentPage = moyuCurrentPage;
      renderMoyuPage();
      updateProgress();
      saveProgressDebounced();
    }
  } else {
    if (currentPage > 0) {
      currentPage--;
      renderReaderPage();
      scrollToTop();
    }
  }
}

function scrollToTop() {
  const content = document.getElementById('readerContent');
  content.scrollTop = 0;
}

// ===== 章节解析 =====
function parseChapters() {
  chapters = [];
  for (let i = 0; i < bookLines.length; i++) {
    const line = bookLines[i].trim();
    if (CHAPTER_REGEX.test(line) && line.length <= 100) {
      chapters.push({ title: line, lineIndex: i });
    }
  }
}

// 预计算每行在摸鱼模式 fullText 中的字符偏移
function computeMoyuLineOffsets() {
  moyuLineOffsets = [];
  let offset = 0;
  for (let i = 0; i < bookLines.length; i++) {
    moyuLineOffsets[i] = offset;
    const cleaned = bookLines[i].replace(/\s+/g, ' ').trim();
    offset += cleaned.length + 1; // +1 for joining space
  }
}

// 渲染章节列表面板
function renderChapterList() {
  const list = document.getElementById('chapterList');
  if (!list) return;
  if (chapters.length === 0) {
    list.innerHTML = '<div class="chapter-empty">未检测到章节</div>';
    return;
  }
  list.innerHTML = chapters.map((ch, i) =>
    `<div class="chapter-item" data-index="${i}">${escapeHtml(ch.title)}</div>`
  ).join('');

  list.querySelectorAll('.chapter-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      jumpToChapter(idx);
    });
  });
}

// 高亮当前章节
function highlightCurrentChapter() {
  const current = getCurrentChapterIndex();
  document.querySelectorAll('.chapter-item').forEach((item, i) => {
    item.classList.toggle('active', i === current);
  });
}

// 获取当前所在章节索引
function getCurrentChapterIndex() {
  if (chapters.length === 0) return -1;
  let currentLine;
  if (MODE === 'moyu') {
    const charStart = moyuCurrentPage * moyuCharsPerPage;
    currentLine = getMoyuLineForCharOffset(charStart);
  } else {
    currentLine = currentPage * linesPerPage;
  }
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (chapters[i].lineIndex <= currentLine) return i;
  }
  return -1;
}

// 二分查找：字符偏移对应的行索引
function getMoyuLineForCharOffset(charOffset) {
  if (moyuLineOffsets.length === 0) return 0;
  let lo = 0, hi = moyuLineOffsets.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (moyuLineOffsets[mid] <= charOffset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

// 跳转到指定章节
function jumpToChapter(chapterIndex) {
  if (chapterIndex < 0 || chapterIndex >= chapters.length) return;
  const ch = chapters[chapterIndex];

  if (MODE === 'moyu') {
    const charOffset = moyuLineOffsets[ch.lineIndex] || 0;
    moyuCurrentPage = Math.floor(charOffset / moyuCharsPerPage);
    if (moyuCurrentPage >= totalPages) moyuCurrentPage = totalPages - 1;
    if (moyuCurrentPage < 0) moyuCurrentPage = 0;
    currentPage = moyuCurrentPage;
    renderMoyuPage();
    updateProgress();
    saveProgressDebounced();
  } else {
    currentPage = Math.floor(ch.lineIndex / linesPerPage);
    renderReaderPage();
    scrollToTop();
    updateProgress();
    saveProgressDebounced();
  }
  highlightCurrentChapter();
  showToast('跳转到: ' + ch.title);
}

// 上一章
function prevChapter() {
  if (chapters.length === 0) {
    showToast('未检测到章节');
    return;
  }
  const current = getCurrentChapterIndex();
  if (current > 0) {
    jumpToChapter(current - 1);
  } else {
    showToast('已经是第一章');
  }
}

// 下一章
function nextChapter() {
  if (chapters.length === 0) {
    showToast('未检测到章节');
    return;
  }
  const current = getCurrentChapterIndex();
  if (current >= 0 && current < chapters.length - 1) {
    jumpToChapter(current + 1);
  } else {
    showToast('已经是最后一章');
  }
}

// ===== 进度更新 =====
function updateProgress() {
  const progress = totalPages > 0 ? ((currentPage + 1) / totalPages * 100) : 0;
  document.getElementById('progressFill').style.width = progress + '%';
  document.getElementById('progressText').textContent = Math.round(progress) + '%';
}

// ===== 阅读时长 =====
function startReadingTimer() {
  if (readingTimer) clearInterval(readingTimer);
  readingTimer = setInterval(() => {
    readingTimeSeconds++;
    updateReadingTimeDisplay();
    // 每30秒保存一次
    if (readingTimeSeconds % 30 === 0) {
      window.api.saveReadingTime(CATEGORY, BOOKID, 30);
    }
  }, 1000);
}

function updateReadingTimeDisplay(totalTime) {
  const time = totalTime !== undefined ? totalTime : readingTimeSeconds;
  const displayTime = totalTime !== undefined ? totalTime : readingTimeSeconds;
  const hours = Math.floor(displayTime / 3600);
  const mins = Math.floor((displayTime % 3600) / 60);
  const secs = displayTime % 60;
  let timeStr = '';
  if (hours > 0) timeStr = `${hours}小时${mins}分钟`;
  else if (mins > 0) timeStr = `${mins}分${secs}秒`;
  else timeStr = `${secs}秒`;
  document.getElementById('readingTime').textContent = `阅读时长: ${timeStr}`;
}

// ===== 保存进度（防抖） =====
let saveProgressTimer = null;
function saveProgressDebounced() {
  if (saveProgressTimer) clearTimeout(saveProgressTimer);
  saveProgressTimer = setTimeout(() => {
    window.api.saveProgress(CATEGORY, BOOKID, currentPage, 0);
  }, 500);
}

// ===== 书签管理 =====
async function saveBookmark() {
  const page = MODE === 'moyu' ? moyuCurrentPage : currentPage;
  await window.api.saveBookmark(CATEGORY, BOOKID, page, `第${page + 1}页`);
  bookmarks = await window.api.getBookmarks(CATEGORY, BOOKID);
  renderBookmarks();
  showToast('书签已保存');
}

function renderBookmarks() {
  const list = document.getElementById('bookmarkList');
  if (bookmarks.length === 0) {
    list.innerHTML = '<div class="bookmark-empty">暂无书签</div>';
    return;
  }

  list.innerHTML = bookmarks.map((bm, i) => {
    const date = new Date(bm.timestamp);
    const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    return `
      <div class="bookmark-item" data-index="${i}">
        <div class="bookmark-item-info">
          <div class="bookmark-item-label">${escapeHtml(bm.label)}</div>
          <div class="bookmark-item-time">${timeStr}</div>
        </div>
        <button class="bookmark-item-delete" data-index="${i}">✕</button>
      </div>
    `;
  }).join('');

  // 绑定点击跳转
  list.querySelectorAll('.bookmark-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('bookmark-item-delete')) return;
      const idx = parseInt(item.dataset.index);
      const bm = bookmarks[idx];
      if (MODE === 'moyu') {
        moyuCurrentPage = bm.page;
        currentPage = bm.page;
        renderMoyuPage();
        updateProgress();
      } else {
        currentPage = bm.page;
        renderReaderPage();
        scrollToTop();
        updateProgress();
      }
    });
  });

  // 删除书签
  list.querySelectorAll('.bookmark-item-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      await window.api.deleteBookmark(CATEGORY, BOOKID, idx);
      bookmarks = await window.api.getBookmarks(CATEGORY, BOOKID);
      renderBookmarks();
    });
  });
}

// ===== 模式切换 =====
async function switchMode(newMode) {
  const page = MODE === 'moyu' ? moyuCurrentPage : currentPage;
  // 保存当前进度
  await window.api.saveProgress(CATEGORY, BOOKID, page, 0);
  // 保存阅读时长
  if (readingTimeSeconds > 0) {
    await window.api.saveReadingTime(CATEGORY, BOOKID, readingTimeSeconds);
  }
  // 切换模式（当前窗口会被关闭，新窗口会被创建，所以不需要await结果）
  window.api.switchMode(newMode, CATEGORY, BOOKID, page).catch(() => {});
}

// ===== 右键菜单 =====
function showContextMenu(x, y) {
  const menu = document.getElementById('contextMenu');
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('show');
}

function hideContextMenu() {
  document.getElementById('contextMenu').classList.remove('show');
}

// ===== Toast 提示 =====
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      transition: opacity 0.3s;
      pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 2000);
}

// ===== 事件绑定 =====
function bindEvents() {
  // 上一页/下一页按钮
  document.getElementById('prevPageBtn').addEventListener('click', prevPage);
  document.getElementById('nextPageBtn').addEventListener('click', nextPage);

  // 字体大小
  document.getElementById('fontDecreaseBtn').addEventListener('click', () => {
    if (fontSize > 12) {
      fontSize -= 2;
      renderReaderPage();
    }
  });
  document.getElementById('fontIncreaseBtn').addEventListener('click', () => {
    if (fontSize < 36) {
      fontSize += 2;
      renderReaderPage();
    }
  });

  // 书签
  document.getElementById('bookmarkBtn').addEventListener('click', saveBookmark);
  document.getElementById('bookmarkListBtn').addEventListener('click', () => {
    document.getElementById('bookmarkPanel').classList.toggle('show');
  });
  document.getElementById('closeBookmarkPanel').addEventListener('click', () => {
    document.getElementById('bookmarkPanel').classList.remove('show');
  });

  // 章节列表
  document.getElementById('chapterListBtn').addEventListener('click', () => {
    document.getElementById('chapterPanel').classList.toggle('show');
  });
  document.getElementById('closeChapterPanel').addEventListener('click', () => {
    document.getElementById('chapterPanel').classList.remove('show');
  });

  // 主题设置面板
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.toggle('show');
  });
  document.getElementById('closeSettingsPanel').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.remove('show');
  });

  // 预设主题按钮
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const preset = btn.dataset.preset;
      const presetTheme = THEME_PRESETS[preset];
      const theme = {
        ...presetTheme,
        preset,
        fontSize: currentTheme.fontSize || 18,
        followSystem: false
      };
      currentTheme = theme;
      applyTheme(theme);
      await window.api.saveTheme(theme);
    });
  });

  // 跟随系统深色模式
  document.getElementById('followSystemCheck').addEventListener('change', async (e) => {
    const followSystem = e.target.checked;
    const theme = { ...currentTheme, followSystem };
    currentTheme = theme;
    applyTheme(theme);
    await window.api.saveTheme(theme);
  });

  // 背景色 - color input
  document.getElementById('bgColorInput').addEventListener('input', (e) => {
    const color = e.target.value;
    document.getElementById('bgColorText').value = color;
    const theme = { ...currentTheme, preset: 'custom', followSystem: false, bgPrimary: color };
    currentTheme = theme;
    applyTheme(theme);
    saveThemeDebounced(theme);
  });

  // 背景色 - text input
  document.getElementById('bgColorText').addEventListener('change', (e) => {
    let color = e.target.value.trim();
    if (!color.startsWith('#')) color = '#' + color;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      document.getElementById('bgColorInput').value = color;
      const theme = { ...currentTheme, preset: 'custom', followSystem: false, bgPrimary: color };
      currentTheme = theme;
      applyTheme(theme);
      saveThemeDebounced(theme);
    } else {
      e.target.value = currentTheme.bgPrimary;
    }
  });

  // 文字色 - color input
  document.getElementById('textColorInput').addEventListener('input', (e) => {
    const color = e.target.value;
    document.getElementById('textColorText').value = color;
    const theme = { ...currentTheme, preset: 'custom', followSystem: false, textPrimary: color };
    currentTheme = theme;
    applyTheme(theme);
    saveThemeDebounced(theme);
  });

  // 文字色 - text input
  document.getElementById('textColorText').addEventListener('change', (e) => {
    let color = e.target.value.trim();
    if (!color.startsWith('#')) color = '#' + color;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      document.getElementById('textColorInput').value = color;
      const theme = { ...currentTheme, preset: 'custom', followSystem: false, textPrimary: color };
      currentTheme = theme;
      applyTheme(theme);
      saveThemeDebounced(theme);
    } else {
      e.target.value = currentTheme.textPrimary;
    }
  });

  // 屏幕取色按钮
  document.querySelectorAll('.screen-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      startScreenPick(btn.dataset.target);
    });
  });

  // 字体大小滑块
  document.getElementById('fontSizeSlider').addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    document.getElementById('fontSizeValue').textContent = size;
    const theme = { ...currentTheme, fontSize: size };
    currentTheme = theme;
    applyTheme(theme);
    saveThemeDebounced(theme);
  });

  // 主题更新事件（其他窗口修改主题时同步）
  window.api.onThemeUpdated((theme) => {
    currentTheme = theme;
    applyTheme(theme);
  });

  // 系统原生主题变化
  window.api.onNativeThemeChanged((isDark) => {
    if (currentTheme && currentTheme.followSystem) {
      const preset = isDark ? 'dark' : 'light';
      const presetTheme = THEME_PRESETS[preset];
      const theme = {
        ...presetTheme,
        preset,
        fontSize: currentTheme.fontSize,
        followSystem: true
      };
      currentTheme = theme;
      applyTheme(theme);
    }
  });

  // 模式切换按钮
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchMode(btn.dataset.mode);
    });
  });

  // 返回按钮（关闭窗口）
  document.getElementById('backBtn').addEventListener('click', async () => {
    // 保存进度和时长
    const page = MODE === 'moyu' ? moyuCurrentPage : currentPage;
    await window.api.saveProgress(CATEGORY, BOOKID, page, 0);
    if (readingTimeSeconds > 0) {
      await window.api.saveReadingTime(CATEGORY, BOOKID, readingTimeSeconds);
    }
    window.api.closeReader().catch(() => {});
  });

  // 右键菜单
  if (MODE === 'moyu') {
    // 摸鱼模式：使用原生右键菜单（HTML菜单会被窄窗口裁剪）
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.api.showMoyuMenu((action) => {
        handleContextAction(action);
      });
    });
  } else {
    // 窗口/全屏模式：使用 HTML 右键菜单
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });

    // 右键菜单项点击
    document.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        handleContextAction(action);
        hideContextMenu();
      });
    });

    // 点击其他地方关闭右键菜单
    document.addEventListener('click', () => {
      hideContextMenu();
    });
  }

  // 键盘快捷键
  document.addEventListener('keydown', handleKeyDown);

  // 摸鱼模式：拖动
  if (MODE === 'moyu') {
    setupMoyuDrag();
  }

  // 窗口关闭前保存
  window.addEventListener('beforeunload', () => {
    const page = MODE === 'moyu' ? moyuCurrentPage : currentPage;
    // 同步发送保存请求
    window.api.saveProgress(CATEGORY, BOOKID, page, 0);
    if (readingTimeSeconds > 0) {
      window.api.saveReadingTime(CATEGORY, BOOKID, readingTimeSeconds);
    }
  });
}

// ===== 键盘事件 =====
function handleKeyDown(e) {
  if (e.ctrlKey && e.key === '`') {
    e.preventDefault();
    if (MODE === 'moyu') {
      window.api.hideMoyu();
    }
    return;
  }

  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    saveBookmark();
    return;
  }

  switch (e.key) {
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      prevPage();
      break;
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
      e.preventDefault();
      nextPage();
      break;
    case 'Escape':
      if (MODE === 'fullscreen') {
        switchMode('window');
      }
      break;
    case '[':
      e.preventDefault();
      prevChapter();
      break;
    case ']':
      e.preventDefault();
      nextChapter();
      break;
    case 'h':
    case 'H':
      if (MODE === 'moyu') {
        e.preventDefault();
        window.api.hideMoyu();
      }
      break;
  }
}

// ===== 右键菜单动作 =====
function handleContextAction(action) {
  switch (action) {
    case 'bookmark':
      saveBookmark();
      break;
    case 'bookmarkList':
      if (MODE === 'moyu') {
        // 摸鱼窗口太窄无法显示书签面板，切换到窗口模式查看
        switchMode('window');
      } else {
        document.getElementById('bookmarkPanel').classList.toggle('show');
      }
      break;
    case 'mode-window':
      switchMode('window');
      break;
    case 'mode-fullscreen':
      switchMode('fullscreen');
      break;
    case 'mode-moyu':
      switchMode('moyu');
      break;
    case 'prev':
      prevPage();
      break;
    case 'next':
      nextPage();
      break;
    case 'prevChapter':
      prevChapter();
      break;
    case 'nextChapter':
      nextChapter();
      break;
    case 'chapterList':
      if (MODE === 'moyu') {
        switchMode('window');
      } else {
        document.getElementById('chapterPanel').classList.toggle('show');
      }
      break;
    case 'hide':
      window.api.hideMoyu();
      break;
  }
}

// ===== 摸鱼模式拖动 =====
function setupMoyuDrag() {
  const container = document.getElementById('moyuContainer');
  let isDragging = false;
  let startX = 0, startY = 0;

  container.addEventListener('mousedown', (e) => {
    // 右键不启动拖动
    if (e.button === 2) return;
    isDragging = true;
    startX = e.screenX;
    startY = e.screenY;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.screenX - startX;
    const dy = e.screenY - startY;
    if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
      window.api.moyuDrag(dx, dy);
      startX = e.screenX;
      startY = e.screenY;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

// ===== 工具函数 =====
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== 主题管理 =====
function applyTheme(theme) {
  currentTheme = theme;
  const root = document.documentElement;

  root.style.setProperty('--bg-primary', theme.bgPrimary);
  root.style.setProperty('--bg-secondary', theme.bgSecondary);
  root.style.setProperty('--bg-tertiary', theme.bgTertiary);
  root.style.setProperty('--text-primary', theme.textPrimary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--text-muted', theme.textMuted);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--border', theme.border);
  root.style.setProperty('--bg-moyu', hexToRgba(theme.bgPrimary, 0.92));

  fontSize = theme.fontSize || 18;

  updateSettingsPanel(theme);

  if (bookLines.length > 0) {
    renderPage();
  }
}

function updateSettingsPanel(theme) {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === theme.preset);
  });
  document.getElementById('followSystemCheck').checked = theme.followSystem || false;
  document.getElementById('bgColorInput').value = theme.bgPrimary;
  document.getElementById('bgColorText').value = theme.bgPrimary;
  document.getElementById('textColorInput').value = theme.textPrimary;
  document.getElementById('textColorText').value = theme.textPrimary;
  document.getElementById('fontSizeSlider').value = theme.fontSize || 18;
  document.getElementById('fontSizeValue').textContent = theme.fontSize || 18;
}

function saveThemeDebounced(theme) {
  if (saveThemeTimer) clearTimeout(saveThemeTimer);
  saveThemeTimer = setTimeout(async () => {
    await window.api.saveTheme(currentTheme);
  }, 300);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ===== 屏幕取色器 =====
async function startScreenPick(target) {
  const btn = document.querySelector(`.screen-pick-btn[data-target="${target}"]`);
  if (btn) btn.classList.add('picking');

  const dataUrl = await window.api.captureScreen();

  if (btn) btn.classList.remove('picking');

  if (!dataUrl) {
    showToast('无法捕获屏幕');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'screen-pick-overlay';
  overlay.style.backgroundImage = `url(${dataUrl})`;

  const img = new Image();
  img.src = dataUrl;

  const magnifier = document.createElement('canvas');
  magnifier.className = 'screen-pick-magnifier';
  magnifier.width = 100;
  magnifier.height = 100;
  const magCtx = magnifier.getContext('2d');

  const info = document.createElement('div');
  info.className = 'screen-pick-info';

  const hint = document.createElement('div');
  hint.className = 'screen-pick-hint';
  hint.textContent = '左键点击取色，右键取消';

  overlay.appendChild(magnifier);
  overlay.appendChild(info);
  overlay.appendChild(hint);
  document.body.appendChild(overlay);

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    overlay._canvas = canvas;
    overlay._imgW = img.naturalWidth;
    overlay._imgH = img.naturalHeight;
  };

  overlay.addEventListener('mousemove', (e) => {
    magnifier.style.left = (e.clientX + 20) + 'px';
    magnifier.style.top = (e.clientY + 20) + 'px';
    info.style.left = (e.clientX + 20) + 'px';
    info.style.top = (e.clientY + 130) + 'px';

    if (overlay._canvas) {
      const color = sampleColor(overlay._canvas, e.clientX, e.clientY, overlay._imgW, overlay._imgH);
      if (color) {
        const scaleX = overlay._imgW / window.innerWidth;
        const scaleY = overlay._imgH / window.innerHeight;
        const sx = Math.floor(e.clientX * scaleX);
        const sy = Math.floor(e.clientY * scaleY);

        magCtx.clearRect(0, 0, 100, 100);
        magCtx.drawImage(overlay._canvas, sx - 10, sy - 10, 20, 20, 0, 0, 100, 100);
        magCtx.strokeStyle = '#fff';
        magCtx.lineWidth = 1;
        magCtx.beginPath();
        magCtx.moveTo(50, 0); magCtx.lineTo(50, 100);
        magCtx.moveTo(0, 50); magCtx.lineTo(100, 50);
        magCtx.stroke();

        info.textContent = color;
        info.style.background = color;
      }
    }
  });

  overlay.addEventListener('click', (e) => {
    if (overlay._canvas) {
      const color = sampleColor(overlay._canvas, e.clientX, e.clientY, overlay._imgW, overlay._imgH);
      if (color) {
        applyPickedColor(target, color);
      }
    }
    document.body.removeChild(overlay);
  });

  overlay.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    document.body.removeChild(overlay);
  });
}

function sampleColor(canvas, clientX, clientY, imgW, imgH) {
  const scaleX = imgW / window.innerWidth;
  const scaleY = imgH / window.innerHeight;
  const x = Math.floor(clientX * scaleX);
  const y = Math.floor(clientY * scaleY);
  if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return null;
  const ctx = canvas.getContext('2d');
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  return rgbToHex(pixel[0], pixel[1], pixel[2]);
}

function applyPickedColor(target, color) {
  if (target === 'bg') {
    document.getElementById('bgColorInput').value = color;
    document.getElementById('bgColorText').value = color;
    const theme = { ...currentTheme, preset: 'custom', followSystem: false, bgPrimary: color };
    currentTheme = theme;
    applyTheme(theme);
    saveThemeDebounced(theme);
  } else if (target === 'text') {
    document.getElementById('textColorInput').value = color;
    document.getElementById('textColorText').value = color;
    const theme = { ...currentTheme, preset: 'custom', followSystem: false, textPrimary: color };
    currentTheme = theme;
    applyTheme(theme);
    saveThemeDebounced(theme);
  }
  showToast('已取色: ' + color);
}

// ===== 启动 =====
init();
