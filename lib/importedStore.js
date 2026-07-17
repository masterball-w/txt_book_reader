/**
 * 导入书库：userData/imported-books/{index.json, files/}
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const formats = require('./formats');

const LOCAL_CATEGORY = 'local';

function createImportedStore(getUserDataDir) {
  function getImportedRoot() {
    return path.join(getUserDataDir(), 'imported-books');
  }

  function getFilesDir() {
    return path.join(getImportedRoot(), 'files');
  }

  function getAssetsRoot() {
    return path.join(getImportedRoot(), 'assets');
  }

  function getAssetDir(bookid) {
    return path.join(getAssetsRoot(), String(bookid));
  }

  function ensureAssetDir(bookid) {
    const dir = getAssetDir(bookid);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function getIndexPath() {
    return path.join(getImportedRoot(), 'index.json');
  }

  function ensureImportedDirs() {
    const root = getImportedRoot();
    const files = getFilesDir();
    const assets = getAssetsRoot();
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    if (!fs.existsSync(files)) fs.mkdirSync(files, { recursive: true });
    if (!fs.existsSync(assets)) fs.mkdirSync(assets, { recursive: true });
    return root;
  }

  function loadImportedIndex() {
    ensureImportedDirs();
    const indexPath = getIndexPath();
    try {
      if (fs.existsSync(indexPath)) {
        const raw = fs.readFileSync(indexPath, 'utf-8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : (data.books || []);
      }
    } catch (e) {
      console.error('加载导入书目失败:', e);
    }
    return [];
  }

  function saveImportedIndex(books) {
    ensureImportedDirs();
    fs.writeFileSync(getIndexPath(), JSON.stringify(books, null, 2), 'utf-8');
  }

  function findImportedBook(bookid) {
    return loadImportedIndex().find(b => String(b.bookid) === String(bookid)) || null;
  }

  function resolveImportedPath(bookid) {
    const entry = findImportedBook(bookid);
    if (!entry || !entry.filename) return null;
    const filePath = path.join(getFilesDir(), entry.filename);
    return fs.existsSync(filePath) ? filePath : null;
  }

  function guessTitleFromFilename(filename) {
    const base = path.basename(filename, path.extname(filename));
    return base || '未命名';
  }

  /**
   * 从文件名粗略解析「书名 - 作者」
   */
  function parseSourceName(sourceName) {
    const base = path.basename(sourceName, path.extname(sourceName));
    if (base.includes(' - ')) {
      const parts = base.split(' - ');
      return { title: parts[0].trim(), author: parts.slice(1).join(' - ').trim() };
    }
    return { title: base, author: '' };
  }

  /**
   * @param {string[]} filePaths
   * @returns {Promise<{ imported: object[], errors: { path: string, error: string }[] }>}
   */
  async function importBookFiles(filePaths) {
    ensureImportedDirs();
    const books = loadImportedIndex();
    const imported = [];
    const errors = [];

    for (const srcPath of filePaths) {
      try {
        if (!srcPath || !fs.existsSync(srcPath)) {
          errors.push({ path: srcPath, error: '文件不存在' });
          continue;
        }

        const ext = formats.normalizeExt(path.extname(srcPath));
        if (formats.isTodo(ext)) {
          const adapter = formats.getAdapter(ext);
          errors.push({
            path: srcPath,
            error: (adapter && adapter.message) || `格式 .${ext} 暂未支持`
          });
          continue;
        }
        if (!formats.isSupported(ext)) {
          errors.push({ path: srcPath, error: `不支持的格式: .${ext}` });
          continue;
        }

        const bookid = crypto.randomUUID();
        const filename = `${bookid}.${ext}`;
        const destPath = path.join(getFilesDir(), filename);
        fs.copyFileSync(srcPath, destPath);

        const sourceName = path.basename(srcPath);
        const fromName = parseSourceName(sourceName);
        let title = fromName.title || guessTitleFromFilename(sourceName);
        let author = fromName.author || '';

        // TXT：读文件探测标题；EPUB/MOBI 用文件名，避免导入时全量解析
        if (ext === 'txt') {
          try {
            const probed = await formats.extractText(destPath, ext);
            if (probed.title) {
              if (probed.title.includes(' - ')) {
                const parts = probed.title.split(' - ');
                title = parts[0].trim();
                author = parts.slice(1).join(' - ').trim() || author;
              } else {
                title = probed.title;
              }
            }
            if (probed.author) author = probed.author;
          } catch (_) {}
        }

        const entry = {
          bookid,
          title,
          author,
          description: '',
          format: ext,
          filename,
          sourceName,
          importedAt: Date.now()
        };

        books.push(entry);
        imported.push(entry);
      } catch (e) {
        errors.push({ path: srcPath, error: e.message || String(e) });
      }
    }

    if (imported.length > 0) {
      saveImportedIndex(books);
    }

    return { imported, errors };
  }

  /**
   * @param {string} bookid
   * @param {(key: string) => void} [cleanupUserData] 清理进度/书签等
   */
  function deleteImportedBook(bookid, cleanupUserData) {
    const books = loadImportedIndex();
    const idx = books.findIndex(b => String(b.bookid) === String(bookid));
    if (idx < 0) {
      return { success: false, error: '未找到该书' };
    }

    const entry = books[idx];
    const filePath = path.join(getFilesDir(), entry.filename);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
      console.error('删除导入文件失败:', e);
    }

    // 清理内嵌图片资源目录
    const assetDir = getAssetDir(entry.bookid);
    try {
      if (fs.existsSync(assetDir)) {
        fs.rmSync(assetDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('删除导入资源目录失败:', e);
    }

    books.splice(idx, 1);
    saveImportedIndex(books);

    if (typeof cleanupUserData === 'function') {
      cleanupUserData(`${LOCAL_CATEGORY}_${bookid}`);
    }

    return { success: true };
  }

  function listImportedAsBooks() {
    return loadImportedIndex().map(book => ({
      category: LOCAL_CATEGORY,
      bookid: book.bookid,
      title: book.title || '未命名',
      author: book.author || '',
      description: book.description || '',
      rawTitle: book.author ? `${book.title} - ${book.author}` : (book.title || ''),
      format: book.format || path.extname(book.filename || '').replace('.', ''),
      source: 'imported',
      sourceName: book.sourceName || '',
      importedAt: book.importedAt || 0
    }));
  }

  return {
    LOCAL_CATEGORY,
    getImportedRoot,
    getFilesDir,
    getAssetsRoot,
    getAssetDir,
    ensureAssetDir,
    ensureImportedDirs,
    loadImportedIndex,
    saveImportedIndex,
    findImportedBook,
    resolveImportedPath,
    importBookFiles,
    deleteImportedBook,
    listImportedAsBooks
  };
}

module.exports = { createImportedStore, LOCAL_CATEGORY };
