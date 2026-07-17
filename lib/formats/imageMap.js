/**
 * 将解析器给出的本地图片路径解析为可显示的 data: URL。
 * （EPUB 解析器写入文件名与 HTML 改写路径常不一致，故需在资源目录内模糊匹配）
 */

const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function toAbsPath(src) {
  if (!src) return null;
  let s = String(src).trim();
  if (/^file:/i.test(s)) {
    try {
      s = fileURLToPath(s);
    } catch (_) {
      s = s.replace(/^file:\/\//i, '');
      if (/^\/[A-Za-z]:/.test(s)) s = s.slice(1);
    }
  }
  try {
    if (/%[0-9A-Fa-f]{2}/.test(s)) s = decodeURIComponent(s);
  } catch (_) {}
  return path.normalize(s);
}

function guessMime(filePath, buf) {
  const ext = path.extname(filePath).toLowerCase();
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (buf && buf.length >= 3) {
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) return 'image/png';
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/webp';
  }
  return 'application/octet-stream';
}

function fileToDataUrl(filePath) {
  const buf = fs.readFileSync(filePath);
  // 跳过明显非图片的超小/空文件
  if (!buf || buf.length < 8) return null;
  const mime = guessMime(filePath, buf);
  if (!mime.startsWith('image/')) return null;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * 在 assetDir 中查找与解析器给出的路径对应的真实文件。
 * EPUB 常见情况：src 指向 OEBPS_images_a.png，磁盘上是 images_a.png。
 */
function findExistingImage(absPath, assetDir) {
  if (absPath && fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
    return absPath;
  }

  if (!assetDir || !fs.existsSync(assetDir)) return null;

  let files;
  try {
    files = fs.readdirSync(assetDir).filter((f) => {
      try {
        return fs.statSync(path.join(assetDir, f)).isFile();
      } catch (_) {
        return false;
      }
    });
  } catch (_) {
    return null;
  }

  if (!files.length) return null;

  const base = absPath ? path.basename(absPath) : '';
  if (base) {
    const exact = files.find((f) => f === base);
    if (exact) return path.join(assetDir, exact);

    // OEBPS_images_dot.png → 尝试 images_dot.png / dot.png
    const parts = base.split('_');
    for (let i = 1; i < parts.length; i++) {
      const suffix = parts.slice(i).join('_');
      const hit = files.find((f) => f === suffix);
      if (hit) return path.join(assetDir, hit);
    }

    // 后缀匹配：*_{base} 或 *{base}
    const ends = files.find((f) => f.endsWith('_' + base) || f.endsWith(base));
    if (ends) return path.join(assetDir, ends);

    // 扩展名相同且包含主干
    const stem = path.basename(base, path.extname(base));
    if (stem.length >= 3) {
      const soft = files.find((f) => f.includes(stem) && path.extname(f).toLowerCase() === path.extname(base).toLowerCase());
      if (soft) return path.join(assetDir, soft);
    }
  }

  return null;
}

/**
 * @param {string} bookid
 * @param {string} assetDir
 * @returns {(src: string) => string|null}
 */
function createImageSrcMapper(bookid, assetDir) {
  const normalizedAssetDir = path.normalize(assetDir);
  const cache = new Map(); // absPath -> dataUrl

  if (!fs.existsSync(normalizedAssetDir)) {
    fs.mkdirSync(normalizedAssetDir, { recursive: true });
  }

  function mapSrc(src) {
    const abs = toAbsPath(src);
    const cacheKey = abs || String(src);
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    let filePath = findExistingImage(abs, normalizedAssetDir);

    // 路径不在 assetDir 但文件存在：复制进来再读
    if (!filePath && abs && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      try {
        const name = path.basename(abs);
        const dest = path.join(normalizedAssetDir, name);
        if (path.normalize(abs) !== path.normalize(dest)) {
          if (!fs.existsSync(dest)) fs.copyFileSync(abs, dest);
          filePath = dest;
        } else {
          filePath = abs;
        }
      } catch (e) {
        console.error('复制图片失败:', e.message);
        filePath = abs;
      }
    }

    if (!filePath) {
      console.warn('未找到图片文件:', src);
      cache.set(cacheKey, null);
      return null;
    }

    try {
      const dataUrl = fileToDataUrl(filePath);
      cache.set(cacheKey, dataUrl);
      return dataUrl;
    } catch (e) {
      console.error('读取图片失败:', filePath, e.message);
      cache.set(cacheKey, null);
      return null;
    }
  }

  return mapSrc;
}

function buildLocalBookFilePath(assetsRoot, bookid, filename) {
  const safeBook = String(bookid || '');
  const safeName = path.basename(decodeURIComponent(String(filename || '')));
  if (!safeBook || !safeName || safeName === '.' || safeName === '..') return null;
  if (safeBook.includes('..') || safeBook.includes('/') || safeBook.includes('\\')) return null;

  const bookDir = path.normalize(path.join(assetsRoot, safeBook));
  const filePath = path.normalize(path.join(bookDir, safeName));
  if (!filePath.startsWith(bookDir + path.sep) && filePath !== bookDir) return null;
  return filePath;
}

module.exports = {
  createImageSrcMapper,
  buildLocalBookFilePath,
  findExistingImage,
  fileToDataUrl
};
