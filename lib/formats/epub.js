const path = require('path');
const fs = require('fs');
const { htmlToRichText } = require('./htmlToText');
const { createImageSrcMapper } = require('./imageMap');

function authorFromMetadata(meta) {
  if (!meta) return '';
  const creators = meta.creator;
  if (Array.isArray(creators) && creators.length) {
    return creators
      .map(c => (typeof c === 'string' ? c : (c && c.contributor) || ''))
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

const epubAdapter = {
  id: 'epub',
  extensions: ['epub'],
  /**
   * @param {string} filePath
   * @param {{ bookid?: string, assetDir?: string }} [options]
   */
  async extractText(filePath, options = {}) {
    const { initEpubFile } = await import('@lingo-reader/epub-parser');
    const bookid = options.bookid || 'unknown';
    const assetDir = options.assetDir || path.join(path.dirname(filePath), '..', 'assets', String(bookid));

    if (!fs.existsSync(assetDir)) {
      fs.mkdirSync(assetDir, { recursive: true });
    }

    const epub = await initEpubFile(filePath, assetDir);
    const mapSrc = createImageSrcMapper(bookid, assetDir);

    try {
      const meta = typeof epub.getMetadata === 'function' ? epub.getMetadata() : {};
      const spine = typeof epub.getSpine === 'function' ? epub.getSpine() : [];
      const toc = typeof epub.getToc === 'function' ? epub.getToc() : [];

      const title =
        (meta && meta.title) ||
        path.basename(filePath, '.epub');
      const author = authorFromMetadata(meta);

      const labelMap = new Map();
      const walkToc = (items) => {
        for (const item of items || []) {
          if (item.href) labelMap.set(item.href.split('#')[0], item.label || '');
          if (item.id) labelMap.set(item.id, item.label || '');
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
          chapter = await epub.loadChapter(id);
        } catch (e) {
          console.error('EPUB chapter load failed:', id, e.message);
          continue;
        }
        if (!chapter) continue;

        const html = chapter.html || '';
        const chapterTitle =
          (labelMap.get(item.href) || labelMap.get(id) || item.id || '').trim() ||
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
        throw new Error('无法从 EPUB 提取文本内容');
      }

      return { text, title, author, chapters };
    } finally {
      if (typeof epub.destroy === 'function') {
        try { epub.destroy(); } catch (_) {}
      }
    }
  }
};

module.exports = epubAdapter;
