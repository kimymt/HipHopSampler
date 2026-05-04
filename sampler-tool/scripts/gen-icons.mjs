// Generate PWA PNG icons from public/icon.svg and public/icon-maskable.svg.
// Run: node scripts/gen-icons.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');

const sources = [
  { svg: 'icon.svg',          out: 'pwa-192.png',           size: 192 },
  { svg: 'icon.svg',          out: 'pwa-512.png',           size: 512 },
  { svg: 'icon.svg',          out: 'apple-touch-icon.png',  size: 180 },
  { svg: 'icon.svg',          out: 'favicon-32.png',        size: 32  },
  { svg: 'icon.svg',          out: 'favicon-16.png',        size: 16  },
  { svg: 'icon-maskable.svg', out: 'pwa-512-maskable.png',  size: 512 },
  { svg: 'icon-maskable.svg', out: 'pwa-192-maskable.png',  size: 192 },
];

await mkdir(publicDir, { recursive: true });

for (const { svg, out, size } of sources) {
  const svgBuf = await readFile(resolve(publicDir, svg));
  const pngBuf = await sharp(svgBuf, { density: Math.max(72, size * 2) })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(publicDir, out), pngBuf);
  console.log(`✓ ${out} (${size}x${size})`);
}
