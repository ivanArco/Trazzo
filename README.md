# Trazzo · Centro de Control

Aplicación web de un emprendimiento de tecnología logística: registra, asigna y monitorea rutas de carga desde el navegador, la pantalla del patio y el reloj del operador.

## Estructura

```
trazzo/
├── index.html          Estructura y JavaScript (en <script> al final del <body>)
├── css/styles.css      Estilos: variables de color, componentes y diseño responsivo
├── img/                Imágenes (ilustración del patio y portada del video)
├── video/              Video del seguimiento de un viaje
├── icons/              Iconos de la aplicación
├── manifest.json       Datos para instalarla como app (PWA)
└── sw.js               Service Worker: funcionamiento sin conexión
```

## Cómo cumple los requisitos

| Requisito | Dónde |
|---|---|
| Tema de emprendimiento | Sección «Cómo funciona» → «Por qué nace Trazzo» (problema, solución, impacto) |
| Encabezado con logotipo | `<header class="nav">` |
| Menú de navegación | `<nav class="nav__links">` (en teléfono, botón ☰) |
| Secciones | Tablero, Nueva ruta, Asignación, Monitoreo, Personal y roles, Cómo funciona |
| Pie de página | `<footer class="foot">` |
| Responsivo | `css/styles.css`, sección 16: 1440, 1280, 1100, 960, 720 y 560 px |
| Colores consistentes | Variables en `:root` (modo oscuro y claro automáticos) |
| Texto, imagen y video | Sección «Cómo funciona» |
| HTML, CSS y JS organizados | `index.html` (estructura + JS al final), `css/styles.css`, `sw.js` |

## Publicar en GitHub Pages (gratis)

1. Crea un repositorio público en github.com, por ejemplo `trazzo`.
2. Botón **Add file → Upload files** y arrastra **el contenido** de esta carpeta (no la carpeta). Confirma con **Commit changes**.
3. Ve a **Settings → Pages**. En *Branch* elige `main` y carpeta `/ (root)`. Guarda.
4. Espera 1 o 2 minutos. Tu URL será: `https://TU-USUARIO.github.io/trazzo/`

Alternativa sin cuenta de GitHub: entra a app.netlify.com/drop y arrastra la carpeta completa.

> Cada vez que cambies archivos, sube la versión en `sw.js` (`trazzo-v2.2`, `v2.3`…) para que el navegador no muestre la copia guardada.

## Probar en tu computadora

Abre `index.html` con la extensión *Live Server* de VS Code, o ejecuta en la carpeta:

```
python -m http.server 8000
```

y entra a `http://localhost:8000`.

Para iniciar sesión necesitas el backend encendido (siguiente sección) y una cuenta registrada.

## Backend (API con Express + MySQL)

```
Backend/
├── .env.example        Plantilla de configuración (cópiala como .env)
├── database/
│   ├── schema.sql      Tablas: usuarios, unidades, viajes, eventos_viaje
│   └── migrar.js       Crea tablas, cifra contraseñas, crea admin y datos de ejemplo
└── src/
    ├── server.js       Arranque del servidor y del simulador de seguimiento
    ├── app.js          CORS, rutas y manejo de errores
    ├── config/db.js    Conexión a MySQL (lee .env) y transacciones
    ├── middlewares/    verificarToken (JWT) y permitir(rol)
    ├── routes/         auth, users, viajes, flota
    ├── controllers/    Reciben la petición y responden
    ├── services/       Reglas de negocio (validación, estados del viaje, simulador)
    └── models/         Consultas SQL
```

**Primera vez**

1. `cd Backend` y `pnpm install`
2. Copia `.env.example` como `.env` y llena tus datos de MySQL y un `JWT_SECRET`.
3. Crea las tablas y un administrador: `pnpm migrar -- --admin "Tu Nombre" tu@correo.mx tuContraseña`
4. (Opcional) Datos de ejemplo para presentar: `pnpm migrar -- --demo`
   crea 3 operadores (juan.perez@trazzo.mx, laura@trazzo.mx, raul@trazzo.mx · contraseña `trazzo123`) y 4 viajes.
5. `pnpm dev` (se reinicia solo al guardar cambios)

**Ciclo de un viaje**

```
pendiente ──asignar──▶ asignado ──iniciar──▶ en_ruta ⇄ retraso ──▶ entregado
     └──────────────── cancelado (solo administrador o capturista) ◀─────┘
```

- Al asignar se valida que el operador no tenga otro viaje y que la unidad esté libre y soporte el peso.
- Cada cambio queda en el historial (`eventos_viaje`) y alimenta la «Actividad reciente» del tablero.
- **Seguimiento simulado (solo de prueba):** cada `SIMULADOR_SEGUNDOS` (10 por defecto) el servidor avanza
  los viajes en ruta, a veces provoca un retraso y al llegar al 100 % los entrega. Con `SIMULADOR_SEGUNDOS=0` se apaga.

**Vista previa de la ruta y tiempo de traslado**

Al escribir origen y destino en «Nueva ruta», el backend busca las direcciones con **Nominatim** y calcula el
recorrido por carretera con **OSRM** (ambos de OpenStreetMap, gratis y sin API key). La vista previa muestra el
mapa con el trazo (Leaflet), la distancia, el tiempo de traslado en camión (tiempo en auto × 1.3) y la hora de
llegada según la salida. Si se pega un enlace de Google Maps en los campos GPS, se usan esas coordenadas.
La distancia y el tiempo se guardan con el viaje y sirven para estimar la hora de llegada en el seguimiento.
Los servidores públicos de OpenStreetMap son para uso moderado: los resultados se guardan en caché en el backend.

**Endpoints**

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/health` | Público | Comprueba que el servidor responde |
| POST | `/api/auth/login` | Público | `{ correo, contraseña }` → `{ token, usuario }` |
| GET | `/api/auth/me` | Con sesión | Datos del usuario del token |
| GET | `/api/users` | Administrador | Lista de usuarios (sin contraseñas) |
| POST | `/api/users` | Administrador | `{ nombre, correo, contraseña, rol }` |
| GET | `/api/viajes` | Con sesión | Viajes activos y entregados recientes (`?estado=pendiente,asignado`). El operador solo ve los suyos |
| GET | `/api/viajes/:id` | Con sesión | Viaje con su historial |
| GET | `/api/viajes/resumen` | Con sesión | KPIs del tablero y estado de la flota |
| GET | `/api/viajes/eventos` | Con sesión | Actividad reciente |
| POST | `/api/viajes` | Admin / capturista | Registrar ruta; el folio `TRZ-0000` se genera solo |
| PATCH | `/api/viajes/:id/asignar` | Admin / capturista | `{ operador_id, unidad_id }` |
| PATCH | `/api/viajes/:id/estado` | Admin / capturista / operador del viaje | `{ estado, nota }` |
| GET | `/api/flota/unidades` | Admin / capturista | Camiones y su estado |
| GET | `/api/flota/operadores` | Admin / capturista | Operadores, viaje activo y viajes del mes |
| GET | `/api/rutas/estimar` | Admin / capturista | `?origen=&destino=&gps_origen=&gps_destino=` → distancia, tiempo y trazo de la ruta |

Roles: `admin`, `capturista`, `operador`, `cliente`. El frontend envía el token en `Authorization: Bearer <token>`. Su dirección se configura en la constante `API_URL` de `index.html`.

## Funciones PWA

| Función | Cómo funciona |
|---|---|
| Instalable | `manifest.json` + botón propio «Instalar app» (evento `beforeinstallprompt`) en el encabezado y en el acceso |
| Sin conexión | El Service Worker guarda la interfaz; las últimas consultas a la API se guardan en el navegador y se muestran sin red, con un aviso «Sin conexión» |
| Aviso de versión nueva | Al publicar cambios aparece «Hay una nueva versión · Actualizar»; la app se recarga solo cuando el usuario lo decide |
| Datos en vivo | Tablero, monitoreo y el seguimiento abierto se refrescan cada 10 s (se pausa si la pestaña no está visible) |
| La API nunca se guarda en caché del Service Worker | Siempre se piden datos frescos al servidor |
