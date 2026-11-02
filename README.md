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

### Arreglos

- **Recargar en una sección mostraba la pantalla de acceso** (venía de la separación en `partials/`): al
  recargar, el navegador buscaba el `#ancla` antes de que existieran los parciales. `js/app.js` vuelve a la
  misma ancla después de insertarlos (con `location.replace`, sin agregar historial).
- **El menú del administrador desbordaba la página** entre ~1100 y 1500 px de ancho: ahora los enlaces se
  desplazan dentro de su franja (`.nav__links`) y los controles de la derecha no se recortan.
- **El panel del ChatBot tapaba el encabezado:** ahora abre debajo del encabezado y arriba del botón en todos
  los tamaños (sección 18 de `css/styles.css`, solo posición; su funcionamiento no cambió).
- El filtro de «Monitoreo» tomaba todos los botones `.seg` de la página; ahora solo los que tienen `data-filtro`.
- `sw.js` pasa a `trazzo-v2.9` para que los navegadores descarguen los archivos nuevos.

### Entorno local y cuentas de prueba

Para trabajar sin la base de la nube se usó **MySQL Server 8.4** local (`127.0.0.1:3306`, base `trazzo`) y la
base se creó con `pnpm migrar -- --admin ... --demo`. Para levantar todo:

1. MySQL: `"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file=<ruta>\my.ini --console`
   (o regístralo como servicio de Windows para que arranque solo).
2. Backend + frontend: `cd Backend` y `pnpm dev` (o `node --watch src/server.js`), luego abre `http://localhost:3000`.

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
| Secciones | Tablero, Rutas (registro + asignación rápida), Monitoreo, Tráfico, Historial, Flota, Personal y roles, Cómo funciona |
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
3 días después de la entrega.

El enlace del QR se arma así: 1) `PUBLIC_URL` del `.env` si existe; 2) si la app se usa desde una dirección
pública (GitLab Pages, Render), esa dirección con su carpeta (`usuario.gitlab.io/trazzo/`); 3) en desarrollo,
el propio backend con la IP del wifi (`http://192.168.x.x:3000/rastreo.html?t=...`), que también sirve la
página. Así el celular la abre aunque el frontend corra en Live Server. Si el celular no carga, permite a Node.js
en el Firewall de Windows (red privada) y revisa que esté en el mismo wifi.

**Pregunta sobre tu envío (IA para el cliente):** si hay `ANTHROPIC_API_KEY`, la página de rastreo muestra un
chat donde el cliente pregunta («¿a qué hora llega?», «¿por qué va con retraso?»). Claude responde solo con
los datos públicos de ese envío, sin herramientas (no puede ver otros viajes ni cambiar nada). Límites:
300 caracteres por pregunta, 6 preguntas por minuto por IP y 40 por hora por envío.

**Asistente con IA (Gemini o Claude)**

La IA del chat y la de la página de rastreo usan **Google Gemini** (`IA_PROVEEDOR=gemini`, plan gratis) o
**Claude** (`IA_PROVEEDOR=claude`). Para Gemini, crea tu clave en https://aistudio.google.com («Get API key»)
y ponla en `GEMINI_API_KEY`; el modelo se cambia con `GEMINI_MODEL` (por defecto `gemini-3.5-flash-lite`, rápido; `gemini-3.8-flash` es más capaz pero en el plan gratis puede tardar mucho). Ambos usan
las mismas herramientas, instrucciones y tarjetas de «Confirmar» (`geminiService.js` traduce al formato de
Gemini). Si se acaba el cupo gratis o la clave falla, el chat pasa solo al chatbot sin coste. En el plan gratis
de Gemini, Google puede usar lo que se envía para mejorar sus productos: no lo uses con datos sensibles reales.

El botón «Asistente» abre un chat donde se pregunta en lenguaje natural («¿qué viajes van con retraso?»,
«registra un viaje de Puebla a Oaxaca mañana a las 8»). El backend (`asistenteService.js`) usa el modelo
`claude-opus-5-5` con herramientas que consultan los datos reales respetando el rol de quien pregunta.
Las acciones que cambian datos solo se **proponen**: aparecen como tarjetas con «Confirmar» y, al confirmar,
el frontend llama a los endpoints normales (mismas validaciones y permisos). También puede preparar el QR de
rastreo de un viaje («comparte el rastreo de TRZ-0142») y mostrarlo en el chat. Requiere `ANTHROPIC_API_KEY`
en `.env` (tiene costo por uso; máximo 15 preguntas por minuto por usuario). Sin clave, sin saldo o sin
servicio, el chat cambia solo al chatbot por palabras clave (`/api/chatbot`, sin coste). Si los filtros de seguridad de Anthropic rechazan una petición, la API reintenta
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
| POST | `/api/documentos` | Admin / operador del viaje | Sube imagen JPG/PNG/WebP (5 MB máximo) y responde `202` mientras el OCR se procesa |
| GET | `/api/documentos/ocr-config` | Admin / operador | Informa el motor OCR configurado y si envía imágenes fuera del servidor |
| GET | `/api/documentos` | Admin | Galería privada, filtros, paginación y conteos |
| POST | `/api/documentos/lote` | Admin | Archiva o reintenta OCR para hasta 20 documentos y devuelve un resultado por id |
| GET | `/api/documentos/viaje/:id` | Admin / operador asignado | Lista resumida; el operador no recibe texto OCR ni bitácora |
| GET | `/api/documentos/:id` | Admin | Datos extraídos, texto OCR (excepto identificaciones) y revisión |
| GET | `/api/documentos/:id/archivo` | Admin | Foto privada; `?m=1` sirve miniatura sin auditar como vista completa |
| GET | `/api/documentos/:id/bitacora` | Admin | Bitácora de solo inserción |
| PATCH | `/api/documentos/:id` | Admin ajeno al documento | Corrige datos OCR en estado pendiente |
| PATCH | `/api/documentos/:id/revision` | Admin ajeno al documento | Aprueba o rechaza; ambos estados son finales |
| POST | `/api/documentos/:id/reprocesar` | Admin ajeno al documento | Repite el OCR de un documento pendiente |
| POST | `/api/documentos/:id/archivar` | Admin | Archiva de forma lógica un pendiente o rechazado, con motivo obligatorio |
| POST | `/api/documentos/:id/restaurar` | Admin | Restaura un documento archivado permitido |
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
| POST | `/api/rastreo/:token/pregunta` | **Público** | `{ pregunta, historial }` → `{ respuesta }` · IA solo con datos públicos del envío (6/min por IP, 40/h por envío) |
| POST / DELETE | `/api/rastreo/:token/push` | **Público** | `{ suscripcion }` / `{ endpoint }` · el cliente activa o quita los avisos de su envío |
| GET | `/api/push/clave` | Público | `{ disponible, clave }` · clave pública VAPID |
| POST / DELETE | `/api/push/suscripcion` | Admin / capturista / operador | `{ suscripcion }` / `{ endpoint }` · avisos de viajes para el personal |
| POST | `/api/asistente` | Admin / capturista / operador | `{ mensajes: [{ rol, texto }] }` → `{ respuesta, propuestas }` |
| GET | `/api/rutas/estimar` | Admin / capturista | `?origen=&destino=&gps_origen=&gps_destino=` → distancia, tiempo y trazo de la ruta |
| GET | `/api/trafico/estado` | Administrador | ¿Hay clave de TomTom? y consultas usadas hoy |
| GET | `/api/trafico/viajes` | Administrador | Viajes asignados y en ruta con nivel de tráfico, retraso, incidentes y ahorro posible |
| GET | `/api/trafico/viajes/:id` | Administrador | Detalle: rutas con tráfico (principal y alternativas), incidentes y recomendación |
| GET | `/api/trafico/tiles/:capa/:z/:x/:y` | Público (máx. 600/min por IP) | Imágenes de la capa `flujo` o `incidentes` de TomTom (la clave no sale del servidor) |

Roles: `admin`, `capturista`, `operador`, `cliente`. El frontend envía el token en `Authorization: Bearer <token>`. Su dirección se configura en la constante `API_URL` de `index.html`.

### Gestión digital de documentos y OCR

El módulo **Gestión Digital de Documentos y OCR** permite adjuntar comprobantes de viaje desde la cámara o la galería del celular, vincularlos al viaje y procesarlos para extraer y clasificar su información. La galería administrativa ofrece vistas de lista y tarjetas para consultar la guía, coincidencia, estado y resultado de lectura OCR, y permite revisar, corregir, aprobar, rechazar o archivar documentos conservando su evidencia y bitácora.

El enlace **Documentos** y la galería son solo para administradores. En el seguimiento de un viaje, el administrador puede subir a cualquier viaje y el operador solo a los suyos; este último ve únicamente estado y nota de revisión. Capturista y cliente no tienen acceso. El administrador que subió un archivo no puede revisarlo; otro administrador debe hacerlo. Aprobado y rechazado son estados finales.

El escáner guía la captura en vivo y habilita el disparador solo tras tres mediciones estables de iluminación y enfoque; también analiza las fotos elegidas o tomadas con la cámara nativa y no las envía si no alcanzan los umbrales de legibilidad. La validación es una heurística local de brillo y nitidez, no una garantía de que todo el contenido del documento sea legible: revisa la vista previa y vuelve a tomar la foto si hace falta. La subida optimiza la foto en el navegador y responde sin esperar el OCR. Por defecto, se usa Claude si existe `ANTHROPIC_API_KEY`; de lo contrario, Tesseract con español se ejecuta en el servidor. Configura `OCR_MOTOR=tesseract` o `OCR_MOTOR=claude` para elegir explícitamente; el endpoint `/api/documentos/ocr-config` refleja esta selección en el aviso de privacidad. Las fotos se guardan fuera del proyecto en `UPLOAD_DIR` (por defecto, una carpeta temporal del sistema) o en un bucket privado con `ALMACEN=s3`; `S3_ENDPOINT` admite R2 y Backblaze B2. En Render, el disco local es efímero: usa un disco persistente o almacenamiento S3-compatible. Prueba guardar, leer y borrar con `cd Backend` y `pnpm probar:almacen`.

Los documentos y sus fotos nunca se guardan en la caché local del navegador. La huella SHA-256 se verifica al abrir o reprocesar una imagen. Una imagen con la misma huella activa en el mismo viaje responde `409`; al archivar el registro se permite una nueva carga. Archivar no borra físicamente ni la foto ni el registro y requiere motivo; solo aplica a pendientes y rechazados. El administrador puede restaurar y cada acción queda en la bitácora. Las identificaciones no guardan ni muestran el texto OCR completo y su foto solo está disponible para administradores. La imagen se envía al proveedor externo únicamente cuando el motor configurado es Claude; Tesseract la procesa localmente. Ejecuta `pnpm migrar` para aplicar el esquema y purgar texto OCR de identificaciones históricas.

**Diagnóstico seguro del almacén:** `cd Backend` y `pnpm auditar:documentos` compara `archivo_clave` de la base contra el almacén activo e imprime id, viaje, tipo, SHA-256 y existencia; por defecto es de solo lectura y no muestra texto OCR ni datos personales. Para archivar los faltantes elegibles, la opción explícita exige administrador, motivo y confirmación: `pnpm auditar:documentos -- --archivar-faltantes --confirmar "ARCHIVAR FALTANTES" --admin-id 3 --motivo "Archivo no localizado en el almacén"`. Los aprobados y estados no elegibles se conservan; no se elimina ningún archivo.

**Almacén compartido para el equipo:** la base compartida con `ALMACEN=disco` no comparte los archivos entre computadoras; el directorio temporal predeterminado también puede cambiar o desaparecer al reiniciar o desplegar. Para pasar a S3/R2/B2, crea un bucket privado, configura `ALMACEN=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (si aplica) y las credenciales `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` en cada instancia. Antes de cambiar el backend, copia los objetos desde la carpeta `UPLOAD_DIR` de la instancia que sí los conserva, preservando los nombres `archivo_clave`: `aws s3 sync "$UPLOAD_DIR" "s3://$S3_BUCKET" --endpoint-url "$S3_ENDPOINT"` (omite `--endpoint-url` para AWS S3). No hagas público el bucket. Verifica con `pnpm auditar:documentos` antes de retirar la copia local.

**Probar el escáner con celular:** la cámara en vivo solo funciona en `https://` o `localhost`. Para una prueba temporal, inicia el backend en el puerto 3000 y crea un túnel HTTPS autorizado, por ejemplo `ngrok http 3000`; abre la URL HTTPS del túnel en el celular e inicia sesión. También puedes servir el sitio con un certificado HTTPS confiable. El botón **Elegir foto de galería** abre el selector de imágenes del dispositivo (sin forzar la cámara) y convierte el formato elegido a JPEG antes de subirlo. Si la medición local de luz o enfoque advierte baja legibilidad, el usuario puede elegir otra foto o confirmar que quiere continuar. No publiques el túnel ni compartas credenciales de prueba.

Después de actualizar el código, ejecuta `pnpm migrar` desde `Backend/` para ampliar las tablas existentes.

## Funciones PWA

| Función | Cómo funciona |
|---|---|
| Instalable | `manifest.json` + botón propio «Instalar app» (evento `beforeinstallprompt`) en el encabezado y en el acceso |
| Sin conexión | El Service Worker guarda la interfaz; las últimas consultas a la API se guardan con la **Cache API** (caché `trazzo-api`) y se muestran sin red, con un aviso «Sin conexión» |
| Aviso de versión nueva | Al publicar cambios aparece «Hay una nueva versión · Actualizar»; la app se recarga solo cuando el usuario lo decide |
| Notificaciones push | Web Push con claves VAPID (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` en `.env`; genéralas con `npx web-push generate-vapid-keys`). Avisan cuando un viaje se asigna, inicia, cambia de estado, llega al 90 % del recorrido («está por llegar») o se entrega. Llegan solo a los involucrados de cada viaje: quien lo creó, quien lo asignó, el chofer (y el chofer anterior si se reasigna) y el cliente de su QR (botón «Avísame» en `rastreo.html`, sin notas internas); quien hace el cambio no recibe su propio aviso. Al asignar, el panel ofrece «QR para el cliente». Botón «Activar avisos» en el encabezado. Requieren HTTPS o `localhost`; en iPhone, la app agregada a la pantalla de inicio |
| Datos en vivo | Tablero, monitoreo y el seguimiento abierto se refrescan cada 10 s (se pausa si la pestaña no está visible) |
| Cache API para la API | `api()` en `js/trazzo-core.js` pide siempre a la red y cachea las consultas permitidas; las peticiones de `/api/documentos` nunca se cachean y las fotos usan `no-store`. La caché se borra al cerrar sesión |
