const { spawn, spawnSync } = require('child_process');
const http = require('http');

const isWindows = process.platform === 'win32';
const command = (name) => (isWindows ? `${name}.cmd` : name);
const wirelessMode = process.env.ANDROID_LIVE_RELOAD === 'wireless';
const liveReloadHost = process.env.CAPACITOR_LIVE_RELOAD_HOST || process.env.ANDROID_LIVE_RELOAD_HOST || '127.0.0.1';
const adbPath = isWindows
  ? `${process.env.ANDROID_HOME || 'C:\\Users\\Paltech\\AppData\\Local\\Android\\Sdk'}\\platform-tools\\adb.exe`
  : 'adb';

const getConnectedTarget = () => {
  const result = spawnSync(adbPath, ['devices'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return null;
  const devices = result.stdout
    .split(/\r?\n/)
    .find((line) => {
      if (!line.endsWith('\tdevice')) return false;
      const serial = line.split('\t')[0];
      return (serial.startsWith('adb-') && serial.includes('_adb-tls-connect._tcp'))
        || /^\d+\.\d+\.\d+\.\d+:\d+$/.test(serial);
    });
  if (devices) return devices.split('\t')[0];

  const usbDevice = result.stdout
    .split(/\r?\n/)
    .find((line) => line.endsWith('\tdevice'));
  return usbDevice ? usbDevice.split('\t')[0] : null;
};

const reconnectTarget = () => {
  const target = getConnectedTarget();
  if (target) return target;
  const result = spawnSync(adbPath, ['connect', '192.168.100.33:5555'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return null;
  return getConnectedTarget();
};

const waitForServer = (url, attempts = 60) => new Promise((resolve, reject) => {
  const check = (remaining) => {
    const request = http.get(url, (response) => {
      response.resume();
      if (response.statusCode) return resolve();
      retry(remaining);
    });
    request.on('error', () => retry(remaining));
    request.setTimeout(1000, () => {
      request.destroy();
      retry(remaining);
    });
  };
  const retry = (remaining) => {
    if (remaining <= 0) return reject(new Error(`Timed out waiting for ${url}`));
    setTimeout(() => check(remaining - 1), 500);
  };
  check(attempts);
});

const serverIsAvailable = (url) => new Promise((resolve) => {
  const request = http.get(url, (response) => {
    response.resume();
    resolve(Boolean(response.statusCode));
  });
  request.on('error', () => resolve(false));
  request.setTimeout(500, () => {
    request.destroy();
    resolve(false);
  });
});

if (!wirelessMode) {
  console.error('Wireless-only live reload is enabled. Run npm run android:live.');
  process.exit(1);
}

const deviceTarget = reconnectTarget();
if (!deviceTarget) {
  console.error('No Android device found. Connect a device with USB debugging or run adb connect PHONE_IP:PORT.');
  process.exit(1);
}

let npmStart;

const stop = () => {
  if (npmStart && !npmStart.killed) npmStart.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

serverIsAvailable('http://127.0.0.1:3000')
  .then((alreadyRunning) => {
    if (alreadyRunning) return;
    npmStart = spawn(command('npm'), ['start'], {
      env: {
        ...process.env,
        HOST: '0.0.0.0',
        PORT: '3000',
        REACT_APP_ANDROID_BUILD: 'true',
      },
      shell: isWindows,
      stdio: 'inherit',
    });
  })
  .then(() => waitForServer('http://127.0.0.1:3000'))
  .then(() => {
    const reverse = spawnSync(adbPath, ['-s', deviceTarget, 'reverse', 'tcp:3000', 'tcp:3000'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (reverse.status !== 0) {
      throw new Error(`Unable to create ADB reverse tunnel: ${reverse.stderr || reverse.stdout}`);
    }

    const capacitorArgs = [
      'cap', 'run', 'android',
      '--no-sync',
      '--live-reload',
      '--host', liveReloadHost,
      '--port', '3000',
      '--forwardPorts', '3000:3000',
      '--target', deviceTarget,
    ];

    const capacitor = spawn(command('npx'), capacitorArgs, {
      env: { ...process.env, CAPACITOR_LIVE_RELOAD: 'true' },
      shell: isWindows,
      stdio: 'inherit',
    });
    capacitor.on('exit', (code) => {
      stop();
      process.exit(code ?? 0);
    });
  })
  .catch((error) => {
    console.error(error.message);
    stop();
    process.exit(1);
  });
