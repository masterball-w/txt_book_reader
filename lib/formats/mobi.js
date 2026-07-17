const path = require('path');
const fs = require('fs');
const { htmlToRichText } = require('./htmlToText');
const { createImageSrcMapper } = require('./imageMap');

function authorFromMetadata(meta) {
  if (!meta) return '';
  if (Array.isArray(meta.author)) return meta.author.filter(Boolean).join(', ');
  if (typeof meta.author === 'string') return meta.author;
  return '';
}

const mobiAdapter = {
  id: 'mobi',
  extensions: ['mobi'],
  /**
   * @param {string} filePath
   * @param {{ bookid?: string, assetDir?: string }} [options]
   */
  async extractText(filePath, options = {}) {
    const { initMobiFile } = await import('@lingo-reader/mobi-parser');
    const bookid = options.bookid || 'unknown';
    const assetDir = options.assetDir || path.join(path.dirname(filePath), '..', 'assets', String(bookid));

    if (!fs.existsSync(assetDir)) {
      fs.mkdirSync(assetDir, { recursive: true });
    }

    let mobi;
    try {
      mobi = await initMobiFile(filePath, assetDir);
    } catch (e) {
      throw e;
    }

    const mapSrc = createImageSrcMapper(bookid, assetDir);

    try {
      const meta = typeof mobi.getMetadata === 'function' ? mobi.getMetadata() : {};
      const spine = typeof mobi.getSpine === 'function' ? mobi.getSpine() : [];
      const toc = typeof mobi.getToc === 'function' ? mobi.getToc() : [];

      const title =
        (meta && meta.title) ||
        path.basename(filePath, '.mobi');
      const author = authorFromMetadata(meta);

      const labelMap = new Map();
      const walkToc = (items) => {
        for (const item of items || []) {
          if (item.href) labelMap.set(String(item.href).split('#')[0], item.label || '');
          if (item.children) walkToc(item.children);
        }
      };
      walkToc(toc);

      const parts = [];
      if (title) parts.push(title + (author ? ` - ${author}` : ''));

      const chapters = [];

      for (const item of spine || []) {
        const id = item.id;
        if (!id) continue;
        let chapter;
        try {
          chapter = mobi.loadChapter(id);
        } catch (e) {
          console.error('MOBI chapter load failed:', id, e.message);
          continue;
        }
        if (!chapter) continue;

        const html = chapter.html || item.text || '';
        const chapterTitle =
          (labelMap.get(String(id)) || '').trim() ||
          `章节 ${chapters.length + 1}`;
        const body = htmlToRichText(html, mapSrc);
        if (!body) continue;

        chapters.push({ title: chapterTitle });
        parts.push('');
        parts.push(chapterTitle);
        parts.push(body);
      }

      const text = parts.join('\n').trim();
      if (!text) {
        throw new Error('无法从 MOBI 提取文本内容');
      }

      return { text, title, author, chapters };
    } finally {
      if (mobi && typeof mobi.destroy === 'function') {
        try { mobi.destroy(); } catch (_) {}
      }
      // 保留 assetDir，不再删除
    }
  }
};

module.exports = mobiAdapter;
