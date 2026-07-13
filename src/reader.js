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
// 摸鱼模式拼接全文（预计算，避免重复拼接）
let moyuFullText = '';

// 章节列表
let chapters = [];          // [{ title, lineIndex }]
let moyuLineOffsets = [];   // moyuLineOffsets[i] = bookLines[i] 在 moyuFullText 中的字符偏移

// 章节匹配正则（参考 doosho README 正则规则）
// 匹配：第N章/节/回/卷/部/篇（中文数字或阿拉伯数字）
// 匹配：卷N（无"第"前缀，如聊斋志异的"卷一""卷二"）
// 匹配：Chapter N（英文）
const CHAPTER_REGEX = /^第[\d一二三四五六七八九十百千万零两壹贰叁肆伍陆柒捌玖拾佰仟]+[章节回卷部篇]\s*.*|^卷[\d一二三四五六七八九十百千万零两壹贰叁肆伍陆柒捌玖拾佰仟]+\s*.*|^Chapter\s+[\dIVXLCDMivxlcdm]+.*/i;

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

  // 预计算摸鱼模式拼接全文和行偏移
  computeMoyuFullText();

  // 解析章节
  parseChapters();
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

  // 加载进度（统一使用行索引作为位置参照）
  let savedLineIndex = 0;
  const progress = await window.api.getProgress(CATEGORY, BOOKID);
  if (progress && progress.page !== undefined) {
    savedLineIndex = progress.page;
  } else {
    savedLineIndex = START_PAGE;
  }

  // 加载书签
  bookmarks = await window.api.getBookmarks(CATEGORY, BOOKID);
  renderBookmarks();

  // 加载阅读时长
  const savedTime = await window.api.getReadingTime(CATEGORY, BOOKID);
  readingTimeSeconds = 0;
  updateReadingTimeDisplay(savedTime || 0);

  // 加载主题
  currentTheme = await window.api.getTheme();
  applyTheme(currentTheme);

  // 计算分页（摸鱼模式需要延迟等布局完成）
  if (MODE === 'moyu') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        calculatePages();
        goToLineIndex(savedLineIndex);
        startReadingTimer();
        bindEvents();
      });
    });
  } else {
    calculatePages();
    goToLineIndex(savedLineIndex);
    startReadingTimer();
    bindEvents();
  }
}

// ===== 通用位置参照（行索引）=====
// 所有模式共用行索引作为位置参照，确保模式切换时位置一致

function getCurrentLineIndex() {
  if (MODE === 'moyu') {
    const charStart = moyuCurrentPage * moyuCharsPerPage;
    return getMoyuLineForCharOffset(charStart);
  } else {
    return currentPage * linesPerPage;
  }
}

function goToLineIndex(lineIndex, targetChapterIdx) {
  if (lineIndex < 0) lineIndex = 0;
  if (lineIndex >= bookLines.length) lineIndex = bookLines.length - 1;

  if (MODE === 'moyu') {
    const charOffset = moyuLineOffsets[lineIndex] || 0;
    moyuCurrentPage = Math.floor(charOffset / moyuCharsPerPage);
    if (moyuCurrentPage >= totalPages) moyuCurrentPage = totalPages - 1;
    if (moyuCurrentPage < 0) moyuCurrentPage = 0;
    currentPage = moyuCurrentPage;
    renderMoyuPage();
  } else {
    currentPage = Math.floor(lineIndex / linesPerPage);
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;
    renderReaderPage();
    scrollToTop();
  }
  updateProgress();
  highlightCurrentChapter(targetChapterIdx);
}

// ===== 预计算摸鱼全文 =====
function computeMoyuFullText() {
  const cleanedLines = bookLines.map(line => line.replace(/\s+/g, ' ').trim());
  moyuFullText = cleanedLines.join(' ');

  moyuLineOffsets = [];
  let offset = 0;
  for (let i = 0; i < bookLines.length; i++) {
    moyuLineOffsets[i] = offset;
    offset += cleanedLines[i].length + 1;
  }
}

// ===== 分页计算 =====
function calculateMoyuCharsPerPage() {
  const moyuText = document.getElementById('moyuText');
  if (!moyuText) return 40;

  const containerWidth = moyuText.clientWidth;
  if (containerWidth <= 0) {
    const fallback = window.innerWidth - 80;
    if (fallback > 20) {
      return Math.max(10, Math.floor(fallback / 14));
    }
    return 40;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const style = getComputedStyle(moyuText);
  const fs = style.fontSize || '13px';
  const ff = style.fontFamily || '"Microsoft YaHei", sans-serif';
  ctx.font = `${fs} ${ff}`;

  let width = 0;
  let count = 0;
  const maxWidth = containerWidth - 12;

  while (count < moyuFullText.length && width < maxWidth) {
    width += ctx.measureText(moyuFullText[count]).width;
    if (width < maxWidth) count++;
  }

  return Math.max(10, count);
}

function calculatePages() {
  if (MODE === 'moyu') {
    moyuCharsPerPage = calculateMoyuCharsPerPage();
    moyuPageContent = [];
    for (let i = 0; i < moyuFullText.length; i += moyuCharsPerPage) {
      moyuPageContent.push(moyuFullText.substring(i, i + moyuCharsPerPage));
    }
    totalPages = moyuPageContent.length;
    if (totalPages === 0) totalPages = 1;
    if (moyuCurrentPage >= totalPages) moyuCurrentPage = totalPages - 1;
    if (moyuCurrentPage < 0) moyuCurrentPage = 0;
    currentPage = moyuCurrentPage;
  } else {
    totalPages = Math.ceil(bookLines.length / linesPerPage);
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
      highlightCurrentChapter();
      saveProgressDebounced();
    }
  } else {
    if (currentPage < totalPages - 1) {
      currentPage++;
      renderReaderPage();
      scrollToTop();
      updateProgress();
      highlightCurrentChapter();
      saveProgressDebounced();
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
      highlightCurrentChapter();
      saveProgressDebounced();
    }
  } else {
    if (currentPage > 0) {
      currentPage--;
      renderReaderPage();
      scrollToTop();
      updateProgress();
      highlightCurrentChapter();
      saveProgressDebounced();
    }
  }
}

function scrollToTop() {
  const content = document.getElementById('readerContent');
  content.scrollTop = 0;
}

// ===== 章节解析 =====

// 查找正文起始行：每本书在目录和正文之间都有一块 doosho.com 水印分隔符
// 找到最后一个包含 doosho.com 的行，正文从此行之后开始
function findMainTextStart() {
  let lastDooshoLine = -1;
  for (let i = 0; i < bookLines.length; i++) {
    if (bookLines[i].includes('doosho.com')) {
      lastDooshoLine = i;
    }
  }
  return lastDooshoLine >= 0 ? lastDooshoLine + 1 : 0;
}

function parseChapters() {
  const mainTextStart = findMainTextStart();

  // 无分隔符时，退回到正则匹配
  if (mainTextStart === 0) {
    const allMatches = [];
    for (let i = 0; i < bookLines.length; i++) {
      const line = bookLines[i].trim();
      if (CHAPTER_REGEX.test(line) && line.length <= 100) {
        allMatches.push({ title: line, lineIndex: i });
      }
    }
    chapters = allMatches;
    return;
  }

  // 第一步：从目录区（分隔符之前）提取章节名
  // 跳过第 0 行（书名），收集所有非空、非 doosho.com 行作为目录条目
  const tocEntries = [];
  const seen = new Set();
  for (let i = 1; i < mainTextStart; i++) {
    const title = bookLines[i].trim();
    if (title && !title.includes('doosho.com') && !seen.has(title)) {
      seen.add(title);
      tocEntries.push(title);
    }
  }

  // 第二步：建立正文中 "行内容 -> 首次出现行索引" 的映射
  const mainTextMap = new Map();
  for (let i = mainTextStart; i < bookLines.length; i++) {
    const trimmed = bookLines[i].trim();
    if (!mainTextMap.has(trimmed)) {
      mainTextMap.set(trimmed, i);
    }
  }

  // 第三步：用目录条目在正文中精确匹配定位
  chapters = [];
  for (const title of tocEntries) {
    const lineIndex = mainTextMap.get(title);
    if (lineIndex !== undefined) {
      chapters.push({ title, lineIndex });
    }
  }

  // 按行索引排序，确保章节按阅读顺序排列
  chapters.sort((a, b) => a.lineIndex - b.lineIndex);
}

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

function highlightCurrentChapter(chapterIdx) {
  const current = (chapterIdx !== undefined) ? chapterIdx : getCurrentChapterIndex();
  document.querySelectorAll('.chapter-item').forEach((item, i) => {
    item.classList.toggle('active', i === current);
  });
}

function getCurrentChapterIndex() {
  if (chapters.length === 0) return -1;
  const currentLine = getCurrentLineIndex();
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (chapters[i].lineIndex <= currentLine) return i;
  }
  return -1;
}

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

function jumpToChapter(chapterIndex) {
  if (chapterIndex < 0 || chapterIndex >= chapters.length) return;
  const ch = chapters[chapterIndex];
  goToLineIndex(ch.lineIndex, chapterIndex);
  showToast('跳转到: ' + ch.title);
}

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
  const fillEl = document.getElementById('progressFill');
  const textEl = document.getElementById('progressText');
  if (fillEl) fillEl.style.width = progress + '%';
  if (textEl) textEl.textContent = Math.round(progress) + '%';
}

// ===== 阅读时长 =====
function startReadingTimer() {
  if (readingTimer) clearInterval(readingTimer);
  readingTimer = setInterval(() => {
    readingTimeSeconds++;
    updateReadingTimeDisplay();
    if (readingTimeSeconds % 30 === 0) {
      window.api.saveReadingTime(CATEGORY, BOOKID, 30);
    }
  }, 1000);
}

function updateReadingTimeDisplay(totalTime) {
  const displayTime = totalTime !== undefined ? totalTime : readingTimeSeconds;
  const hours = Math.floor(displayTime / 3600);
  const mins = Math.floor((displayTime % 3600) / 60);
  const secs = displayTime % 60;
  let timeStr = '';
  if (hours > 0) timeStr = `${hours}小时${mins}分钟`;
  else if (mins > 0) timeStr = `${mins}分${secs}秒`;
  else timeStr = `${secs}秒`;
  const el = document.getElementById('readingTime');
  if (el) el.textContent = `阅读时长: ${timeStr}`;
}

// ===== 保存进度（防抖）=====
// 统一保存行索引，确保所有模式间位置一致
let saveProgressTimer = null;
function saveProgressDebounced() {
  if (saveProgressTimer) clearTimeout(saveProgressTimer);
  saveProgressTimer = setTimeout(() => {
    const lineIndex = getCurrentLineIndex();
    window.api.saveProgress(CATEGORY, BOOKID, lineIndex, 0);
  }, 500);
}

// ===== 书签管理 =====
async function saveBookmark() {
  const lineIndex = getCurrentLineIndex();
  let label = `第${lineIndex + 1}行`;
  const chIdx = getCurrentChapterIndex();
  if (chIdx >= 0) {
    label = chapters[chIdx].title;
  }
  await window.api.saveBookmark(CATEGORY, BOOKID, lineIndex, label);
  bookmarks = await window.api.getBookmarks(CATEGORY, BOOKID);
  renderBookmarks();
  showToast('书签已保存: ' + label);
}

function renderBookmarks() {
  const list = document.getElementById('bookmarkList');
  if (!list) return;
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

  list.querySelectorAll('.bookmark-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('bookmark-item-delete')) return;
      const idx = parseInt(item.dataset.index);
      const bm = bookmarks[idx];
      goToLineIndex(bm.page);
      showToast('跳转到书签: ' + bm.label);
    });
  });

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
// 切换时传递行索引而非页码，确保位置一致
async function switchMode(newMode) {
  const lineIndex = getCurrentLineIndex();
  await window.api.saveProgress(CATEGORY, BOOKID, lineIndex, 0);
  if (readingTimeSeconds > 0) {
    await window.api.saveReadingTime(CATEGORY, BOOKID, readingTimeSeconds);
  }
  window.api.switchMode(newMode, CATEGORY, BOOKID, lineIndex).catch(() => {});
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
      max-width: 80%;
      text-align: center;
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
  document.getElementById('prevPageBtn').addEventListener('click', prevPage);
  document.getElementById('nextPageBtn').addEventListener('click', nextPage);

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

  document.getElementById('bookmarkBtn').addEventListener('click', saveBookmark);
  document.getElementById('bookmarkListBtn').addEventListener('click', () => {
    document.getElementById('bookmarkPanel').classList.toggle('show');
  });
  document.getElementById('closeBookmarkPanel').addEventListener('click', () => {
    document.getElementById('bookmarkPanel').classList.remove('show');
  });

  document.getElementById('chapterListBtn').addEventListener('click', () => {
    document.getElementById('chapterPanel').classList.toggle('show');
  });
  document.getElementById('closeChapterPanel').addEventListener('click', () => {
    document.getElementById('chapterPanel').classList.remove('show');
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.toggle('show');
  });
  document.getElementById('closeSettingsPanel').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.remove('show');
  });

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

  document.getElementById('followSystemCheck').addEventListener('change', async (e) => {
    const followSystem = e.target.checked;
    const theme = { ...currentTheme, followSystem };
    currentTheme = theme;
    applyTheme(theme);
    await window.api.saveTheme(theme);
  });

  document.getElementById('bgColorInput').addEventListener('input', (e) => {
    const color = e.target.value;
    document.getElementById('bgColorText').value = color;
    const theme = { ...currentTheme, preset: 'custom', followSystem: false, bgPrimary: color };
    currentTheme = theme;
    applyTheme(theme);
    saveThemeDebounced(theme);
  });

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

  document.getElementById('textColorInput').addEventListener('input', (e) => {
    const color = e.target.value;
    document.getElementById('textColorText').value = color;
    const theme = { ...currentTheme, preset: 'custom', followSystem: false, textPrimary: color };
    currentTheme = theme;
    applyTheme(theme);
    saveThemeDebounced(theme);
  });

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

  document.querySelectorAll('.screen-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      startScreenPick(btn.dataset.target);
    });
  });

  document.getElementById('fontSizeSlider').addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    document.getElementById('fontSizeValue').textContent = size;
    const theme = { ...currentTheme, fontSize: size };
    currentTheme = theme;
    applyTheme(theme);
    saveThemeDebounced(theme);
  });

  window.api.onThemeUpdated((theme) => {
    currentTheme = theme;
    applyTheme(theme);
  });

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

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchMode(btn.dataset.mode);
    });
  });

  document.getElementById('backBtn').addEventListener('click', async () => {
    const lineIndex = getCurrentLineIndex();
    await window.api.saveProgress(CATEGORY, BOOKID, lineIndex, 0);
    if (readingTimeSeconds > 0) {
      await window.api.saveReadingTime(CATEGORY, BOOKID, readingTimeSeconds);
    }
    window.api.closeReader().catch(() => {});
  });

  if (MODE === 'moyu') {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const menuData = {
        bookmarks: bookmarks.map(bm => ({ label: bm.label, page: bm.page })),
        chapters: chapters.map(ch => ({ title: ch.title, lineIndex: ch.lineIndex }))
      };
      window.api.showMoyuMenu(menuData, (action) => {
        handleContextAction(action);
      });
    });
  } else {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });

    document.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        handleContextAction(action);
        hideContextMenu();
      });
    });

    document.addEventListener('click', () => {
      hideContextMenu();
    });
  }

  document.addEventListener('keydown', handleKeyDown);

  if (MODE === 'moyu') {
    setupMoyuDrag();
  }

  // 摸鱼模式：窗口大小变化时重新计算分页
  if (MODE === 'moyu') {
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const savedLine = getCurrentLineIndex();
        calculatePages();
        goToLineIndex(savedLine);
      }, 200);
    });
  }

  window.addEventListener('beforeunload', () => {
    const lineIndex = getCurrentLineIndex();
    window.api.saveProgress(CATEGORY, BOOKID, lineIndex, 0);
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
  // 处理原生子菜单的书签跳转
  if (action.startsWith('bm_jump:')) {
    const idx = parseInt(action.split(':')[1]);
    if (bookmarks[idx]) {
      goToLineIndex(bookmarks[idx].page);
      showToast('跳转到书签: ' + bookmarks[idx].label);
    }
    return;
  }
  // 处理原生子菜单的章节跳转
  if (action.startsWith('ch_jump:')) {
    const idx = parseInt(action.split(':')[1]);
    if (chapters[idx]) {
      jumpToChapter(idx);
    }
    return;
  }

  switch (action) {
    case 'bookmark':
      saveBookmark();
      break;
    case 'bookmarkList':
      // 仅窗口/全屏模式会触发（摸鱼模式用原生子菜单）
      document.getElementById('bookmarkPanel').classList.toggle('show');
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
      // 仅窗口/全屏模式会触发（摸鱼模式用原生子菜单）
      document.getElementById('chapterPanel').classList.toggle('show');
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

  // 主题变化后，摸鱼模式需要重新计算分页
  if (MODE === 'moyu' && bookLines.length > 0 && moyuFullText) {
    const savedLine = getCurrentLineIndex();
    calculatePages();
    goToLineIndex(savedLine);
  } else if (bookLines.length > 0) {
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
