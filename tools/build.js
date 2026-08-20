// 统一构建入口：node tools/build.js <lite|full>
// 从 package.json 的 build 字段完整拷贝配置，按版本覆盖书库与产物名，
// 避免 electron-builder --config 整体替换 package.json 配置的问题。
const { build } = require('electron-builder');
const pkg = require('../package.json');

const edition = process.argv[2];
if (!['lite', 'full'].includes(edition)) {
  console.error('用法: node tools/build.js <lite|full>');
  process.exit(1);
}

const config = JSON.parse(JSON.stringify(pkg.build));

// extraResources 完全由脚本注入（package.json 中不放此字段，
// 避免 builder API 深度合并时数组按索引混入另一版本的书库）
const FULL_RESOURCES = [
  { from: 'shu/cn', to: 'shu/cn', filter: ['**/*'] },
  { from: 'shu/en', to: 'shu/en', filter: ['**/*'] },
  { from: 'shu/yi', to: 'shu/yi', filter: ['**/*'] },
  { from: 'shu/README.md', to: 'shu/README.md' }
];

if (edition === 'lite') {
  // 重新生成 5 本示例书库
  require('./build-lite-books.js');
  config.extraResources = [
    { from: 'build/shu-lite', to: 'shu', filter: ['**/*'] }
  ];
  config.win.artifactName = 'ShuReader-Setup-${version}-Lite-x64.exe';
} else {
  config.extraResources = FULL_RESOURCES;
  config.win.artifactName = 'ShuReader-Setup-${version}-Full-x64.exe';
}

build({ win: ['nsis'], x64: true, config, publish: 'never' })
  .then(() => console.log(`[${edition}] 构建完成`))
  .catch(e => { console.error(e); process.exit(1); });
