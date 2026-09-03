const { spawn, spawnSync } = require('child_process');
const http = require('http');

const isWindows = process.platform === 'win32';
const command = (name) => (isWindows ? `${name}.cmd` : name);
const wirelessMode = process.env.ANDROID_LIVE_RELOAD === 'wireless';
const adbPath = isWindows
  ? `${process.env.ANDROID_HOME || 'C:\\Users\\Paltech\\AppData\\Local\\Android\\Sdk'}\\platform-tools\\adb.exe`
  : 'adb';

const getWirelessTarget = () => {
  const result = spawnSync(adbPath, ['devices'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return null;
  const wirelessDevice = result.stdout
    .split(/\r?\n/)
    .find((line) => {
      if (!line.endsWith('\tdevice')) return false;
      const serial = line.split('\t')[0];
      return (serial.startsWith('adb-') && serial.includes('_adb-tls-connect._tcp'))
        || /^\d+\.\d+\.\d+\.\d+:\d+$/.test(serial);
    });
  return wirelessDevice ? wirelessDevice.split('\t')[0] : null;
};

const reconnectWirelessTarget = () => {
  const target = getWirelessTarget();
  if (target) return target;
  const result = spawnSync(adbPath, ['connect', '192.168.100.33:5555'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return null;
  return getWirelessTarget();
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

const wirelessTarget = reconnectWirelessTarget();
if (!wirelessTarget) {
  console.error('No wireless Android device found. Pair Wireless Debugging, then run adb connect PHONE_IP:PORT.');
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
    const capacitorArgs = [
      'cap', 'run', 'android',
      '--no-sync',
      '--live-reload',
      '--host', '127.0.0.1',
      '--port', '3000',
      '--forwardPorts', '3000:3000',
      '--target', wirelessTarget,
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
