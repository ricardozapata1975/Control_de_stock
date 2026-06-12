// Genera íconos PWA cuadrados a partir de public/pwa-icon.svg
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../public/pwa-icon.svg');
const OUT = join(__dirname, '../public');

mkdirSync(OUT, { recursive: true });

async function makeIcon(size, scale, file, background) {
  const logoSize = Math.round(size * scale);
  const logo = await sharp(SRC, { density: 300 })
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(OUT, file));

  console.log(`OK ${file}`);
}

const white = { r: 255, g: 255, b: 255, alpha: 1 };
const dark = { r: 2, g: 6, b: 23, alpha: 1 };

await makeIcon(192, 0.85, 'pwa-192x192.png', white);
await makeIcon(512, 0.85, 'pwa-512x512.png', white);
await makeIcon(512, 0.65, 'pwa-maskable-512x512.png', dark);
await makeIcon(180, 0.85, 'apple-touch-icon.png', white);
await makeIcon(64, 0.9, 'favicon-64x64.png', white);
