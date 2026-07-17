<p align="center">
  <img src="docs/social-preview.png" alt="ShuReader / 书库阅读器" width="860"/>
</p>

<h1 align="center">书库阅读器 · ShuReader</h1>

<p align="center">
  基于 Electron 的桌面电子书阅读器<br/>
  内置 <a href="https://github.com/doosho/shu">doosho/shu</a> 书库 · 支持 TXT / EPUB / MOBI · 窗口 / 全屏 / 摸鱼三模式
</p>

<p align="center">
  <a href="README.md">简体中文</a> ·
  <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/masterball-w/txt_book_reader/releases/latest"><img src="https://img.shields.io/github/v/release/masterball-w/txt_book_reader?style=flat-square&label=release" alt="release"/></a>
  <a href="https://github.com/masterball-w/txt_book_reader/releases"><img src="https://img.shields.io/github/downloads/masterball-w/txt_book_reader/total?style=flat-square" alt="downloads"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/masterball-w/txt_book_reader?style=flat-square" alt="license"/></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-30-47848F?style=flat-square&logo=electron&logoColor=white" alt="electron"/></a>
  <a href="https://github.com/masterball-w/txt_book_reader/releases"><img src="https://img.shields.io/badge/platform-Windows%20x64-0078D4?style=flat-square&logo=windows&logoColor=white" alt="windows"/></a>
  <img src="https://img.shields.io/badge/formats-TXT%20%7C%20EPUB%20%7C%20MOBI-e94560?style=flat-square" alt="formats"/>
</p>

<p align="center">
  <a href="https://github.com/masterball-w/txt_book_reader/releases/latest"><strong>下载最新安装包</strong></a>
  ·
  <a href="#安装与运行">从源码运行</a>
  ·
  <a href="#更新日志">更新日志</a>
</p>

---

## 亮点

| | |
|:---|:---|
| **三种阅读模式** | 窗口 · 全屏 · 摸鱼（透明置顶长条，`` Ctrl+` `` 隐藏） |
| **内置书库** | cn / en / yi，约 2200+ 本 TXT（[doosho/shu](https://github.com/doosho/shu)） |
| **外部导入** | TXT / EPUB / MOBI；窗口与全屏支持 EPUB/MOBI 插图 |
| **阅读辅助** | 书签、书架、章节跳转、全文搜索、主题与屏幕取色 |

![阅读界面](docs/screenshots/阅读界面.png)

---

## 更新日志

按日期倒序，最新在上。

### 2026-07-17 · v1.2.0

- **外部导入**：侧栏「导入」支持 TXT / EPUB / MOBI；文件落在用户目录 `imported-books/`
- **格式适配器**：可平行扩展；PDF / AZW3 / FB2 等为 TODO
- **EPUB/MOBI 插图**：窗口与全屏显示内嵌图片；摸鱼模式仍为纯文本
- **本地启动器**：`ShuReader.exe` 替代 `start.bat`（仅源码目录用，不进安装包）
- **构建隔离**：`npm run build` 与 `build:launcher` 相互独立

![导入新格式](docs/screenshots/导入新格式.png)

安装包：[`ShuReader-Setup-1.2.0-x64.exe`](https://github.com/masterball-w/txt_book_reader/releases/tag/v1.2.0)

---

### 2026-07-13 · v1.1.0

- 摸鱼模式吞字修复（DOM 测量 + 中间取样 + 页码预留宽度）
- 窗口 / 全屏按章节边界分页；章节解析与 TOC 匹配增强
- NSIS 安装包：自定义路径、权限检查、安装日志
- README 融入功能截图

安装包：[`ShuReader-Setup-1.1.0-x64.exe`](https://github.com/masterball-w/txt_book_reader/releases/tag/v1.1.0)

---

### 2026-07-10 · v1.0.0

- 初版：窗口 / 全屏 / 摸鱼三模式
- 内置书库检索、书签书架、主题与屏幕取色
- 章节跳转；跨模式以行索引统一进度

---

## 功能概览

### 阅读模式

![阅读模式](docs/screenshots/阅读模式.png)

- **窗口模式** — 标准窗口，工具栏可操作
- **全屏模式** — 沉浸阅读，悬停显示工具栏
- **摸鱼模式** — 透明置顶长条，`` Ctrl+` `` 一键隐藏

![摸鱼模式的阅读界面](docs/screenshots/摸鱼模式的阅读界面.png)

### 搜索 / 书签 / 主题

![搜索书籍](docs/screenshots/搜索书籍.png)

![自定义主题和字号](docs/screenshots/自定义主题和字号.png)

- 书名模糊 / 精确、作者、全文搜索
- 书签、书架、阅读时长
- 暗色 / 亮色 / 护眼 / 夜间；屏幕取色；跟随系统

### 快捷键

| 快捷键 | 功能 | 模式 |
|--------|------|------|
| `←` / `PageUp` | 上一页 | 全部 |
| `→` / `PageDown` / `空格` | 下一页 | 全部 |
| `Ctrl + B` | 保存书签 | 全部 |
| `` Ctrl + ` `` | 显示/隐藏摸鱼窗口 | 全局 |
| `Ctrl + Shift + M` | 打开摸鱼模式 | 全局 |
| `H` | 隐藏摸鱼窗口 | 摸鱼 |
| `Esc` | 退出全屏 | 全屏 |

---

## 安装与运行

### 方式一：安装包（推荐）

1. 打开 [Releases](https://github.com/masterball-w/txt_book_reader/releases/latest)
2. 下载 `ShuReader-Setup-*-x64.exe`
3. 安装后从桌面或开始菜单启动

### 方式二：源码运行

需要 Node.js 16+。

```bash
git clone --recursive https://github.com/masterball-w/txt_book_reader.git
cd txt_book_reader
npm install
```

| 方式 | 命令 / 操作 |
|------|-------------|
| Windows 推荐 | 双击 `ShuReader.exe` |
| npm | `npm start` |
| 开发（DevTools） | `npm run dev` 或 `ShuReader.exe --dev` |
| 重编译启动器 | `npm run build:launcher`（可选） |
| 打安装包 | `npm run build` → `dist/ShuReader-Setup-<ver>-x64.exe` |

> `ShuReader.exe` / `tools/launcher` **不会**打进安装包；`npm run build` 不会自动跑 `build:launcher`。

---

## 项目结构

```
txt_book_reader/
├── ShuReader.exe       # 本地开发启动器（不进入安装包）
├── main.js / preload.js / launch.js
├── lib/                # 格式适配器与导入书库
├── src/                # 书库 UI 与阅读器
├── tools/launcher/     # 启动器源码
├── docs/
│   ├── social-preview.png
│   └── screenshots/
└── shu/                # Git 子模块书库（cn / en / yi）
```

---

## 书库资源

来自 **[doosho/shu](https://github.com/doosho/shu)**：

| 目录 | 说明 | 约数量 |
|------|------|--------|
| `shu/cn/` | 中文 | 1645 |
| `shu/en/` | 英文 | 135 |
| `shu/yi/` | 译文 | 424 |

本地导入保存在 `%APPDATA%/书库阅读器/imported-books/`，不写入 `shu/`。

---

## 致谢

感谢 [dooshu](https://github.com/doosho) 的开源书库 [doosho/shu](https://github.com/doosho/shu)。书籍版权归原作者；本项目仅作阅读工具。


## 仓库元数据

- **Topics**：electron · ebook-reader · epub · mobi · txt · desktop-app · windows · book-reader · chinese · nsis
- **Social preview**：请将 [docs/social-preview.jpg](docs/social-preview.jpg)（1280×640，<1MB）上传到 [仓库 Settings → Social preview](https://github.com/masterball-w/txt_book_reader/settings)

## License

[MIT](LICENSE)