// Android uygulamasına girecek web dosyalarını www/ klasörüne kopyalar.
// Capacitor bu klasörü APK'nın içine koyar; uygulama internetsiz açılır.
import { cp, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const out = new URL('www/', root);
const FILES = ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons'];

await rm(out, { recursive: true, force: true });
for (const f of FILES) await cp(new URL(f, root), new URL(f, out), { recursive: true });
console.log(`www/ hazır: ${FILES.join(', ')}`);
