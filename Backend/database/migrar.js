// Prepara la base de datos de Trazzo. Se puede correr varias veces sin dañar nada.
//   pnpm migrar                                           -> crea tablas, actualiza roles y cifra contraseñas
//   pnpm migrar -- --admin "Nombre" correo@x.mx clave123  -> además crea un administrador
//   pnpm migrar -- --demo                                 -> además carga operadores y viajes de ejemplo
import fs from 'node:fs';
import bcrypt from 'bcrypt';
import pool from '../src/config/db.js';

const ROLES_NUEVOS = "'admin','capturista','operador','cliente'";
const EQUIVALENCIAS = { profesor: 'admin', estudiante: 'operador' }; // roles anteriores

const UNIDADES = [
  ['PUE-45-8K', 'Kenworth T680', 2022, 36000, 'GNP-7781-2026'],
  ['TLX-20-4R', 'Freightliner Cascadia', 2021, 34000, 'GNP-6620-2026'],
  ['GTO-88-1P', 'International LT', 2020, 32000, 'AXA-1180-2026'],
  ['QRO-12-3M', 'Kenworth T680', 2023, 36000, 'GNP-9012-2026'],
  ['VER-07-2C', 'Volvo VNL', 2019, 30000, 'QUA-4471-2026']
];

const OPERADORES_DEMO = [
  ['Juan Pérez', 'juan.perez@trazzo.mx'],
  ['Laura Méndez', 'laura@trazzo.mx'],
  ['Raúl Sánchez', 'raul@trazzo.mx']
];
const CLAVE_DEMO = 'trazzo123';

// 1. Tablas: ejecuta los CREATE TABLE IF NOT EXISTS de schema.sql
async function crearTablas() {
  const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
    .replace(/--.*$/gm, '');
  const sentencias = sql.split(';').map((s) => s.trim()).filter((s) => s.startsWith('CREATE TABLE'));
  for (const s of sentencias) await pool.query(s);
  console.log(`✔ Tablas listas: ${sentencias.length}`);
}

// 1b. Columnas agregadas después de crear la tabla viajes
async function agregarColumnas() {
  const nuevas = {
    distancia_km: 'DECIMAL(7, 1) NULL AFTER salida',
    duracion_min: 'INT NULL AFTER distancia_km'
  };
  const [existentes] = await pool.query("SHOW COLUMNS FROM viajes");
  for (const [columna, tipo] of Object.entries(nuevas)) {
    if (existentes.some((c) => c.Field === columna)) continue;
    await pool.query(`ALTER TABLE viajes ADD COLUMN ${columna} ${tipo}`);
    console.log(`✔ Columna agregada: viajes.${columna}`);
  }
}

// 2. Roles: amplía el ENUM, convierte los valores viejos y deja solo los nuevos
async function migrarRoles() {
  const [[columna]] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'rol'");
  const actuales = [...columna.Type.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const viejos = actuales.filter((r) => EQUIVALENCIAS[r]);

  if (viejos.length) {
    const todos = [...new Set([...actuales, 'admin', 'capturista', 'operador', 'cliente'])];
    await pool.query(`ALTER TABLE usuarios MODIFY rol ENUM(${todos.map((r) => `'${r}'`).join(',')}) NOT NULL`);
    for (const viejo of viejos) {
      const [r] = await pool.execute('UPDATE usuarios SET rol = ? WHERE rol = ?', [EQUIVALENCIAS[viejo], viejo]);
      console.log(`✔ Rol "${viejo}" → "${EQUIVALENCIAS[viejo]}" (${r.affectedRows} usuario/s)`);
    }
  }
  await pool.query(`ALTER TABLE usuarios MODIFY rol ENUM(${ROLES_NUEVOS}) NOT NULL`);
  console.log('✔ Roles disponibles: admin, capturista, operador, cliente');
}

// 3. Contraseñas en texto plano → hash de bcrypt (los hash empiezan con $2)
async function cifrarContraseñas() {
  const [planas] = await pool.query("SELECT id, contraseña FROM usuarios WHERE contraseña NOT LIKE '$2%'");
  for (const u of planas) {
    await pool.execute('UPDATE usuarios SET contraseña = ? WHERE id = ?', [await bcrypt.hash(u.contraseña, 10), u.id]);
  }
  console.log(`✔ Contraseñas cifradas: ${planas.length}`);
}

// 4. Flota inicial si no hay unidades
async function cargarUnidades() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM unidades');
  if (total > 0) return;
  for (const u of UNIDADES) {
    await pool.execute(
      'INSERT INTO unidades (placas, marca_modelo, anio, capacidad_kg, poliza) VALUES (?, ?, ?, ?, ?)', u
    );
  }
  console.log(`✔ Unidades cargadas: ${UNIDADES.length}`);
}

async function crearAdmin(args) {
  const [nombre, correo, clave] = args;
  if (!nombre || !correo || !clave || clave.length < 6) {
    throw new Error('Uso: pnpm migrar -- --admin "Nombre" correo@x.mx contraseña(6+ caracteres)');
  }
  await pool.execute(
    'INSERT INTO usuarios (nombre, correo, contraseña, rol) VALUES (?, ?, ?, ?)',
    [nombre, correo.toLowerCase(), await bcrypt.hash(clave, 10), 'admin']
  );
  console.log(`✔ Administrador creado: ${correo}`);
}

// 5. Datos de ejemplo para la presentación: 3 operadores y 4 viajes en distintos estados
async function cargarDemo() {
  const hash = await bcrypt.hash(CLAVE_DEMO, 10);
  for (const [nombre, correo] of OPERADORES_DEMO) {
    await pool.execute(
      "INSERT IGNORE INTO usuarios (nombre, correo, contraseña, rol) VALUES (?, ?, ?, 'operador')",
      [nombre, correo, hash]
    );
  }
  const [ops] = await pool.query(
    "SELECT id, nombre FROM usuarios WHERE correo IN ('juan.perez@trazzo.mx', 'laura@trazzo.mx') ORDER BY nombre"
  );
  const [uds] = await pool.query("SELECT id FROM unidades WHERE placas IN ('PUE-45-8K', 'QRO-12-3M') ORDER BY placas");
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM viajes');
  if (total > 0 || ops.length < 2 || uds.length < 2) {
    console.log('✔ Operadores de ejemplo listos (ya había viajes, no se agregaron más)');
    return;
  }

  // Formato "lugar, ciudad": la app muestra la ciudad (lo que va después de la última coma)
  // [origen, destino, mercancía, peso, flete, cliente, horas de salida, estado, avance, operador, unidad]
  const viajes = [
    ['Parque Industrial FINSA, Puebla', 'Azcapotzalco, CDMX', '24 tarimas de café tostado', 18000, 28400, 'Cafés de Veracruz', -2, 'en_ruta', 45, ops[0], uds[0]],
    ['Parque Industrial Querétaro, Querétaro', 'Zapopan, Guadalajara', 'Refacciones automotrices', 12000, 31500, 'Logística del Golfo, S. A.', -1, 'retraso', 70, ops[1], uds[1]],
    ['Puerto de Veracruz, Veracruz', 'Apodaca, Monterrey', 'Contenedor de 40 pies', 22000, 54000, 'Logística del Golfo, S. A.', 20, 'pendiente', 0, null, null],
    ['Ciudad Industrial Xicohténcatl, Tlaxcala', 'Lerma, Toluca', 'Rollos de tela', 9000, 16800, 'Textiles de Tlaxcala', 28, 'pendiente', 0, null, null]
  ];

  for (const [origen, destino, mercancia, peso, flete, cliente, horas, estado, avance, op, ud] of viajes) {
    const [r] = await pool.execute(
      `INSERT INTO viajes (origen, destino, mercancia, peso_kg, flete, cliente, salida, estado, avance, eta, operador_id, unidad_id)
       VALUES (?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? HOUR, ?, ?, IF(? > 0, NOW() + INTERVAL ? MINUTE, NULL), ?, ?)`,
      [origen, destino, mercancia, peso, flete, cliente, horas, estado, avance, avance, (100 - avance) * 3, op?.id ?? null, ud?.id ?? null]
    );
    await pool.execute("UPDATE viajes SET folio = CONCAT('TRZ-', LPAD(id, 4, '0')) WHERE id = ?", [r.insertId]);
    await pool.execute("INSERT INTO eventos_viaje (viaje_id, tipo, descripcion) VALUES (?, 'creado', 'Viaje registrado')", [r.insertId]);
    if (op) {
      await pool.execute(
        "INSERT INTO eventos_viaje (viaje_id, tipo, descripcion) VALUES (?, 'en_ruta', ?)",
        [r.insertId, `${op.nombre} inició el viaje`]
      );
      await pool.execute("UPDATE unidades SET estado = 'en_ruta' WHERE id = ?", [ud.id]);
    }
    if (estado === 'retraso') {
      await pool.execute(
        "INSERT INTO eventos_viaje (viaje_id, tipo, descripcion) VALUES (?, 'retraso', 'Tráfico intenso en la caseta')",
        [r.insertId]
      );
    }
  }
  console.log(`✔ Datos de ejemplo: ${OPERADORES_DEMO.length} operadores (contraseña ${CLAVE_DEMO}) y ${viajes.length} viajes`);
}

try {
  await crearTablas();
  await agregarColumnas();
  await migrarRoles();
  await cifrarContraseñas();
  await cargarUnidades();

  const i = process.argv.indexOf('--admin');
  if (i !== -1) await crearAdmin(process.argv.slice(i + 1));
  if (process.argv.includes('--demo')) await cargarDemo();
} catch (error) {
  console.error('✘ ' + (error.code === 'ER_DUP_ENTRY' ? 'Ese correo ya existe' : error.message));
  process.exitCode = 1;
} finally {
  await pool.end();
}
