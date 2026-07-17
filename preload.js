const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 书籍操作
  getBooks: () => ipcRenderer.invoke('get-books'),
  readBook: (category, bookid) => ipcRenderer.invoke('read-book', { category, bookid }),
  getBookCount: () => ipcRenderer.invoke('get-book-count'),

  // 搜索
  searchBooks: (type, keyword) => ipcRenderer.invoke('search-books', { type, keyword }),
  searchContent: (keyword, category) => ipcRenderer.invoke('search-content', { keyword, category }),

  // 导入
  getSupportedFormats: () => ipcRenderer.invoke('get-supported-formats'),
  importBooks: () => ipcRenderer.invoke('import-books'),
  deleteImportedBook: (bookid) => ipcRenderer.invoke('delete-imported-book', { bookid }),
  getImportedDir: () => ipcRenderer.invoke('get-imported-dir'),
  openImportedDir: () => ipcRenderer.invoke('open-imported-dir'),

  // 阅读器
  openReader: (category, bookid, page, mode) =>
    ipcRenderer.invoke('open-reader', { category, bookid, page, mode }),
  switchMode: (mode, category, bookid, page) =>
    ipcRenderer.invoke('switch-mode', { mode, category, bookid, page }),
  closeReader: () => ipcRenderer.invoke('close-reader'),
  hideMoyu: () => ipcRenderer.invoke('hide-moyu'),
  showMoyu: () => ipcRenderer.invoke('show-moyu'),

  // 书签
  saveBookmark: (category, bookid, page, label) =>
    ipcRenderer.invoke('save-bookmark', { category, bookid, page, label }),
  getBookmarks: (category, bookid) =>
    ipcRenderer.invoke('get-bookmarks', { category, bookid }),
  deleteBookmark: (category, bookid, index) =>
    ipcRenderer.invoke('delete-bookmark', { category, bookid, index }),

  // 阅读进度
  saveProgress: (category, bookid, page, scroll) =>
    ipcRenderer.invoke('save-progress', { category, bookid, page, scroll }),
  getProgress: (category, bookid) =>
    ipcRenderer.invoke('get-progress', { category, bookid }),

  // 书架
  getBookshelf: () => ipcRenderer.invoke('get-bookshelf'),
  removeFromShelf: (category, bookid) =>
    ipcRenderer.invoke('remove-from-shelf', { category, bookid }),

  // 阅读时长
  saveReadingTime: (category, bookid, seconds) =>
    ipcRenderer.invoke('save-reading-time', { category, bookid, seconds }),
  getReadingTime: (category, bookid) =>
    ipcRenderer.invoke('get-reading-time', { category, bookid }),
  getAllReadingTime: () => ipcRenderer.invoke('get-all-reading-time'),

  // 墨域窗口拖动
  moyuDrag: (dx, dy) => ipcRenderer.send('moyu-drag', { dx, dy }),

  // 墨域模式原生右键菜单（传入书签和章节数据用于构建子菜单）
  showMoyuMenu: (data, callback) => {
    ipcRenderer.send('moyu-context-menu', data);
    ipcRenderer.once('moyu-menu-action', (event, action) => callback(action));
  },

  // 主题管理
  getTheme: () => ipcRenderer.invoke('get-theme'),
  saveTheme: (theme) => ipcRenderer.invoke('save-theme', theme),
  onThemeUpdated: (callback) => ipcRenderer.on('theme-updated', (e, theme) => callback(theme)),
  onNativeThemeChanged: (callback) => ipcRenderer.on('native-theme-changed', (e, isDark) => callback(isDark)),

  // 屏幕取色
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
});
