/**
 * HTML → 纯文本 / 富文本（保留图片占位行）
 *
 * 图片占位行格式：@@IMG:data:image/...;base64,...@@
 * 或兼容：@@IMG:local-book://...@@
 */

const IMG_LINE_RE = /^@@IMG:(.+?)@@$/;

function isImageLine(line) {
  return IMG_LINE_RE.test(String(line || '').trim());
}

function parseImageLine(line) {
  const m = String(line || '').trim().match(IMG_LINE_RE);
  if (!m) return null;
  return m[1];
}

function makeImageLine(protocolUrl) {
  return `@@IMG:${protocolUrl}@@`;
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, '');
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractAttr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  if (!m) return '';
  return m[2] || m[3] || m[4] || '';
}

/**
 * 将 HTML/XHTML 转为纯文本，尽量保留段落与标题换行。
 */
function htmlToText(html) {
  return htmlToRichText(html, null);
}

/**
 * @param {string} html
 * @param {(src: string) => string|null} [mapSrc] 将 img src 映射为协议 URL；为 null 时丢弃图片
 */
function htmlToRichText(html, mapSrc) {
  if (!html) return '';

  let text = String(html);

  // 去掉 script/style
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');

  // 图片 → 占位行（在剥标签之前）
  text = text.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = extractAttr(tag, 'src');
    const alt = extractAttr(tag, 'alt').trim();
    if (!src || typeof mapSrc !== 'function') {
      return alt ? `\n${alt}\n` : '';
    }
    const mapped = mapSrc(src);
    if (!mapped) {
      return alt ? `\n${alt}\n` : '';
    }
    const parts = ['', makeImageLine(mapped)];
    if (alt) parts.push(alt);
    parts.push('');
    return parts.join('\n');
  });

  // SVG <image href="...">
  text = text.replace(/<image\b[^>]*>/gi, (tag) => {
    const src = extractAttr(tag, 'href') || extractAttr(tag, 'xlink:href');
    if (!src || typeof mapSrc !== 'function') return '';
    const mapped = mapSrc(src);
    if (!mapped) return '';
    return `\n${makeImageLine(mapped)}\n`;
  });

  // 块级标签转换行
  text = text.replace(/<(br|hr)\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article|header|footer)>/gi, '\n');
  text = text.replace(/<(p|div|h[1-6]|li|tr|blockquote|section|article|header|footer)(\s[^>]*)?>/gi, '\n');

  // 标题前加空行，便于章节识别
  text = text.replace(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (_, _n, _a, inner) => {
    return `\n${stripTags(inner).trim()}\n`;
  });

  text = stripTags(text);
  text = decodeEntities(text);

  // 压缩多余空行（保留图片占位行）
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

module.exports = {
  htmlToText,
  htmlToRichText,
  isImageLine,
  parseImageLine,
  makeImageLine,
  IMG_LINE_RE
};
