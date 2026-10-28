# Trazzo · Centro de Control

Aplicación web de un emprendimiento de tecnología logística: registra, asigna y monitorea rutas de carga desde el navegador, la pantalla del patio y el reloj del operador.

## Cambios en la rama `Elias` (respecto a `main`)

### Nueva pestaña «Tráfico» en vivo (solo administradores)

Muestra el tráfico real de las rutas de los viajes asignados y en ruta, con datos de **TomTom** (plan gratis:
2,500 consultas de datos y 50,000 imágenes de mapa al día, sin tarjeta).

- **Por viaje:** nivel de tráfico (fluido < 5 min de retraso, moderado < 15 min, pesado ≥ 15 min), minutos de
  retraso, incidentes sobre la ruta (congestión, obras, cierres, accidentes…) y hora de llegada con tráfico.
- **Rutas alternativas:** TomTom calcula la ruta para **camión** (con el peso de la carga) y hasta 2 alternativas.
  Se compara la ruta habitual (la más corta sin tráfico) con la más rápida con el tráfico actual; si ahorra
  5 min o más, se recomienda.
- **Tráfico de lo que falta:** si el viaje ya va en ruta, se calcula desde la posición del camión hasta el destino.
- **Mapa:** capas de flujo vehicular e incidentes de TomTom (se pueden apagar), ruta recomendada en azul,
  alternativas punteadas, incidentes y el camión.
- **Indicadores:** viajes analizados, con tráfico pesado, retraso total y ahorro posible.
- **Cuota:** cada viaje se consulta a TomTom a lo más cada 5 min (caché en el backend) y hay un tope de
  2,300 consultas al día. La pantalla se refresca cada 10 s para mover el camión, pero eso sale de la caché.
- **Seguridad:** la clave de TomTom solo vive en `Backend/.env`; las imágenes del mapa pasan por el backend
  (`/api/trafico/tiles/...`) para no exponerla. Un operador recibe 403 y sin sesión 401.
- **Sin clave** la pestaña muestra solo la ruta planeada y un aviso; el resto de la app funciona igual.

| Archivo | Cambio |
|---|---|
| `Backend/src/services/traficoService.js` | **Nuevo.** Consulta a TomTom, caché, cuota diaria, recomendación e imágenes del mapa |
| `Backend/src/routes/traficoRouter.js` | **Nuevo.** Rutas `/api/trafico` |
| `Backend/src/app.js` | Monta `/api/trafico` |
| `Backend/.env.example` | Nueva variable `TOMTOM_API_KEY` (vacía; cada quien pone la suya en `.env`) |
| `partials/header.html` | Enlace «Tráfico» en el menú (`data-rol="admin"`) |
| `partials/main.html` | Sección `#trafico` |
| `js/trazzo-core.js` | Lógica de la pantalla (`cargarTrafico`, mapa Leaflet, detalle y lista) |
| `css/styles.css` | Sección 17 (estilos de tráfico, responsivos a 1100 y 560 px) |
| `index.html` | Ícono `i-traffic` (semáforo) |

Para usarla: crea una cuenta gratis en [developer.tomtom.com](https://developer.tomtom.com), copia la
**API Key** del Dashboard y ponla en `Backend/.env` como `TOMTOM_API_KEY=tu_clave`. Nunca la pongas en
`.env.example` ni en el código.

### Botón de pánico (backend y aviso en la web)

El operador lo activa desde la **app móvil** (en desarrollo) si le roban la unidad o tiene una emergencia; los
administradores lo ven en la web al instante.

- **Alerta:** queda ligada al viaje activo y a la unidad del operador, con su ubicación GPS (si el teléfono la
  tiene) y una nota opcional. Solo hay **una alerta activa por operador**: si la app reintenta o vuelve la señal,
  se devuelve la misma y se guarda la ubicación nueva (aunque lleguen dos al mismo tiempo).
- **Recorrido:** mientras la alerta siga activa la app manda la ubicación cada ~30 s (`ubicaciones_panico`).
- **El operador no puede cancelarla** (si lo obligan, la alerta debe seguir activa); solo un administrador la
  cierra como **atendida** o **falsa alarma**, con una nota. Todo queda en el historial del viaje (evento `panico`).
- **El cliente nunca la ve:** la página pública de rastreo oculta esos eventos.
- **Web (solo administradores):** aviso rojo fijo con pitido (abajo a la izquierda; en celular, arriba del botón
  del ChatBot), contador en el título de la pestaña, y una ventana con el mapa del recorrido, los datos del
  operador, viaje y unidad, enlace a Google Maps y los botones «Marcar como atendida» y «Falsa alarma». Se revisa
  cada 10 s, también con la pestaña en segundo plano. «Silenciar» detiene el pitido en esa pestaña.

| Archivo | Cambio |
|---|---|
| `Backend/database/schema.sql` | Tablas `alertas_panico` y `ubicaciones_panico`; tipo de evento `panico` |
| `Backend/database/migrar.js` | Agrega el tipo `panico` en bases que ya existían (`pnpm migrar` crea las tablas) |
| `Backend/src/models/panicoModel.js` | **Nuevo.** Consultas SQL |
| `Backend/src/services/panicoService.js` | **Nuevo.** Validación, una alerta activa por operador, cierre por administrador |
| `Backend/src/routes/panicoRouter.js` | **Nuevo.** Rutas `/api/panico` (operador: 30 solicitudes/min) |
| `Backend/src/services/rastreoService.js` | Oculta los eventos `panico` en el rastreo público |
| `partials/panico.html`, `js/trazzo-core.js`, `css/styles.css` (sección 19), `index.html`, `js/app.js` | Aviso y ventana para administradores |

### Base de datos en la nube (Aiven)

`Backend/src/config/db.js` ahora admite **SSL**, que Aiven exige (`ssl-mode=REQUIRED`). Para usar la base de la
nube, en `Backend/.env` (nunca en el repositorio):

```
DB_HOST=<host de Aiven>
DB_PORT=<puerto de Aiven>
DB_USER=avnadmin
DB_PASSWORD=<contraseña de Aiven>
DB_NAME=defaultdb
DB_SSL=true
DB_CA_PATH=C:/ruta/a/ca.pem     # el "CA certificate" que se descarga en Aiven
```

En Render no hay archivos: pega el contenido del certificado en la variable `DB_CA` (los saltos de línea
pueden ir como `\n`). Después corre `pnpm migrar` una vez para crear o actualizar las tablas. Con `DB_SSL=false`
(o sin la variable) la base local funciona igual que antes.

> La app móvil **nunca** se conecta a MySQL: habla con esta API. La contraseña de la base solo vive en el `.env`
> del backend.

### Notificaciones push

Avisos del sistema operativo que llegan aunque Trazzo esté cerrada (estándar Web Push con claves VAPID).

- **Activar:** campana del encabezado → «Activar». El navegador pide permiso, se suscribe con la clave pública
  VAPID y la suscripción se guarda en `suscripciones_push`. «Enviar prueba» manda una notificación al propio
  usuario y «Desactivar» la da de baja. Al cerrar sesión, el dispositivo se da de baja solo.
- **Alerta de pánico:** cuando un operador activa el botón de pánico, todos los administradores con
  notificaciones activas reciben «🚨 Botón de pánico: <operador>», que no se oculta sola. Al tocarla se abre Trazzo.
- **Backend:** `pushService.js` (librería `web-push`) firma y cifra cada mensaje y lo envía al servicio push del
  navegador; si una suscripción ya no existe (404/410) se borra. Rutas `/api/push`.
- **Service Worker:** eventos `push` (muestra la notificación) y `notificationclick` (abre o enfoca la app).
- **Configuración:** genera las claves con `npx web-push generate-vapid-keys` y ponlas en `Backend/.env`
  (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Requiere HTTPS (o localhost). En iPhone solo
  funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o posterior).

### Arreglos

- **El Service Worker no se registraba** (venía de la separación en `partials/`): se registraba en el evento
  `load`, que ya había ocurrido cuando se carga `js/trazzo-core.js`. Sin él no había funcionamiento sin conexión,
  aviso de versión nueva ni instalación. Ahora se registra de inmediato si la página ya cargó.

- **Recargar en una sección mostraba la pantalla de acceso** (venía de la separación en `partials/`): al
  recargar, el navegador buscaba el `#ancla` antes de que existieran los parciales. `js/app.js` vuelve a la
  misma ancla después de insertarlos (con `location.replace`, sin agregar historial).
- **El menú del administrador desbordaba la página** entre ~1100 y 1500 px de ancho: ahora los enlaces se
  desplazan dentro de su franja (`.nav__links`) y los controles de la derecha no se recortan.
- **El panel del ChatBot tapaba el encabezado:** ahora abre debajo del encabezado y arriba del botón en todos
  los tamaños (sección 18 de `css/styles.css`, solo posición; su funcionamiento no cambió).
- El filtro de «Monitoreo» tomaba todos los botones `.seg` de la página; ahora solo los que tienen `data-filtro`.
- `sw.js` pasa a `trazzo-v2.11` para que los navegadores descarguen los archivos nuevos.

### Entorno local y cuentas de prueba

Para trabajar sin la base de la nube se usó **MySQL Server 8.4** local (`127.0.0.1:3306`, base `trazzo`) y la
base se creó con `pnpm migrar -- --admin ... --demo`. Para levantar todo:

1. MySQL: `"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file=<ruta>\my.ini --console`
   (o regístralo como servicio de Windows para que arranque solo).
2. Backend + frontend: `cd Backend` y `pnpm dev` (o `node --watch-path=src src/server.js`), luego abre `http://localhost:3000`.

| Cuenta | Correo | Contraseña | Nota |
|---|---|---|---|
| Administrador local | `admin@trazzo.local` | `trazzo123` | Se creó con una contraseña aleatoria y después **se cambió a `trazzo123`** para que sea fácil de recordar |
| Operadores de ejemplo | `juan.perez@trazzo.mx`, `laura@trazzo.mx`, `raul@trazzo.mx` | `trazzo123` | Los crea `pnpm migrar -- --demo` |
| MySQL | `root` | *(sin contraseña)* | Solo escucha en `127.0.0.1` |

> **Estas contraseñas son solo para la base local de desarrollo.** No las uses en la base de la nube ni en
> producción: ahí crea el administrador con una contraseña propia (`pnpm migrar -- --admin ...`).

Para probar el seguimiento con calma conviene `SIMULADOR_SEGUNDOS=60` en `Backend/.env` (con 10 s los viajes
se entregan en unos 4 minutos; con 60 s, en unos 20-25).

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

**Rastreo público con QR**

En el seguimiento de un viaje, «Compartir rastreo» crea un enlace secreto (token aleatorio de 256 bits) y su
código QR, generado en el servidor. El cliente lo abre en su celular (`rastreo.html?t=...`) sin cuenta y ve el
avance, el camión sobre el mapa, la hora de llegada y el historial, actualizado cada 15 s. La vista pública
oculta datos internos (flete, placas, notas, nombres del personal) y el enlace se puede desactivar; caduca
3 días después de la entrega. Para escanear el QR con un celular en el mismo wifi, el backend usa la IP local
de la computadora; si publicas el frontend, pon su dirección en `PUBLIC_URL` (`.env`).

**Asistente con IA (Claude)**

El botón «Asistente» abre un chat donde se pregunta en lenguaje natural («¿qué viajes van con retraso?»,
«registra un viaje de Puebla a Oaxaca mañana a las 8»). El backend (`asistenteService.js`) usa el modelo
`claude-opus-5-5` con herramientas que consultan los datos reales respetando el rol de quien pregunta.
Las acciones que cambian datos solo se **proponen**: aparecen como tarjetas con «Confirmar» y, al confirmar,
el frontend llama a los endpoints normales (mismas validaciones y permisos). Requiere `ANTHROPIC_API_KEY`
en `.env` (tiene costo por uso; máximo 15 preguntas por minuto por usuario). Sin clave, el resto de la app
funciona igual. Si los filtros de seguridad de Anthropic rechazan una petición, la API reintenta
automáticamente con otro modelo (`fallbacks: "default"`).

**Seguridad extra:** el inicio de sesión admite 10 intentos fallidos cada 15 minutos por IP.

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
| GET | `/api/viajes/historial` | Con sesión | Todos los viajes: `?q=&estado=&desde=&hasta=&pagina=&por_pagina=`; con `&formato=csv` descarga para Excel |
| GET | `/api/viajes/resumen` | Con sesión | KPIs del tablero y estado de la flota |
| GET | `/api/viajes/eventos` | Con sesión | Actividad reciente |
| POST | `/api/viajes` | Admin / capturista | Registrar ruta; el folio `TRZ-0000` se genera solo |
| PATCH | `/api/viajes/:id/asignar` | Admin / capturista | `{ operador_id, unidad_id }` |
| PATCH | `/api/viajes/:id/estado` | Admin / capturista / operador del viaje | `{ estado, nota }` |
| GET | `/api/flota/unidades` | Admin / capturista | Camiones, su estado, viaje que los ocupa y entregas |
| POST | `/api/flota/unidades` | Admin / capturista | Agregar unidad `{ placas, marca_modelo, anio, capacidad_kg, poliza }` |
| PATCH | `/api/flota/unidades/:id` | Admin / capturista | Editar datos o `{ estado: 'disponible' | 'taller' }` |
| GET | `/api/flota/operadores` | Admin / capturista | Operadores, viaje activo y viajes del mes |
| POST | `/api/viajes/:id/rastreo` | Admin / capturista | Activa el rastreo público → `{ url, qr_svg }` |
| DELETE | `/api/viajes/:id/rastreo` | Admin / capturista | Desactiva el enlace (el QR deja de funcionar) |
| GET | `/api/rastreo/:token` | **Público** | Avance del envío para el cliente (máx. 30 consultas/min por IP) |
| POST | `/api/asistente` | Admin / capturista / operador | `{ mensajes: [{ rol, texto }] }` → `{ respuesta, propuestas }` |
| GET | `/api/rutas/estimar` | Admin / capturista | `?origen=&destino=&gps_origen=&gps_destino=` → distancia, tiempo y trazo de la ruta |
| GET | `/api/trafico/estado` | Administrador | ¿Hay clave de TomTom? y consultas usadas hoy |
| GET | `/api/trafico/viajes` | Administrador | Viajes asignados y en ruta con nivel de tráfico, retraso, incidentes y ahorro posible |
| GET | `/api/trafico/viajes/:id` | Administrador | Detalle: rutas con tráfico (principal y alternativas), incidentes y recomendación |
| GET | `/api/trafico/tiles/:capa/:z/:x/:y` | Público (máx. 600/min por IP) | Imágenes de la capa `flujo` o `incidentes` de TomTom (la clave no sale del servidor) |
| POST | `/api/panico` | Operador | Activa el botón de pánico `{ lat?, lon?, precision_m?, nota? }` → `201 { alerta, nueva: true }`; si ya tenía una activa → `200 { alerta, nueva: false }` |
| POST | `/api/panico/:id/ubicacion` | Operador dueño de la alerta | `{ lat, lon, precision_m? }` → `{ alerta }`; `409` si un administrador ya la cerró |
| GET | `/api/panico/mia` | Operador | `{ alerta }` activa o `{ alerta: null }` (para que la app recupere el estado al abrirse) |
| GET | `/api/panico` | Administrador | Alertas (`?estado=activa`, `atendida`, `falsa_alarma`) |
| GET | `/api/panico/:id` | Administrador | Alerta con su recorrido (`ubicaciones`) |
| PATCH | `/api/panico/:id` | Administrador | `{ estado: 'atendida' \| 'falsa_alarma', resolucion? }`; `409` si ya estaba cerrada |
| GET | `/api/push/clave` | Con sesión | `{ configurado, clave_publica }` (clave VAPID pública para suscribirse) |
| POST | `/api/push/suscripcion` | Con sesión | Guarda la suscripción del navegador `{ endpoint, keys: { p256dh, auth } }` |
| DELETE | `/api/push/suscripcion` | Con sesión | `{ endpoint }` → da de baja ese dispositivo |
| POST | `/api/push/prueba` | Con sesión | Envía una notificación de prueba al propio usuario (máx. 5/min); `409` sin dispositivos |

Roles: `admin`, `capturista`, `operador`, `cliente`. El frontend envía el token en `Authorization: Bearer <token>`. Su dirección se configura en la constante `API_URL` de `index.html`.

## Funciones PWA

| Función | Cómo funciona |
|---|---|
| Instalable | `manifest.json` + botón propio «Instalar app» (evento `beforeinstallprompt`) en el encabezado y en el acceso |
| Sin conexión | El Service Worker guarda la interfaz; las últimas consultas a la API se guardan con la **Cache API** (caché `trazzo-api`) y se muestran sin red, con un aviso «Sin conexión» |
| Aviso de versión nueva | Al publicar cambios aparece «Hay una nueva versión · Actualizar»; la app se recarga solo cuando el usuario lo decide |
| Datos en vivo | Tablero, monitoreo y el seguimiento abierto se refrescan cada 10 s (se pausa si la pestaña no está visible) |
| Cache API para la API | `api()` en `js/trazzo-core.js` pide siempre a la red; si responde bien guarda una copia en `caches.open('trazzo-api')`, y sin red devuelve esa copia. Se borra al cerrar sesión y el Service Worker no la elimina al cambiar de versión |
