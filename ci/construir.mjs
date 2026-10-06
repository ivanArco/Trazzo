// Fase de CONSTRUCCIÓN de Trazzo
// 1) Revisa que el código no tenga errores  2) Arma la carpeta public/ (el artefacto)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const version = process.env.CI_COMMIT_SHORT_SHA || 'local';
let errores = 0;
const ok = (msg) => console.log('  ✔ ' + msg);
const falla = (msg) => { console.error('  ✘ ' + msg); errores++; };

// Revisa que un texto sea JavaScript válido (sin ejecutarlo)
function revisarJS(codigo, nombre, archivo = nombre, lineaInicial = 0) {
  try {
    new vm.Script(codigo, { filename: archivo, lineOffset: lineaInicial });
    ok(`${nombre}: sintaxis JavaScript correcta`);
  } catch (e) {
    const donde = (e.stack || '').split('\n')[0]; // archivo:línea donde está el error
    falla(`${nombre}: ${e.message} -> ${donde}`);
  }
}

console.log('1. Revisando el código');
const html = fs.readFileSync('index.html', 'utf8');

// JavaScript dentro de index.html
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
scripts.forEach((m, i) => {
  const inicio = m.index + m[0].indexOf('>') + 1;
  const linea = html.slice(0, inicio).split('\n').length - 1;
  revisarJS(m[1], `index.html (script ${i + 1})`, 'index.html', linea);
});

// Service worker
revisarJS(fs.readFileSync('sw.js', 'utf8'), 'sw.js');

// manifest.json
let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  ok('manifest.json: JSON válido');
} catch (e) {
  falla('manifest.json: ' + e.message);
}

console.log('\n2. Revisando que existan todos los archivos que usa la página');
const referencias = new Set();
for (const m of html.matchAll(/\b(?:src|href|poster)="([^"#]+)"/g)) {
  const ruta = m[1];
  if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(ruta)) continue;
  referencias.add(ruta.replace(/^\.\//, ''));
}
manifest?.icons?.forEach((ic) => referencias.add(ic.src));
const sw = fs.readFileSync('sw.js', 'utf8');
for (const m of sw.matchAll(/'\.\/([^']+)'/g)) referencias.add(m[1]);

for (const ruta of [...referencias].sort()) {
  fs.existsSync(ruta) ? ok(ruta) : falla(`Falta el archivo: ${ruta}`);
}

if (errores > 0) {
  console.error(`\nCONSTRUCCIÓN FALLIDA: ${errores} error(es)`);
  process.exit(1);
}

console.log('\n3. Armando el artefacto en public/');
fs.rmSync('public', { recursive: true, force: true });
fs.mkdirSync('public');
for (const item of ['index.html', 'manifest.json', 'sw.js', 'css', 'img', 'icons', 'video']) {
  if (fs.existsSync(item)) fs.cpSync(item, path.join('public', item), { recursive: true });
}

// Versión automática del caché: ya no hay que cambiarla a mano en sw.js
const swPublic = path.join('public', 'sw.js');
const swNuevo = fs.readFileSync(swPublic, 'utf8')
  .replace(/const CACHE = '[^']*';/, `const CACHE = 'trazzo-${version}';`);
fs.writeFileSync(swPublic, swNuevo);
ok(`Versión del caché: trazzo-${version}`);

let total = 0;
const contar = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .forEach((d) => d.isDirectory() ? contar(path.join(dir, d.name)) : total++);
contar('public');
console.log(`\nCONSTRUCCIÓN EXITOSA: ${total} archivos listos en public/`);
