// VERIFICACIÓN del artefacto: levanta public/ como servidor web
// y comprueba que la página y todos sus archivos respondan.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve('public');
const tipos = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };

const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.join(raiz, ruta);
  if (!archivo.startsWith(raiz) || !fs.existsSync(archivo)) {
    res.writeHead(404); return res.end('No encontrado');
  }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(archivo)] || 'application/octet-stream' });
  fs.createReadStream(archivo).pipe(res);
});

await new Promise((r) => servidor.listen(8080, '127.0.0.1', r));
console.log('Sitio levantado en http://127.0.0.1:8080\n');

let errores = 0;
async function probar(url, revisar) {
  const res = await fetch('http://127.0.0.1:8080' + url);
  const texto = await res.text();
  if (res.status !== 200) { console.error(`  ✘ ${url} respondió ${res.status}`); errores++; return; }
  if (revisar && !revisar(texto)) { console.error(`  ✘ ${url} no tiene el contenido esperado`); errores++; return; }
  console.log(`  ✔ ${url} (200)`);
}

await probar('/', (t) => t.includes('<title>Trazzo'));
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const locales = [...html.matchAll(/\b(?:src|href|poster)="([^"#]+)"/g)]
  .map((m) => m[1]).filter((r) => !/^(https?:|mailto:|tel:|data:|\/\/)/.test(r));
for (const r of new Set([...locales, 'sw.js', 'manifest.json'])) await probar('/' + r.replace(/^\.\//, ''));

servidor.close();
if (errores) { console.error(`\nVERIFICACIÓN FALLIDA: ${errores} error(es)`); process.exit(1); }
console.log('\nVERIFICACIÓN EXITOSA: el artefacto funciona');