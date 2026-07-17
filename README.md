# TXT Book Reader - 书库阅读器

基于 Electron 的电子书阅读器，内置 doosho/shu 书库，并支持导入本地 TXT / EPUB / MOBI。提供全屏、窗口、摸鱼三种阅读模式，以及书签、书架、搜索、主题自定义等功能。

![阅读界面](docs/screenshots/阅读界面.png)

## 功能特性

### 阅读模式

支持三种阅读模式，可根据场景自由切换：

![阅读模式](docs/screenshots/阅读模式.png)

- **窗口模式** — 标准窗口阅读，工具栏可操作
- **全屏模式** — 沉浸式全屏阅读，鼠标悬停显示工具栏
- **摸鱼模式** — 无边框透明长条阅读栏，始终置顶，`Ctrl+`` 一键隐藏/显示

摸鱼模式下，阅读栏以极简长条形式悬浮于屏幕上方，不影响正常工作，随时翻页：

![摸鱼模式的阅读界面](docs/screenshots/摸鱼模式的阅读界面.png)

### 外部导入 <!-- 2026-07-17 -->

> **[2026-07-17]** 新增外部导入与多格式支持。

侧栏「导入」分类可添加本地书籍：

- **已支持**：TXT、EPUB、MOBI（导入时复制到用户目录，阅读时经格式适配器抽出纯文本；窗口/全屏模式支持 EPUB/MOBI 内嵌图片）
- **暂未支持（TODO）**：PDF、AZW3/KF8、FB2、AZW、DjVu
- **存放位置**：应用用户数据目录下的 `imported-books/`（Windows 一般为 `%APPDATA%/书库阅读器/imported-books/`），含 `index.json`、`files/` 原文件副本与 `assets/` 图片缓存
- 导入书可删除；删除时会一并清理对应进度、书签、书架记录与资源目录

### 搜索功能

支持多种搜索方式，快速定位想读的书籍：

![搜索书籍](docs/screenshots/搜索书籍.png)

- 书名模糊搜索
- 书名精确搜索
- 作者搜索
- 全文内容搜索（带上下文预览和高亮）

### 书签与书架
- 保存/删除/跳转书签
- 历史书架自动记录阅读过的书
- 阅读时长统计

### 主题系统

内置四种预设主题，支持自定义背景色、文字色和字号，并提供屏幕取色功能：

![自定义主题和字号](docs/screenshots/自定义主题和字号.png)

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

## 项目结构

```
txt_book_reader/
├── ShuReader.exe     # [2026-07-17] Windows 本地开发启动器（双击启动，不进入安装包）
├── main.js           # Electron 主进程
├── preload.js        # IPC 安全桥接
├── launch.js         # npm start / 安装包内启动脚本（保持不变）
├── package.json      # 项目配置
├── tools/launcher/   # [2026-07-17] 启动器 C# 源码与编译脚本（不进入安装包）
├── lib/              # [2026-07-17] 格式适配器与导入书库
│   ├── formats/      # txt/epub/mobi + TODO stubs
│   └── importedStore.js
├── src/
│   ├── index.html    # 书库主界面
│   ├── index.css     # 书库样式
│   ├── index.js      # 书库逻辑
│   ├── reader.html   # 阅读器界面
│   ├── reader.css    # 阅读器样式
│   └── reader.js     # 阅读器逻辑
├── docs/
│   └── screenshots/  # 截图
└── shu/              # 书籍资源（Git 子模块）
    ├── cn/           # 中文书籍（books.json + *.txt）
    ├── en/           # 英文书籍
    └── yi/           # 译文书籍
```

## 安装与运行

### 方式一：下载安装包（推荐）

前往 [Releases 页面](https://github.com/masterball-w/txt_book_reader/releases) 下载最新的 `ShuReader-Setup-x.x.x-x64.exe`，双击安装即可使用。

安装包仍由 `npm run build`（electron-builder + NSIS）生成；**本地 `ShuReader.exe` 启动器不会打进安装包**，也不影响 `npm start` / `npm run build` 依赖链。

### 方式二：从源码运行

#### 前置要求
- [Node.js](https://nodejs.org/) 16+
- npm 或 yarn

#### 步骤

```bash
# 1. 克隆仓库（含子模块）
git clone --recursive https://github.com/masterball-w/txt_book_reader.git

# 如果已克隆但未拉取子模块：
# git submodule update --init --recursive

# 2. 进入目录
cd txt_book_reader

# 3. 安装依赖
npm install

# 4. 启动应用（任选其一）
# 双击项目根目录的 ShuReader.exe
# 或：
npm start
```

<!-- 2026-07-17 -->
> **[2026-07-17]** Windows 推荐直接双击根目录 **`ShuReader.exe`** 启动（替代原 `start.bat`）。  
> 该启动器仅用于源码目录本地运行：清除 `ELECTRON_RUN_AS_NODE` 并拉起 `node_modules/electron`。若缺少依赖，请先执行 `npm install`。  
> 重新编译启动器：`npm run build:launcher`（与 `npm run build` 安装包流程相互独立）。

### 开发模式

```bash
npm run dev              # 启动并自动打开 DevTools
# 或：
ShuReader.exe --dev
```

### 构建安装包

```bash
npm run build    # 构建 Windows NSIS 安装包 → dist/ShuReader-Setup-<version>-x64.exe
```

> **[2026-07-17]** `npm run build` / `npm run build:dir` / electron-builder 配置与运行时依赖不变；`build:launcher` 仅为可选的本地启动器重编译，不会在 `build` 中自动执行。

## 资源文件说明

本项目的书籍资源文件（`shu/` 目录）来自开源仓库 **[doosho/shu](https://github.com/doosho/shu)**，以 Git 子模块的形式引入。

资源目录结构：
- `shu/cn/` — 中文书籍（约 1645 本）
- `shu/en/` — 英文书籍（约 135 本）
- `shu/yi/` — 译文书籍（约 424 本）

每个目录下包含 `books.json`（书籍元数据索引）和对应的 `.txt` 文件。应用通过 `books.json` 中的 `bookid` 字段匹配对应的 txt 文件，自动解析书名和作者信息。

本地导入书籍与内置书库相互独立：导入文件保存在用户数据目录，不会写入 `shu/` 子模块。

## 致谢

特别感谢 **[dooshu](https://github.com/doosho)** 提供的开源书库资源 [doosho/shu](https://github.com/doosho/shu)。正是有了这些丰富的书籍资源，本阅读器才能提供如此完整的阅读体验。

书籍资源的版权归原作者所有，本项目仅作为阅读工具使用。

## License

MIT License - 详见 [LICENSE](LICENSE) 文件。