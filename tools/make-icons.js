// icons/icon.svg'den iOS ve manifest için PNG ikonlar, Android için başlatıcı
// ikonları ve açılış ekranlarını üretir.
import { chromium } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';

const svg = await readFile(new URL('../icons/icon.svg', import.meta.url), 'utf8');
const res = new URL('../android/app/src/main/res/', import.meta.url);
const browser = await chromium.launch();

async function shot(url, width, height, html, omitBackground = false) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${html}`);
  await page.screenshot({ path: url.pathname, omitBackground });
  await page.close();
}
const sized = (s, extra = '') => svg.replace('<svg ', `<svg width="${s}" height="${s}" style="${extra}" `);

for (const size of [180, 192, 512]) {
  await shot(new URL(`../icons/icon-${size}.png`, import.meta.url), size, size, sized(size));
}

// Android uyarlanabilir ikon: zemin rengi values/ic_launcher_background.xml'de,
// işaretler 108 birimlik katmanın ortadaki 66 birimlik güvenli alanında.
const marks = svg.replace(/<rect[^>]*\/>/, '');
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITY)) {
  const dir = new URL(`mipmap-${d}/`, res);
  const icon = 48 * k;
  await shot(new URL('ic_launcher.png', dir), icon, icon, sized(icon));
  await shot(new URL('ic_launcher_round.png', dir), icon, icon,
    sized(icon, 'border-radius:50%'), true);
  const layer = 108 * k;
  const inner = 60 * k;
  await shot(new URL('ic_launcher_foreground.png', dir), layer, layer,
    marks.replace('<svg ', `<svg width="${inner}" height="${inner}" style="margin:${(layer - inner) / 2}px" `), true);
}

// Android 11 ve altı açılış ekranı: uygulama zemini üzerinde ortada ikon.
for (const dir of await readdir(res)) {
  if (!dir.startsWith('drawable')) continue;
  const url = new URL(`${dir}/splash.png`, res);
  const png = await readFile(url).catch(() => null);
  if (!png) continue;
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const icon = Math.round(Math.min(width, height) * 0.3);
  await shot(url, width, height,
    `<div style="width:${width}px;height:${height}px;background:#f6f4ee;display:grid;place-items:center">` +
    sized(icon, `border-radius:${icon * 0.22}px`) + '</div>');
}

await browser.close();
