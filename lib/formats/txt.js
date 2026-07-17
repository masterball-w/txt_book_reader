const fs = require('fs');
const iconv = require('iconv-lite');

/**
 * 检测并解码文本文件：优先 UTF-8，无效时回退 GBK/GB18030。
 */
function decodeBuffer(buf) {
  // UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString('utf-8');
  }
  // UTF-16 LE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return iconv.decode(buf.slice(2), 'utf16-le');
  }
  // UTF-16 BE BOM
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return iconv.decode(buf.slice(2), 'utf16-be');
  }

  const asUtf8 = buf.toString('utf-8');
  if (!hasReplacementChar(asUtf8) && looksLikeText(asUtf8)) {
    return asUtf8;
  }

  // 常见中文编码回退
  for (const enc of ['gb18030', 'gbk', 'big5']) {
    try {
      const decoded = iconv.decode(buf, enc);
      if (!hasReplacementChar(decoded) && looksLikeText(decoded)) {
        return decoded;
      }
    } catch (_) {
      // ignore
    }
  }

  return asUtf8;
}

function hasReplacementChar(str) {
  return str.includes('\uFFFD');
}

function looksLikeText(str) {
  if (!str) return false;
  const sample = str.slice(0, 4000);
  let control = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32) control++;
  }
  return control / Math.max(sample.length, 1) < 0.02;
}

function guessTitleFromText(text, fallback) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines[0] || fallback || '未命名';
}

const txtAdapter = {
  id: 'txt',
  extensions: ['txt'],
  async extractText(filePath) {
    const buf = fs.readFileSync(filePath);
    const text = decodeBuffer(buf);
    const base = require('path').basename(filePath, '.txt');
    return {
      text,
      title: guessTitleFromText(text, base),
      author: ''
    };
  }
};

module.exports = txtAdapter;
