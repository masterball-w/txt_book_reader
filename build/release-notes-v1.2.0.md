## 书库阅读器 v1.2.0（2026-07-17）

### 新功能

- **外部导入**：侧栏「导入」支持 TXT / EPUB / MOBI，文件复制到用户数据目录 `imported-books/`
- **格式适配器**：可平行扩展更多格式（PDF 等暂为 TODO）
- **EPUB/MOBI 插图**：窗口与全屏模式显示内嵌图片；摸鱼模式仍为纯文本
- **本地启动器**：根目录 `ShuReader.exe` 替代 `start.bat`，仅用于源码目录双击启动

### 构建说明

- `npm start` / `npm run build` / electron-builder / NSIS 安装流程保持不变
- `ShuReader.exe` 与 `tools/launcher` **不进入**安装包（已在 `package.json` build.files 中排除）
- `npm run build:launcher` 为可选本地启动器重编译，不会在 `npm run build` 中自动执行

### 安装方法

1. 下载 `ShuReader-Setup-1.2.0-x64.exe`
2. 双击运行，选择安装路径
3. 从桌面快捷方式或开始菜单启动