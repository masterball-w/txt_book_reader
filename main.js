const { app, BrowserWindow, ipcMain, globalShortcut, Menu, shell, screen, nativeTheme, desktopCapturer, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const formats = require('./lib/formats');
const { createImportedStore, LOCAL_CATEGORY } = require('./lib/importedStore');
const { buildLocalBookFilePath } = require('./lib/formats/imageMap');
const { isImageLine } = require('./lib/formats/htmlToText');

// 必须在 app ready 前注册协议 scheme（privileged）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-book',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
]);

// GPU cache 修复
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

function getAppIconPath() {
  const ico = path.join(__dirname, 'build', 'icon.ico');
  if (fs.existsSync(ico)) return ico;
  const png = path.join(__dirname, 'build', 'icon.png');
  if (fs.existsSync(png)) return png;
  return undefined;
}

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 书库根目录
// 打包模式：书籍在 resources/shu 目录下
// 开发模式：书籍在项目上级目录（shu 子模块）
const BOOKS_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'shu')
  : path.join(__dirname, 'shu');
// 用户数据目录（延迟初始化）
let USER_DATA_DIR = null;
let DATA_FILE = null;

function getUserDataDir() {
  if (!USER_DATA_DIR) {
    USER_DATA_DIR = path.join(app.getPath('userData'));
    DATA_FILE = path.join(USER_DATA_DIR, 'reader-data.json');
  }
  return USER_DATA_DIR;
}

function getDataFile() {
  getUserDataDir();
  return DATA_FILE;
}

const importedStore = createImportedStore(getUserDataDir);

/** 统一 bookid：纯数字保留 number，否则保留字符串（导入书 UUID） */
function normalizeBookId(bookid) {
  if (typeof bookid === 'number' && Number.isFinite(bookid)) return bookid;
  const s = String(bookid);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return s;
}

function sameBookId(a, b) {
  return String(a) === String(b);
}

// 窗口引用
let mainWindow = null;
let readerWindow = null;
let moyuWindow = null;

// 当前阅读状态（用于模式切换时传递）
let currentReadState = {
  category: 'cn',
  bookid: 1,
  page: 0,
  mode: 'window'
};

// ============================================================
// 数据存储管理
// ============================================================
function loadData() {
  try {
    const file = getDataFile();
    if (file && fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('加载数据失败:', e);
  }
  return {
    bookshelf: [],
    bookmarks: {},
    progress: {},
    readingTime: {},
    theme: null
  };
}

function saveData(data) {
  try {
    const dir = getUserDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(getDataFile(), JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存数据失败:', e);
  }
}

// ============================================================
// 书籍元数据加载
// ============================================================
function loadBuiltinBooks() {
  const categories = ['cn', 'en', 'yi'];
  const allBooks = [];

  for (const cat of categories) {
    const jsonPath = path.join(BOOKS_ROOT, cat, 'books.json');
    if (!fs.existsSync(jsonPath)) continue;

    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const books = JSON.parse(raw);
      for (const book of books) {
        const { title, author } = parseTitleAuthor(book.title || '');
        allBooks.push({
          category: cat,
          bookid: parseInt(book.bookid, 10),
          title: title,
          author: author,
          description: book.description || '',
          rawTitle: book.title || '',
          format: 'txt',
          source: 'builtin'
        });
      }
    } catch (e) {
      console.error(`加载 ${cat}/books.json 失败:`, e);
    }
  }

  return allBooks;
}

function loadAllBooks() {
  return [...loadBuiltinBooks(), ...importedStore.listImportedAsBooks()];
}

function resolveBookPath(category, bookid) {
  if (category === LOCAL_CATEGORY) {
    return importedStore.resolveImportedPath(bookid);
  }
  const filePath = path.join(BOOKS_ROOT, category, `${bookid}.txt`);
  return fs.existsSync(filePath) ? filePath : null;
}

// 解析标题和作者
function parseTitleAuthor(rawTitle) {
  // 优先按 " - " 分割（cn 目录常见格式）
  if (rawTitle.includes(' - ')) {
    const parts = rawTitle.split(' - ');
    return {
      title: parts[0].trim(),
      author: parts.slice(1).join(' - ').trim()
    };
  }

  // 尝试按 "-" 分割（yi 目录常见格式），但需判断后半部分是否像作者名
  // 如果最后一部分以"译"结尾或较短，认为是作者
  const dashIndex = rawTitle.lastIndexOf('-');
  if (dashIndex > 0) {
    const possibleTitle = rawTitle.substring(0, dashIndex).trim();
    const possibleAuthor = rawTitle.substring(dashIndex + 1).trim();
    // 作者名通常较短且包含人名特征
    if (possibleAuthor.length > 0 && possibleAuthor.length < 30 &&
        (/[\u4e00-\u9fa5]/.test(possibleAuthor)) &&
        (possibleAuthor.endsWith('译') || /[\u4e00-\u9fa5]{2,8}/.test(possibleAuthor))) {
      // 但标题本身不能太短（避免误判）
      if (possibleTitle.length >= 2) {
        return { title: possibleTitle, author: possibleAuthor };
      }
    }
  }

  return { title: rawTitle.trim(), author: '' };
}

// 读取书籍内容（同步，仅内置 TXT；导入书请用异步版）
function readBookContent(category, bookid) {
  if (category === LOCAL_CATEGORY) return null;
  const filePath = resolveBookPath(category, bookid);
  if (!filePath) return null;
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error('读取书籍失败:', e);
    return null;
  }
}

async function readBookContentAsync(category, bookid) {
  const filePath = resolveBookPath(category, bookid);
  if (!filePath) return null;

  try {
    if (category === LOCAL_CATEGORY) {
      const entry = importedStore.findImportedBook(bookid);
      const ext = (entry && entry.format) || path.extname(filePath).replace('.', '');
      const options = {};
      if (ext === 'epub' || ext === 'mobi') {
        options.bookid = String(bookid);
        options.assetDir = importedStore.ensureAssetDir(bookid);
      }
      const result = await formats.extractText(filePath, ext, options);
      return result.text || null;
    }
    // 内置书库仍为 UTF-8 TXT
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error('读取书籍失败:', e);
    return null;
  }
}

function cleanupBookUserData(key) {
  const data = loadData();
  if (data.bookmarks && data.bookmarks[key]) delete data.bookmarks[key];
  if (data.progress && data.progress[key]) delete data.progress[key];
  if (data.readingTime && data.readingTime[key]) delete data.readingTime[key];
  if (Array.isArray(data.bookshelf)) {
    data.bookshelf = data.bookshelf.filter(
      b => `${b.category}_${b.bookid}` !== key
    );
  }
  saveData(data);
}

// ============================================================
// 窗口创建
// ============================================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '书库阅读器',
    icon: getAppIconPath(),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', () => {
    mainWindow = null;
  });
}

function createReaderWindow(mode, state) {
  // 如果已有阅读窗口，先关闭
  if (readerWindow) {
    readerWindow.close();
    readerWindow = null;
  }

  currentReadState = { ...state, mode };

  if (mode === 'moyu') {
    // 墨域模式 - 无边框长条
    createMoyuWindow(state);
    return;
  }

  const isFullscreen = mode === 'fullscreen';

  readerWindow = new BrowserWindow({
    width: isFullscreen ? 1920 : 1000,
    height: isFullscreen ? 1080 : 750,
    minWidth: 600,
    minHeight: 400,
    fullscreen: isFullscreen,
    frame: true,
    title: '阅读',
    icon: getAppIconPath(),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 传递阅读状态
  readerWindow.loadFile(path.join(__dirname, 'src', 'reader.html'), {
    query: {
      mode: mode,
      category: state.category,
      bookid: String(state.bookid),
      page: String(state.page || 0)
    }
  });

  if (process.argv.includes('--dev')) {
    readerWindow.webContents.openDevTools();
  }

  readerWindow.on('close', () => {
    readerWindow = null;
  });
}

function createMoyuWindow(state) {
  if (moyuWindow) {
    moyuWindow.close();
    moyuWindow = null;
  }

  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const moyuWidth = 680;
  const moyuHeight = 44;

  moyuWindow = new BrowserWindow({
    width: moyuWidth,
    height: moyuHeight,
    x: Math.round((width - moyuWidth) / 2),
    y: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  moyuWindow.loadFile(path.join(__dirname, 'src', 'reader.html'), {
    query: {
      mode: 'moyu',
      category: state.category,
      bookid: String(state.bookid),
      page: String(state.page || 0)
    }
  });

  moyuWindow.on('close', () => {
    moyuWindow = null;
  });
}

// ============================================================
// IPC 处理
// ============================================================

// 获取所有书籍
ipcMain.handle('get-books', () => {
  return loadAllBooks();
});

// 读取书籍内容
ipcMain.handle('read-book', async (event, { category, bookid }) => {
  return readBookContentAsync(category, normalizeBookId(bookid));
});

// 搜索书籍
ipcMain.handle('search-books', (event, { type, keyword }) => {
  const allBooks = loadAllBooks();
  const results = [];

  if (!keyword || keyword.trim() === '') {
    return [];
  }

  const kw = keyword.trim().toLowerCase();

  for (const book of allBooks) {
    if (type === 'title') {
      // 书名精确搜索
      if (book.title.toLowerCase() === kw) {
        results.push({ ...book, matchType: 'title-exact' });
      }
    } else if (type === 'fuzzy') {
      // 书名模糊搜索
      if (book.title.toLowerCase().includes(kw)) {
        results.push({ ...book, matchType: 'fuzzy' });
      }
    } else if (type === 'author') {
      // 作者搜索
      if (book.author && book.author.toLowerCase().includes(kw)) {
        results.push({ ...book, matchType: 'author' });
      }
    } else if (type === 'all') {
      // 综合搜索
      if (book.title.toLowerCase().includes(kw) ||
        (book.author && book.author.toLowerCase().includes(kw))) {
        results.push({ ...book, matchType: 'all' });
      }
    }
  }

  return results;
});

// 内容搜索
ipcMain.handle('search-content', async (event, { keyword, category }) => {
  const allBooks = loadAllBooks();
  const results = [];
  const kw = keyword.trim();

  if (!kw) return [];

  const booksToSearch = category ?
    allBooks.filter(b => b.category === category) : allBooks;

  for (const book of booksToSearch) {
    const content = await readBookContentAsync(book.category, book.bookid);
    if (!content) continue;

    const lines = content.split('\n');
    const snippets = [];

    for (let i = 0; i < lines.length; i++) {
      if (isImageLine(lines[i])) continue;
      if (lines[i].includes(kw)) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        const snippetLines = lines.slice(start, end).filter(l => !isImageLine(l));
        snippets.push({
          line: i,
          text: snippetLines.join('\n').trim()
        });
        if (snippets.length >= 5) break; // 每本书最多5个匹配
      }
    }

    if (snippets.length > 0) {
      results.push({ ...book, snippets, matchCount: snippets.length });
    }
  }

  return results;
});

// 打开阅读器
ipcMain.handle('open-reader', (event, { category, bookid, page, mode }) => {
  const state = { category, bookid: normalizeBookId(bookid), page: page || 0 };
  createReaderWindow(mode || 'window', state);

  // 添加到书架
  addToShelf(category, state.bookid, page || 0);

  return { success: true };
});

// 切换阅读模式
ipcMain.handle('switch-mode', (event, { mode, category, bookid, page }) => {
  const state = { category, bookid: normalizeBookId(bookid), page: page || 0 };

  // 关闭当前阅读窗口
  if (readerWindow) {
    readerWindow.close();
    readerWindow = null;
  }
  if (moyuWindow) {
    moyuWindow.close();
    moyuWindow = null;
  }

  createReaderWindow(mode, state);
  return { success: true };
});

// 隐藏墨域窗口
ipcMain.handle('hide-moyu', () => {
  if (moyuWindow) {
    moyuWindow.hide();
  }
  return { success: true };
});

// 显示墨域窗口
ipcMain.handle('show-moyu', () => {
  if (moyuWindow) {
    moyuWindow.show();
    moyuWindow.focus();
  }
  return { success: true };
});

// 关闭阅读窗口
ipcMain.handle('close-reader', () => {
  if (readerWindow) {
    readerWindow.close();
    readerWindow = null;
  }
  if (moyuWindow) {
    moyuWindow.close();
    moyuWindow = null;
  }
  return { success: true };
});

// ---- 书签管理 ----
ipcMain.handle('save-bookmark', (event, { category, bookid, page, label }) => {
  const data = loadData();
  const key = `${category}_${bookid}`;
  if (!data.bookmarks[key]) data.bookmarks[key] = [];

  data.bookmarks[key].push({
    page,
    label: label || `第${page + 1}页`,
    timestamp: Date.now()
  });

  saveData(data);
  return { success: true };
});

ipcMain.handle('get-bookmarks', (event, { category, bookid }) => {
  const data = loadData();
  const key = `${category}_${bookid}`;
  return data.bookmarks[key] || [];
});

ipcMain.handle('delete-bookmark', (event, { category, bookid, index }) => {
  const data = loadData();
  const key = `${category}_${bookid}`;
  if (data.bookmarks[key] && data.bookmarks[key][index]) {
    data.bookmarks[key].splice(index, 1);
    saveData(data);
  }
  return { success: true };
});

// ---- 阅读进度 ----
ipcMain.handle('save-progress', (event, { category, bookid, page, scroll }) => {
  const data = loadData();
  const key = `${category}_${bookid}`;
  data.progress[key] = { page, scroll, timestamp: Date.now() };
  saveData(data);
  return { success: true };
});

ipcMain.handle('get-progress', (event, { category, bookid }) => {
  const data = loadData();
  const key = `${category}_${bookid}`;
  return data.progress[key] || null;
});

// ---- 书架管理 ----
function addToShelf(category, bookid, page) {
  const data = loadData();
  const bid = normalizeBookId(bookid);
  const existing = data.bookshelf.findIndex(
    b => b.category === category && sameBookId(b.bookid, bid)
  );

  if (existing >= 0) {
    data.bookshelf[existing].lastRead = Date.now();
    data.bookshelf[existing].page = page;
  } else {
    data.bookshelf.push({
      category,
      bookid: bid,
      page,
      lastRead: Date.now(),
      addedAt: Date.now()
    });
  }

  // 保留最近100本
  if (data.bookshelf.length > 100) {
    data.bookshelf.sort((a, b) => b.lastRead - a.lastRead);
    data.bookshelf = data.bookshelf.slice(0, 100);
  }

  saveData(data);
}

ipcMain.handle('get-bookshelf', () => {
  const data = loadData();
  const allBooks = loadAllBooks();
  const bookMap = {};
  for (const b of allBooks) {
    bookMap[`${b.category}_${b.bookid}`] = b;
  }

  const shelf = data.bookshelf.map(item => {
    const book = bookMap[`${item.category}_${item.bookid}`];
    return {
      ...item,
      title: book ? book.title : '未知',
      author: book ? book.author : '',
      rawTitle: book ? book.rawTitle : ''
    };
  });

  shelf.sort((a, b) => b.lastRead - a.lastRead);
  return shelf;
});

ipcMain.handle('remove-from-shelf', (event, { category, bookid }) => {
  const data = loadData();
  const bid = normalizeBookId(bookid);
  data.bookshelf = data.bookshelf.filter(
    b => !(b.category === category && sameBookId(b.bookid, bid))
  );
  saveData(data);
  return { success: true };
});

// ---- 导入书籍 ----
ipcMain.handle('get-supported-formats', () => {
  return {
    supported: formats.supportedExtensions(),
    todo: formats.allRegisteredExtensions().filter(ext => formats.isTodo(ext))
  };
});

ipcMain.handle('import-books', async () => {
  const supported = formats.supportedExtensions();
  const todo = formats.allRegisteredExtensions().filter(ext => formats.isTodo(ext));
  const filters = [
    {
      name: '支持的电子书',
      extensions: supported
    },
    {
      name: '所有文件',
      extensions: ['*']
    }
  ];
  // 也列出 TODO 扩展，便于用户选中后得到明确提示
  if (todo.length) {
    filters.splice(1, 0, {
      name: '其他格式（暂未支持）',
      extensions: todo
    });
  }

  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: '导入书籍',
    properties: ['openFile', 'multiSelections'],
    filters
  });

  if (result.canceled || !result.filePaths.length) {
    return { imported: [], errors: [], canceled: true };
  }

  return importedStore.importBookFiles(result.filePaths);
});

ipcMain.handle('delete-imported-book', (event, { bookid }) => {
  return importedStore.deleteImportedBook(bookid, cleanupBookUserData);
});

ipcMain.handle('get-imported-dir', () => {
  const dir = importedStore.ensureImportedDirs();
  return { path: dir };
});

ipcMain.handle('open-imported-dir', async () => {
  const dir = importedStore.ensureImportedDirs();
  await shell.openPath(dir);
  return { success: true, path: dir };
});

// ---- 阅读时长 ----
ipcMain.handle('save-reading-time', (event, { category, bookid, seconds }) => {
  const data = loadData();
  const key = `${category}_${bookid}`;
  if (!data.readingTime[key]) data.readingTime[key] = 0;
  data.readingTime[key] += seconds;
  saveData(data);
  return { success: true, total: data.readingTime[key] };
});

ipcMain.handle('get-reading-time', (event, { category, bookid }) => {
  const data = loadData();
  const key = `${category}_${bookid}`;
  return data.readingTime[key] || 0;
});

ipcMain.handle('get-all-reading-time', () => {
  const data = loadData();
  return data.readingTime || {};
});

// ---- 墨域窗口拖动 ----
ipcMain.on('moyu-drag', (event, { dx, dy }) => {
  if (moyuWindow) {
    const [x, y] = moyuWindow.getPosition();
    moyuWindow.setPosition(x + dx, y + dy);
  }
});

// ---- 墨域模式原生右键菜单 ----
ipcMain.on('moyu-context-menu', (event, data) => {
  const bookmarks = (data && data.bookmarks) || [];
  const chapters = (data && data.chapters) || [];

  // 书签子菜单
  const bookmarkSubmenu = bookmarks.length > 0
    ? bookmarks.map((bm, i) => ({
        label: bm.label ? (bm.label.length > 50 ? bm.label.substring(0, 50) + '...' : bm.label) : `书签${i + 1}`,
        click: () => sendMoyuAction(event, `bm_jump:${i}`)
      }))
    : [{ label: '暂无书签', enabled: false }];

  // 章节子菜单
  const chapterSubmenu = chapters.length > 0
    ? chapters.map((ch, i) => ({
        label: ch.title.length > 50 ? ch.title.substring(0, 50) + '...' : ch.title,
        click: () => sendMoyuAction(event, `ch_jump:${i}`)
      }))
    : [{ label: '未检测到章节', enabled: false }];

  const menu = Menu.buildFromTemplate([
    { label: '🔖 保存书签', click: () => sendMoyuAction(event, 'bookmark') },
    { label: '📋 书签列表', submenu: bookmarkSubmenu },
    { label: '📑 章节目录', submenu: chapterSubmenu },
    { type: 'separator' },
    { label: '🪟 切换到窗口模式', click: () => sendMoyuAction(event, 'mode-window') },
    { label: '🖥️ 切换到全屏模式', click: () => sendMoyuAction(event, 'mode-fullscreen') },
    { type: 'separator' },
    { label: '◀ 上一页', click: () => sendMoyuAction(event, 'prev') },
    { label: '▶ 下一页', click: () => sendMoyuAction(event, 'next') },
    { type: 'separator' },
    { label: '⏮ 上一章', click: () => sendMoyuAction(event, 'prevChapter') },
    { label: '⏭ 下一章', click: () => sendMoyuAction(event, 'nextChapter') },
    { type: 'separator' },
    { label: '🙈 隐藏 (Ctrl+`)', click: () => sendMoyuAction(event, 'hide') },
  ]);
  menu.popup(moyuWindow);
});

function sendMoyuAction(event, action) {
  // 向墨域窗口的渲染进程发送动作
  if (moyuWindow) {
    moyuWindow.webContents.send('moyu-menu-action', action);
  }
}

// 获取书籍总数
ipcMain.handle('get-book-count', () => {
  const allBooks = loadAllBooks();
  const counts = {};
  for (const b of allBooks) {
    counts[b.category] = (counts[b.category] || 0) + 1;
  }
  return counts;
});

// ---- 主题管理 ----
function getDefaultTheme() {
  return {
    preset: 'dark',
    bgPrimary: '#1a1a2e',
    bgSecondary: '#16213e',
    bgTertiary: '#0f3460',
    textPrimary: '#e0e0e0',
    textSecondary: '#a0a0b0',
    textMuted: '#666680',
    accent: '#e94560',
    border: '#2a2a4e',
    fontSize: 18,
    followSystem: false
  };
}

ipcMain.handle('get-theme', () => {
  const data = loadData();
  return data.theme || getDefaultTheme();
});

ipcMain.handle('save-theme', (event, theme) => {
  const data = loadData();
  data.theme = theme;
  saveData(data);

  // 设置原生主题
  if (theme.followSystem) {
    nativeTheme.themeSource = 'system';
  } else if (theme.preset === 'light') {
    nativeTheme.themeSource = 'light';
  } else {
    nativeTheme.themeSource = 'dark';
  }

  // 广播到所有窗口
  broadcastTheme(theme);

  return { success: true };
});

function broadcastTheme(theme) {
  const windows = [mainWindow, readerWindow, moyuWindow].filter(w => w);
  for (const win of windows) {
    win.webContents.send('theme-updated', theme);
  }
}

// 监听系统主题变化
nativeTheme.on('updated', () => {
  const data = loadData();
  if (data.theme && data.theme.followSystem) {
    const isDark = nativeTheme.shouldUseDarkColors;
    const windows = [mainWindow, readerWindow, moyuWindow].filter(w => w);
    for (const win of windows) {
      win.webContents.send('native-theme-changed', isDark);
    }
  }
});

// ---- 屏幕取色 ----
ipcMain.handle('capture-screen', async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.floor(width * scaleFactor),
        height: Math.floor(height * scaleFactor)
      }
    });

    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL();
    }
  } catch (e) {
    console.error('屏幕捕获失败:', e);
  }
  return null;
});

// ============================================================
// 全局快捷键
// ============================================================
app.whenReady().then(() => {
  // 注册 local-book 协议：local-book://{bookid}/{filename}
  protocol.handle('local-book', (request) => {
    try {
      const url = new URL(request.url);
      const bookid = decodeURIComponent(url.hostname || '');
      const filename = decodeURIComponent((url.pathname || '').replace(/^\//, ''));
      const assetsRoot = importedStore.getAssetsRoot();
      const filePath = buildLocalBookFilePath(assetsRoot, bookid, filename);
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }
      return net.fetch(pathToFileURL(filePath).href);
    } catch (e) {
      console.error('local-book protocol error:', e);
      return new Response('Bad Request', { status: 400 });
    }
  });

  // 初始化原生主题
  const data = loadData();
  if (data.theme) {
    if (data.theme.followSystem) {
      nativeTheme.themeSource = 'system';
    } else if (data.theme.preset === 'light') {
      nativeTheme.themeSource = 'light';
    } else {
      nativeTheme.themeSource = 'dark';
    }
  }

  createMainWindow();

  // 全局快捷键：Ctrl+` 切换墨域窗口显示/隐藏
  globalShortcut.register('CommandOrControl+`', () => {
    if (moyuWindow) {
      if (moyuWindow.isVisible()) {
        moyuWindow.hide();
      } else {
        moyuWindow.show();
        moyuWindow.focus();
      }
    }
  });

  // Ctrl+Shift+M 快速打开墨域模式（从主窗口）
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (mainWindow && !moyuWindow && currentReadState) {
      createMoyuWindow(currentReadState);
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
