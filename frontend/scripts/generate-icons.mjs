/**
 * Genera los íconos de la PWA (public/icons) y las pantallas de carga de iOS (public/splash)
 * a partir de la misma geometría de LogoMark (src/components/common/Logo.jsx).
 * Sin dependencias: dibuja cada píxel y escribe el PNG con node:zlib.
 *
 * Uso (desde frontend/, con Node 22.2 o superior por zlib.crc32): npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Mismos valores que LogoMark, en su cuadrícula de 32 × 32.
const GRID = 32;
const TILE_RADIUS = 9;
const GRADIENT_FROM = [0x61, 0x42, 0xff];
const GRADIENT_TO = [0x8b, 0x66, 0xff];
const BARS = [
  { x: 8, y: 17, width: 4, height: 7, radius: 1.5, opacity: 0.55 },
  { x: 14, y: 12, width: 4, height: 12, radius: 1.5, opacity: 0.8 },
  { x: 20, y: 7, width: 4, height: 17, radius: 1.5, opacity: 1 },
];

// Fondo de las pantallas de carga: coincide con background_color del manifest.
const SPLASH_BACKGROUND = [0, 0, 0];
const SPLASH_SIZES = [
  [750, 1334],
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1290, 2796],
  [1640, 2360],
];

// Matriz de Bayer: reparte el redondeo a 8 bits para que el degradado no forme escalones visibles.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Distancia con signo a un rectángulo redondeado: negativa adentro, positiva afuera. */
function roundedRectDistance(px, py, x, y, width, height, radius) {
  const qx = Math.abs(px - (x + width / 2)) - width / 2 + radius;
  const qy = Math.abs(py - (y + height / 2)) - height / 2 + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Cobertura del píxel (0 a 1) según su distancia al borde, medida en píxeles: suaviza el contorno. */
const coverage = (distance) => Math.min(Math.max(0.5 - distance, 0), 1);

const mix = (from, to, amount) => from + (to - from) * amount;

/**
 * Pinta el logo sobre un lienzo RGBA.
 * @param {{ pixels: Float64Array, width: number, height: number }} canvas
 * @param {{ left: number, top: number, size: number, artScale?: number, rounded?: boolean }} options
 * `artScale` encoge solo las barras (ícono maskable); `rounded: false` llena el cuadro entero.
 */
function drawLogo({ pixels, width, height }, { left, top, size, artScale = 1, rounded = true }) {
  const scale = size / GRID;
  const radius = rounded ? TILE_RADIUS * scale : 0;
  const endX = Math.min(width, Math.ceil(left + size));
  const endY = Math.min(height, Math.ceil(top + size));

  for (let y = Math.max(0, Math.floor(top)); y < endY; y += 1) {
    for (let x = Math.max(0, Math.floor(left)); x < endX; x += 1) {
      const px = x + 0.5 - left;
      const py = y + 0.5 - top;
      const tile = coverage(roundedRectDistance(px, py, 0, 0, size, size, radius));
      if (tile === 0) continue;

      // Degradado diagonal, igual que x1=0 y1=0 x2=1 y2=1 en el SVG.
      const amount = (px + py) / (2 * size);
      const color = GRADIENT_FROM.map((value, channel) => mix(value, GRADIENT_TO[channel], amount));

      // Las barras se escalan respecto al centro del cuadro.
      const artX = (px - size / 2) / (scale * artScale) + GRID / 2;
      const artY = (py - size / 2) / (scale * artScale) + GRID / 2;
      const artPixel = 1 / (scale * artScale);
      for (const bar of BARS) {
        const distance =
          roundedRectDistance(artX, artY, bar.x, bar.y, bar.width, bar.height, bar.radius) / artPixel;
        const white = coverage(distance) * bar.opacity;
        for (let channel = 0; channel < 3; channel += 1) {
          color[channel] = mix(color[channel], 255, white);
        }
      }

      const offset = (y * width + x) * 4;
      const below = pixels[offset + 3];
      const alpha = tile + below * (1 - tile);
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] =
          (color[channel] * tile + pixels[offset + channel] * below * (1 - tile)) / alpha;
      }
      pixels[offset + 3] = alpha;
    }
  }
}

function createCanvas(width, height, background) {
  const pixels = new Float64Array(width * height * 4);
  if (background) {
    for (let offset = 0; offset < pixels.length; offset += 4) {
      pixels.set([...background, 1], offset);
    }
  }
  return { pixels, width, height };
}

function pngChunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/** Convierte el lienzo a PNG. Sin transparencia usa RGB: iOS pide el apple-touch-icon opaco. */
function encodePng({ pixels, width, height }, { transparent }) {
  const channels = transparent ? 4 : 3;
  const rowLength = width * channels + 1;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowLength;
    for (let x = 0; x < width; x += 1) {
      const threshold = (BAYER[y % 4][x % 4] + 0.5) / 16;
      const source = (y * width + x) * 4;
      const target = rowStart + 1 + x * channels;
      for (let channel = 0; channel < 3; channel += 1) {
        raw[target + channel] = Math.min(Math.floor(pixels[source + channel] + threshold), 255);
      }
      if (transparent) raw[target + 3] = Math.round(pixels[source + 3] * 255);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits por canal
  header[9] = transparent ? 6 : 2; // 6: RGBA, 2: RGB

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function save(relativePath, canvas, { transparent = false } = {}) {
  const path = join(PUBLIC_DIR, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(canvas, { transparent }));
  console.log(`  ${relativePath}`);
}

function icon(relativePath, size, options) {
  const canvas = createCanvas(size, size);
  drawLogo(canvas, { left: 0, top: 0, size, ...options });
  save(relativePath, canvas, { transparent: options.rounded !== false });
}

function splash(width, height) {
  const canvas = createCanvas(width, height, SPLASH_BACKGROUND);
  const size = Math.round(Math.min(width * 0.28, height * 0.14));
  drawLogo(canvas, { left: Math.round((width - size) / 2), top: Math.round((height - size) / 2), size });
  save(`splash/splash-${width}x${height}.png`, canvas);
}

console.log('Generando íconos y pantallas de carga:');
icon('icons/icon-192.png', 192, {});
icon('icons/icon-512.png', 512, {});
// Sin esquinas: iOS y Android recortan el ícono con su propia máscara.
icon('icons/apple-touch-icon.png', 180, { rounded: false });
// Las barras más pequeñas para que quepan en la zona segura (círculo central del 80 %).
icon('icons/maskable-512.png', 512, { rounded: false, artScale: 0.8 });
for (const [width, height] of SPLASH_SIZES) splash(width, height);
