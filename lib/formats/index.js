/**
 * 格式适配器入口：注册全部适配器并导出 registry API。
 */

const registry = require('./registry');
const txtAdapter = require('./txt');
const epubAdapter = require('./epub');
const mobiAdapter = require('./mobi');
const stubs = require('./stubs');

registry.register(txtAdapter);
registry.register(epubAdapter);
registry.register(mobiAdapter);
for (const stub of stubs) {
  registry.register(stub);
}

module.exports = registry;
