// VERIFICACION del backend: lo ejecuta de verdad y comprueba que responda.
// Detecta errores que la revision de sintaxis no ve (por ejemplo, una variable que no existe).
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const archivo = process.env.BACKEND || 'server.js';
const puerto = process.env.PUERTO || '3000';
const url = 'http://127.0.0.1:' + puerto + '/';

if (!fs.existsSync(archivo)) {
  console.error('[ERROR] No existe el archivo del backend: ' + archivo);
  process.exit(1);
}

console.log('Iniciando el backend: node ' + archivo);
const proceso = spawn(process.execPath, [archivo], { stdio: ['ignore', 'pipe', 'pipe'] });
let salida = '';
proceso.stdout.on('data', (d) => { salida += d; process.stdout.write(d); });
proceso.stderr.on('data', (d) => { salida += d; process.stderr.write(d); });

let terminoSolo = false;
proceso.on('exit', () => { terminoSolo = true; });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
for (let intento = 1; intento <= 20; intento++) {
  await esperar(500);
  if (terminoSolo) {
    console.error('');
    console.error('[ERROR] El backend se detuvo al arrancar (ver el error de arriba)');
    console.error('VERIFICACION FALLIDA');
    process.exit(1);
  }
  try {
    const res = await fetch(url);
    const texto = await res.text();
    console.log('');
    console.log('[OK] ' + url + ' respondio ' + res.status + ': ' + texto.trim());
    proceso.kill();
    if (res.status !== 200) {
      console.error('VERIFICACION FALLIDA');
      process.exit(1);
    }
    console.log('VERIFICACION EXITOSA: el backend funciona');
    process.exit(0);
  } catch {
    // todavia no esta listo; se vuelve a intentar
  }
}
proceso.kill();
console.error('[ERROR] El backend no respondio en ' + url);
console.error('VERIFICACION FALLIDA');
process.exit(1);
