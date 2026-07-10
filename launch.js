// 启动脚本 - 清除可能存在的 ELECTRON_RUN_AS_NODE 环境变量后启动 Electron
const { execSync } = require('child_process');
const path = require('path');

// 构建干净的环境变量（移除 ELECTRON_RUN_AS_NODE）
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const args = process.argv.slice(2).join(' ');

try {
  execSync(`"${electronPath}" . ${args}`, {
    stdio: 'inherit',
    env: env,
    cwd: __dirname
  });
} catch (e) {
  // 用户关闭窗口时会返回非零退出码，这是正常的
  if (e.status && e.status !== 0) {
    console.error('启动失败:', e.message);
  }
}
