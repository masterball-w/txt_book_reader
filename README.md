# 📚 TXT Book Reader - 书库阅读器

基于 Electron 的 TXT 电子书阅读器，支持全屏、窗口、摸鱼三种阅读模式，内置书签、书架、搜索、主题自定义等功能。

## ✨ 功能特性

### 阅读模式
- **🪟 窗口模式** — 标准窗口阅读，工具栏可操作
- **🖥️ 全屏模式** — 沉浸式全屏阅读，鼠标悬停显示工具栏
- **🐟 摸鱼模式** — 无边框透明长条阅读栏，始终置顶，`Ctrl+`` 一键隐藏/显示

### 搜索功能
- 书名模糊搜索
- 书名精确搜索
- 作者搜索
- 全文内容搜索（带上下文预览和高亮）

### 书签与书架
- 保存/删除/跳转书签
- 历史书架自动记录阅读过的书
- 阅读时长统计

### 主题系统
- 四种预设主题：暗色、亮色、护眼（Sepia）、夜间（纯黑）
- 自定义背景色和文字色
- **屏幕取色** — 点击取色按钮截取屏幕，放大镜精准取色
- 跟随系统深色/浅色模式自动切换
- 字体大小可调（12-36px）
- 主题设置跨窗口同步、持久化保存

### 快捷键

| 快捷键 | 功能 | 适用模式 |
|--------|------|----------|
| `←` / `PageUp` | 上一页 | 所有模式 |
| `→` / `PageDown` / `空格` | 下一页 | 所有模式 |
| `Ctrl + B` | 保存书签 | 所有模式 |
| `` Ctrl + ` `` | 显示/隐藏摸鱼窗口 | 全局 |
| `Ctrl + Shift + M` | 快速打开摸鱼模式 | 全局 |
| `H` | 隐藏摸鱼窗口 | 摸鱼模式 |
| `Esc` | 退出全屏 | 全屏模式 |

### 右键菜单
阅读器中右键可快速访问：保存书签、书签列表、切换阅读模式、翻页、隐藏（摸鱼模式）。
摸鱼模式下使用 Electron 原生右键菜单，不受窗口大小限制。

## 📦 项目结构

```
txt_book_reader/
├── main.js           # Electron 主进程
├── preload.js        # IPC 安全桥接
├── launch.js         # 启动脚本
├── start.bat         # Windows 快速启动
├── package.json      # 项目配置
├── src/
│   ├── index.html    # 书库主界面
│   ├── index.css     # 书库样式
│   ├── index.js      # 书库逻辑
│   ├── reader.html   # 阅读器界面
│   ├── reader.css    # 阅读器样式
│   └── reader.js     # 阅读器逻辑
└── shu/              # 书籍资源（Git 子模块）
    ├── cn/           # 中文书籍（books.json + *.txt）
    ├── en/           # 英文书籍
    └── yi/           # 译文书籍
```

## 🚀 安装与运行

### 前置要求
- [Node.js](https://nodejs.org/) 16+
- npm 或 yarn

### 步骤

```bash
# 1. 克隆仓库（含子模块）
git clone --recursive https://github.com/masterball-w/txt_book_reader.git

# 如果已克隆但未拉取子模块：
# git submodule update --init --recursive

# 2. 进入目录
cd txt_book_reader

# 3. 安装依赖
npm install

# 4. 启动应用
npm start
```

Windows 用户也可以直接双击 `start.bat` 启动。

### 开发模式

```bash
npm run dev    # 启动并自动打开 DevTools
```

## 📖 资源文件说明

本项目的书籍资源文件（`shu/` 目录）来自开源仓库 **[dooshu/shu](https://github.com/dooshu/shu)**，以 Git 子模块的形式引入。

资源目录结构：
- `shu/cn/` — 中文书籍（约 1645 本）
- `shu/en/` — 英文书籍（约 135 本）
- `shu/yi/` — 译文书籍（约 424 本）

每个目录下包含 `books.json`（书籍元数据索引）和对应的 `.txt` 文件。应用通过 `books.json` 中的 `bookid` 字段匹配对应的 txt 文件，自动解析书名和作者信息。

## 🙏 致谢

特别感谢 **[dooshu](https://github.com/dooshu)** 提供的开源书库资源 [dooshu/shu](https://github.com/dooshu/shu)。正是有了这些丰富的书籍资源，本阅读器才能提供如此完整的阅读体验。

书籍资源的版权归原作者所有，本项目仅作为阅读工具使用。

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件。
