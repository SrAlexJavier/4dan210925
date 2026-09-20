/**
 * Extrae el color dominante de cada foto y lo escribe en `content.json`.
 *
 * Se ejecuta UNA VEZ en tiempo de desarrollo, cuando cambian las fotos:
 *
 *   npx playwright install chromium   # solo la primera vez
 *   node scripts/extract-dominant.mjs
 *
 * Escala cada JPEG a 1x1 px en un canvas y vuelca el hex. `dominantColor` es
 * lo que cubre el hueco mientras la foto decodifica: sin el, el punto 3 de la
 * estrategia de carga muestra un gris generico en lugar del tono de la foto.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const JSON_PATH = new URL('../src/data/content.json', import.meta.url);
const PUBLIC_DIR = new URL('../public', import.meta.url);

const content = JSON.parse(await readFile(JSON_PATH, 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage();

for (const photo of content.album.photos) {
  const file = new URL('.' + photo.src, PUBLIC_DIR + '/');
  const dataUrl =
    'data:image/jpeg;base64,' + (await readFile(file)).toString('base64');

  const hex = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  }, dataUrl);

  console.log(`${photo.id.padEnd(10)} ${photo.dominantColor} -> ${hex}`);
  photo.dominantColor = hex;
}

await browser.close();
await writeFile(JSON_PATH, JSON.stringify(content, null, 2) + '\n');
console.log('content.json actualizado');
