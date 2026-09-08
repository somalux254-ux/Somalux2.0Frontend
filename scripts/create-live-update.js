const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver').default || require('archiver');

const buildDirectory = path.resolve(__dirname, '..', 'build');
const otaDirectory = path.join(buildDirectory, 'ota');
const bundlePath = path.join(otaDirectory, 'live-update.zip');
const manifestPath = path.join(otaDirectory, 'latest.json');
const bundleId = process.env.COMMIT_REF || `${Date.now()}`;

fs.mkdirSync(otaDirectory, { recursive: true });

const output = fs.createWriteStream(bundlePath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(bundlePath)).digest('hex');
  const siteUrl = process.env.URL || 'https://somalux.co.ke';

  fs.writeFileSync(manifestPath, JSON.stringify({
    bundleId,
    checksum,
    url: `${siteUrl}/ota/live-update.zip`,
  }, null, 2));

  console.log(`[LiveUpdate] Created ${bundlePath} (${archive.pointer()} bytes)`);
});

archive.on('error', (error) => {
  throw error;
});

archive.pipe(output);
archive.glob('**/*', {
  cwd: buildDirectory,
  ignore: ['ota/**'],
  dot: true,
});
archive.finalize();