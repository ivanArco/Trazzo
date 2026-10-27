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
- **Seguimiento simulado (solo de prueba):** cada `SIMULADOR_SEGUNDOS` (10 por defecto) el servidor calcula el
  avance según el tiempo transcurrido entre `salida` y `eta`; antes de la salida mantiene el viaje asignado,
  al llegar la hora de salida lo pone en ruta y al alcanzar la ETA lo entrega. Los viajes activos con horario
  vencido también se completan al iniciar el simulador. Si se comparte GPS reciente desde el teléfono, el reloj
  simulado se pausa para ese viaje. Con `SIMULADOR_SEGUNDOS=0` se apaga.

**Mapa interactivo y ETA predictivo**

Al escribir origen y destino en «Nueva ruta», el backend busca las direcciones con **Nominatim** y calcula el
recorrido por carretera con **OSRM** (OpenStreetMap, sin API key). La vista previa muestra el trazo (Leaflet),
la distancia por carretera y el tiempo estimado de camión. El ETA se calcula como distancia real ÷ velocidad
promedio × factor de restricciones. Los valores se pueden ajustar en `.env` con `VELOCIDAD_PROMEDIO_CAMION_KMH`
(65 por defecto) y `FACTOR_RESTRICCION_RUTA` (1 = sin demora adicional); el endpoint de estimación también
acepta `velocidad_promedio_kmh` (10–120) y `factor_restriccion` (1–3). Si se pega un enlace de Google Maps en
los campos GPS, se usan esas coordenadas. El tiempo estimado se guarda con el viaje y el simulador recalcula
el ETA a medida que cambia el avance.

El tablero incluye un mapa de unidades con rutas por carretera, progreso de cada viaje, ETA, filtro por ruta,
capas independientes de rutas/unidades, zoom para encuadrar la flota y detalles al seleccionar un marcador.
Se actualiza junto con el tablero cada 10 segundos. El operador asignado puede abrir el seguimiento de su viaje
en el teléfono y tocar «Compartir ubicación de este teléfono»; el navegador pedirá permiso y enviará una
posición cada 10 segundos mientras la app permanezca abierta. La ubicación se muestra en el mapa autenticado,
actualiza el progreso/ETA y se borra al detener el GPS o entregar/cancelar el viaje. Solo se conserva la última
posición, no un historial. El GPS del navegador requiere HTTPS (o localhost) y permiso del usuario; para una
prueba desde el teléfono, la app y la API deben estar accesibles desde el celular y el frontend debe usar HTTPS.
Si no hay una posición GPS reciente, se muestra la posición simulada del viaje. El GPS puede pausarse cuando
el teléfono bloquea la pantalla o el navegador pasa a segundo plano. Los servicios públicos de mapas limitan
su uso; los trazos se guardan en caché en el backend.

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
| GET | `/api/viajes/mapa` | Con sesión | Unidades activas con trazo de ruta y ETA; el operador solo ve su viaje |
| PUT | `/api/viajes/:id/ubicacion` | Operador asignado, en ruta | `{ latitud, longitud, precision_m }` → guarda la última ubicación del teléfono |
| DELETE | `/api/viajes/:id/ubicacion` | Operador asignado | Detiene el uso del GPS y borra la última ubicación |
| PUT | `/api/viajes/:id/ubicacion` | Operador asignado, en ruta | `{ latitud, longitud, precision_m }` → guarda la última ubicación del teléfono |
| DELETE | `/api/viajes/:id/ubicacion` | Operador asignado | Detiene el uso del GPS y borra la última ubicación |
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
| GET | `/api/rutas/estimar` | Admin / capturista | `?origen=&destino=&gps_origen=&gps_destino=&velocidad_promedio_kmh=&factor_restriccion=` → distancia, ETA y trazo |

Roles: `admin`, `capturista`, `operador`, `cliente`. El frontend envía el token en `Authorization: Bearer <token>`. Su dirección se configura en la constante `API_URL` de `index.html`.

## Funciones PWA

| Función | Cómo funciona |
|---|---|
| Instalable | `manifest.json` + botón propio «Instalar app» (evento `beforeinstallprompt`) en el encabezado y en el acceso |
| Sin conexión | El Service Worker guarda la interfaz; las últimas consultas a la API se guardan con la **Cache API** (caché `trazzo-api`) y se muestran sin red, con un aviso «Sin conexión» |
| Aviso de versión nueva | Al publicar cambios aparece «Hay una nueva versión · Actualizar»; la app se recarga solo cuando el usuario lo decide |
| Datos en vivo | Tablero, monitoreo y el seguimiento abierto se refrescan cada 10 s (se pausa si la pestaña no está visible) |
| Cache API para la API | `api()` en `js/trazzo-core.js` pide siempre a la red; si responde bien guarda una copia en `caches.open('trazzo-api')`, y sin red devuelve esa copia. Se borra al cerrar sesión y el Service Worker no la elimina al cambiar de versión |
