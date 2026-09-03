const { spawnSync } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const gradle = isWindows ? 'gradlew.bat' : './gradlew';
const result = spawnSync(gradle, ['assembleDebug'], {
  cwd: path.resolve(__dirname, '..', 'android'),
  shell: isWindows,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
