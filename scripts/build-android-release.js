const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';
const gradle = isWindows ? 'gradlew.bat' : './gradlew';
const androidDir = path.resolve(__dirname, '..', 'android');
const propertiesPath = path.join(androidDir, 'keystore.properties');

if (!fs.existsSync(propertiesPath)) {
  console.error('Missing android/keystore.properties. Copy android/keystore.properties.example and configure the new SomaLux keystore.');
  process.exit(1);
}

const properties = Object.fromEntries(
  fs.readFileSync(propertiesPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => line.split('=').map((value) => value.trim()))
);
const keystorePath = path.resolve(androidDir, 'app', properties.storeFile || '');
if (!properties.storePassword || !properties.keyAlias || !properties.keyPassword || !fs.existsSync(keystorePath)) {
  console.error('SomaLux signing setup is incomplete. Configure android/keystore.properties and create the referenced keystore.');
  process.exit(1);
}

const result = spawnSync(gradle, ['assembleRelease'], {
  cwd: androidDir,
  shell: isWindows,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
