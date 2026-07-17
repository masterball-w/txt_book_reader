<p align="center">
  <img src="docs/social-preview.png" alt="ShuReader" width="860"/>
</p>

<h1 align="center">ShuReader · TXT Book Reader</h1>

<p align="center">
  An Electron desktop ebook reader<br/>
  Built-in <a href="https://github.com/doosho/shu">doosho/shu</a> library · TXT / EPUB / MOBI · Window / Fullscreen / Stealth modes
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
  <a href="https://github.com/masterball-w/txt_book_reader/releases/latest"><strong>Download latest installer</strong></a>
  ·
  <a href="#install--run">Run from source</a>
  ·
  <a href="#changelog">Changelog</a>
</p>

---

## Highlights

| | |
|:---|:---|
| **Three reading modes** | Window · Fullscreen · Stealth (always-on-top bar, `` Ctrl+` `` to hide) |
| **Built-in library** | cn / en / yi, 2200+ TXT books ([doosho/shu](https://github.com/doosho/shu)) |
| **Import** | TXT / EPUB / MOBI; embedded images in window & fullscreen for EPUB/MOBI |
| **Reading tools** | Bookmarks, shelf, chapter jump, full-text search, themes & screen color picker |

![Reader UI](docs/screenshots/阅读界面.png)

---

## Changelog

Newest first.

### 2026-07-17 · v1.2.0

- **Import**: sidebar Import for TXT / EPUB / MOBI → `%APPDATA%/.../imported-books/`
- **Format adapters**: pluggable formats; PDF / AZW3 / FB2 still TODO
- **EPUB/MOBI images**: shown in window/fullscreen; stealth mode stays text-only
- **Local launcher**: `ShuReader.exe` replaces `start.bat` (dev only, not packaged)
- **Build isolation**: `npm run build` vs optional `build:launcher`

![Import formats](docs/screenshots/导入新格式.png)

Installer: [`ShuReader-Setup-1.2.0-x64.exe`](https://github.com/masterball-w/txt_book_reader/releases/tag/v1.2.0)

---

### 2026-07-13 · v1.1.0

- Stealth mode text clipping fix (DOM measure + mid-text sampling + page-number width)
- Chapter-boundary paging; stronger TOC matching
- NSIS installer: custom path, permission checks, install log
- README screenshots

Installer: [`ShuReader-Setup-1.1.0-x64.exe`](https://github.com/masterball-w/txt_book_reader/releases/tag/v1.1.0)

---

### 2026-07-10 · v1.0.0

- Initial release: three reading modes
- Library search, bookmarks/shelf, themes & color picker
- Chapter navigation; line-index progress across modes

---

## Features

### Reading modes

![Reading modes](docs/screenshots/阅读模式.png)

- **Window** — standard window with toolbar
- **Fullscreen** — immersive; toolbar on hover
- **Stealth** — transparent always-on-top strip; `` Ctrl+` `` to toggle

![Stealth mode](docs/screenshots/摸鱼模式的阅读界面.png)

### Search / bookmarks / themes

![Search](docs/screenshots/搜索书籍.png)

![Themes](docs/screenshots/自定义主题和字号.png)

### Shortcuts

| Shortcut | Action | Mode |
|----------|--------|------|
| `←` / `PageUp` | Previous page | All |
| `→` / `PageDown` / `Space` | Next page | All |
| `Ctrl + B` | Bookmark | All |
| `` Ctrl + ` `` | Show/hide stealth window | Global |
| `Ctrl + Shift + M` | Open stealth mode | Global |
| `H` | Hide stealth window | Stealth |
| `Esc` | Exit fullscreen | Fullscreen |

---

## Install & run

### Option A: Installer (recommended)

Download `ShuReader-Setup-*-x64.exe` from [Releases](https://github.com/masterball-w/txt_book_reader/releases/latest).

### Option B: From source

Requires Node.js 16+.

```bash
git clone --recursive https://github.com/masterball-w/txt_book_reader.git
cd txt_book_reader
npm install
```

| | |
|--|--|
| Windows | Double-click `ShuReader.exe` |
| npm | `npm start` |
| DevTools | `npm run dev` or `ShuReader.exe --dev` |
| Rebuild launcher | `npm run build:launcher` (optional) |
| Package installer | `npm run build` |

> `ShuReader.exe` / `tools/launcher` are **not** included in the NSIS package.

---

## Project layout

```
txt_book_reader/
├── ShuReader.exe       # local launcher (not packaged)
├── main.js / preload.js / launch.js
├── lib/                # format adapters & import store
├── src/                # UI
├── tools/launcher/
├── docs/
│   ├── social-preview.png
│   └── screenshots/
└── shu/                # book submodule (cn / en / yi)
```

---

## Book resources

From **[doosho/shu](https://github.com/doosho/shu)**:

| Path | Language | ~Count |
|------|----------|--------|
| `shu/cn/` | Chinese | 1645 |
| `shu/en/` | English | 135 |
| `shu/yi/` | Translated | 424 |

Imported books live under userData `imported-books/`, not inside `shu/`.

---

## Credits

Thanks to [dooshu](https://github.com/doosho) for [doosho/shu](https://github.com/doosho/shu). Book copyrights belong to original authors; this app is a reader only.


## Repository metadata

- **Topics**: electron · ebook-reader · epub · mobi · txt · desktop-app · windows · book-reader · chinese · nsis
- **Social preview**: upload [docs/social-preview.jpg](docs/social-preview.jpg) (1280×640, under 1MB) at [Settings → Social preview](https://github.com/masterball-w/txt_book_reader/settings)

## License

[MIT](LICENSE)