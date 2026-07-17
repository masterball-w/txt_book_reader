/**
 * 格式适配器注册表：按扩展名分发 extractText。
 */

const adapters = new Map(); // ext -> adapter

function register(adapter) {
  if (!adapter || !adapter.id || !Array.isArray(adapter.extensions)) {
    throw new Error('Invalid format adapter');
  }
  for (const ext of adapter.extensions) {
    const key = normalizeExt(ext);
    adapters.set(key, adapter);
  }
}

function normalizeExt(ext) {
  return String(ext || '').replace(/^\./, '').toLowerCase();
}

function getAdapter(ext) {
  return adapters.get(normalizeExt(ext)) || null;
}

function supportedExtensions() {
  const set = new Set();
  for (const [ext, adapter] of adapters.entries()) {
    if (!adapter.todo) set.add(ext);
  }
  return Array.from(set).sort();
}

function allRegisteredExtensions() {
  return Array.from(adapters.keys()).sort();
}

function isSupported(ext) {
  const adapter = getAdapter(ext);
  return !!(adapter && !adapter.todo);
}

function isTodo(ext) {
  const adapter = getAdapter(ext);
  return !!(adapter && adapter.todo);
}

/**
 * @param {string} filePath
 * @param {string} [ext]
 * @param {{ bookid?: string, assetDir?: string }} [options]
 * @returns {Promise<{ text: string, title?: string, author?: string, chapters?: Array }>}
 */
async function extractText(filePath, ext, options = {}) {
  const extension = normalizeExt(ext || require('path').extname(filePath));
  const adapter = getAdapter(extension);
  if (!adapter) {
    throw new Error(`不支持的格式: .${extension}`);
  }
  if (adapter.todo) {
    throw new Error(adapter.message || `格式 .${extension} 暂未支持`);
  }
  return adapter.extractText(filePath, options);
}

module.exports = {
  register,
  getAdapter,
  supportedExtensions,
  allRegisteredExtensions,
  isSupported,
  isTodo,
  extractText,
  normalizeExt
};
