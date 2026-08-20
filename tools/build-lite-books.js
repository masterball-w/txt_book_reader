// 生成轻量版示例书库 → build/shu-lite/
// Lite 安装包只内置 5 本示例书；bookid 与完整库保持一致，
// 用户后续放置完整书库时阅读进度 / 书签无缝衔接。
const fs = require('fs');
const path = require('path');

// 示例书：中文 3 本 + 英文 1 本 + 译文 1 本
const SAMPLES = {
  cn: [1, 5, 69],   // 红楼梦 / 三国演义 / 三体
  en: [1],           // Harry Potter series
  yi: [2]            // 百年孤独-范晔译
};

const SRC = path.join(__dirname, '..', 'shu');
const OUT = path.join(__dirname, '..', 'build', 'shu-lite');

fs.rmSync(OUT, { recursive: true, force: true });

let total = 0;
for (const [cat, ids] of Object.entries(SAMPLES)) {
  const srcCat = path.join(SRC, cat);
  const outCat = path.join(OUT, cat);
  fs.mkdirSync(outCat, { recursive: true });

  const books = JSON.parse(fs.readFileSync(path.join(srcCat, 'books.json'), 'utf-8'));
  const picked = [];
  for (const id of ids) {
    const meta = books.find(b => Number(b.bookid) === Number(id));
    if (!meta) {
      console.error(`[lite] 未找到 ${cat}/${id}`);
      process.exit(1);
    }
    fs.copyFileSync(path.join(srcCat, `${id}.txt`), path.join(outCat, `${id}.txt`));
    picked.push(meta);
    total++;
  }
  fs.writeFileSync(path.join(outCat, 'books.json'), JSON.stringify(picked, null, 2), 'utf-8');
  console.log(`[lite] ${cat}: ${picked.map(b => b.title).join(' / ')}`);
}

// 版本标记：主进程据此识别 Lite 安装包并显示完整书库引导
fs.writeFileSync(
  path.join(OUT, 'library-edition.json'),
  JSON.stringify({ edition: 'lite', sampleCount: total }, null, 2),
  'utf-8'
);
console.log(`[lite] done: ${total} books -> ${OUT}`);
