import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svg = readFileSync(join(publicDir, 'icon.svg'), 'utf8');

// Minimal valid PNG (1x1) placeholders — replace with proper assets via design tool if needed.
// For dev/PWA install, copy SVG as fallback via manifest icon.svg entry.
const png192 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
writeFileSync(join(publicDir, 'icon-192.png'), png192);
writeFileSync(join(publicDir, 'icon-512.png'), png192);
console.log('PWA icons written (placeholder PNG). SVG source:', svg.length, 'bytes');
