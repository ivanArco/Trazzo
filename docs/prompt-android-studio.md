# Prompt para el agente de Android Studio · Trazzo Operador

> Copia todo lo que está debajo de la línea en el agente de Android Studio (Gemini / Agent Mode).
> Está pensado para hacerse por fases: pide una fase a la vez y revisa que compile y funcione antes de seguir.

---

Eres un desarrollador Android senior. Vas a crear desde cero la app móvil **Trazzo Operador**, la versión para
teléfono de una plataforma web de logística de carga que ya existe (Trazzo · Centro de Control). La app es para
los **operadores** (choferes de tractocamión): ver su viaje, actualizar su estado y, sobre todo, activar un
**botón de pánico** si les roban la unidad o tienen una emergencia. En una emergencia el operador **agita el
teléfono**: la app se abre directo en la pantalla del botón de pánico, y al **mantenerlo presionado 5 segundos**
se envía la alerta y empieza el rastreo. Los administradores ya ven esas alertas y el recorrido en la web.

Trabaja por fases (abajo). Al terminar cada fase: que el proyecto compile, que corra en el emulador, y dame un
resumen de lo que hiciste y de cómo probarlo. No avances a la siguiente fase sin que te lo pida.

## Reglas que no se negocian

1. **La app NUNCA se conecta a la base de datos.** Todo pasa por la API REST de abajo. No incluyas en el código,
   en `build.gradle`, en recursos ni en `local.properties` usuarios, contraseñas, hosts de MySQL ni claves de
   ningún servicio. Si crees que necesitas un dato así, detente y pregúntame.
2. Solo HTTPS en producción. HTTP en claro únicamente hacia `10.0.2.2` (el emulador hablando con mi computadora)
   y solo en el build `debug`, con un `network_security_config` limitado a ese host.
3. El token de sesión se guarda cifrado (DataStore + Android Keystore, o EncryptedSharedPreferences). Nunca se
   guarda la contraseña.
4. Textos de la interfaz en **español de México**, en `strings.xml`.
5. No inventes endpoints ni campos: usa exactamente el contrato de abajo. Si falta algo, dímelo.

## Tecnología

- Kotlin, **Jetpack Compose** con Material 3, una sola Activity y Navigation Compose.
- Arquitectura MVVM con capas `data` (API, repositorios), `domain` (modelos) y `ui` (pantallas y ViewModels),
  corrutinas y `StateFlow`. Inyección de dependencias con Hilt.
- Red: Retrofit + OkHttp + kotlinx.serialization (o Moshi). Un interceptor agrega `Authorization: Bearer <token>`.
- Ubicación: `FusedLocationProviderClient` (Google Play Services Location).
- Sensores: `SensorManager` con el **acelerómetro** (`TYPE_ACCELEROMETER` o `TYPE_LINEAR_ACCELERATION`) para
  detectar el agitado y el **giroscopio** (`TYPE_GYROSCOPE`) para confirmarlo. Si el teléfono no tiene
  giroscopio, se usa solo el acelerómetro.
- Trabajo en segundo plano: **WorkManager** (reintentos con red), un **Foreground Service de detección de
  agitado** mientras el operador tenga un viaje activo, y un **Foreground Service** de tipo `location` mientras
  haya una alerta de pánico activa.
- `minSdk` 26, `targetSdk` y `compileSdk` el más reciente estable.
- `BASE_URL` como `buildConfigField` por tipo de build:
  - `debug`: `http://10.0.2.2:3000/api/`
  - `release`: `https://trazzo-vosj.onrender.com/api/`

## Estilo visual (igual que la web)

Tema oscuro por defecto y claro automático según el sistema.

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| fondo | `#0B0F17` | `#EEF1F7` | fondo de pantalla |
| panel | `#121826` | `#FFFFFF` | tarjetas |
| línea | `#243049` | `#DDE2EC` | bordes |
| texto | `#E6EBF5` | `#111827` | texto principal |
| texto secundario | `#8B96AD` | `#5D6679` | etiquetas |
| marca | `#12306B` | `#12306B` | logotipo, barra superior |
| acento | `#FFB020` | `#C77800` | botón principal |
| en ruta / ok | `#3DDC97` | `#0F8A57` | estado «En ruta» |
| espera | `#FFB020` | `#B86E00` | «Asignado», «Pendiente» |
| alerta | `#FF5C6C` | `#D93446` | «Retraso», **botón de pánico** |
| info | `#5B9DFF` | `#2F6FDE` | enlaces |

Tipografías: **Inter** para texto y **JetBrains Mono** para folios (`TRZ-0013`), placas y cifras. Esquinas de
14 dp en tarjetas. Ícono de la app: cuadrado redondeado azul `#12306B` con una «T» blanca y un triángulo naranja
`#FF8A1F` en la esquina inferior derecha.

## Contrato de la API

- Todas las respuestas son JSON. Los errores traen `{ "message": "texto para mostrar al usuario" }`.
- Fechas en ISO 8601 UTC (por ejemplo `"2026-10-27T08:09:00.000Z"`): muéstralas en la hora local del teléfono.
- `401` = sesión vencida o inválida → borrar el token y llevar al inicio de sesión (con la excepción del botón de
  pánico, ver más abajo). `403` = sin permiso. `409` = conflicto (el mensaje explica por qué). `429` = demasiadas
  solicitudes.
- El token dura **8 horas**.

### Sesión

- `POST /auth/login` · cuerpo `{ "correo": "...", "contraseña": "..." }` (la clave del campo lleva **ñ**).
  Responde `{ "token": "...", "usuario": { "id": 2, "nombre": "Juan Pérez", "correo": "...", "rol": "operador" } }`.
  Esta app es solo para el rol `operador`: con otro rol, muestra «Esta app es para operadores» y no guardes la
  sesión.
- `GET /auth/me` → datos del usuario del token (para validar la sesión al abrir la app).

### Viajes del operador

- `GET /viajes` → arreglo con **solo los viajes del operador** (activos y entregados de los últimos 3 días).
  Cada viaje:
  `id, folio, origen, destino, mercancia, peso_kg, num_unidades, cliente, salida, distancia_km, duracion_min,
  estado, avance (0-100), eta, entregado_en, operador_id, operador, unidad_id, placas, marca_modelo`.
  (Puede traer otros campos: ignóralos.)
- `GET /viajes/:id` → el viaje y `eventos: [{ tipo, descripcion, creado_en, ... }]` (historial, el más reciente
  primero).
- `GET /viajes/historial?pagina=1&por_pagina=20` → historial paginado del operador.
- `PATCH /viajes/:id/estado` · cuerpo `{ "estado": "...", "nota": "opcional" }`. Transiciones permitidas para el
  operador:
  - `asignado` → `en_ruta` (botón «Iniciar viaje»)
  - `en_ruta` → `retraso` («Reportar retraso», pide la nota) o `entregado` («Confirmar entrega»)
  - `retraso` → `en_ruta` («Ya avanzo normal») o `entregado`
  - Cancelar es solo de la oficina: no lo muestres.
- Estados y colores: `pendiente` (espera), `asignado` (espera), `en_ruta` (ok), `retraso` (alerta),
  `entregado` (secundario), `cancelado` (secundario).

### Botón de pánico

- `POST /panico` · cuerpo `{ "lat": 19.26, "lon": -98.41, "precision_m": 12, "nota": "opcional" }`.
  `lat`/`lon` son opcionales (si no hay GPS manda la alerta sin ellos, **nunca la retrases por esperar el GPS**).
  - `201 { "alerta": {...}, "nueva": true }` → alerta creada.
  - `200 { "alerta": {...}, "nueva": false }` → ya había una activa (reintento o se mandó dos veces): es la misma.
    El endpoint es **idempotente**: reintentar es seguro.
- `POST /panico/:id/ubicacion` · `{ "lat", "lon", "precision_m" }` → `{ "alerta": {...} }`. Responde `409` cuando
  un administrador ya cerró la alerta: en ese caso detén el seguimiento y avisa al operador.
- `GET /panico/mia` → `{ "alerta": {...} }` o `{ "alerta": null }`. Llámalo al abrir la app y al volver de segundo
  plano para recuperar el estado.
- Objeto `alerta`: `id, estado ("activa" | "atendida" | "falsa_alarma"), operador_id, operador, viaje_id, folio,
  origen, destino, unidad_id, placas, marca_modelo, lat, lon, precision_m, ubicacion_en, nota, creada_en,
  atendida_por, atendio, atendida_en, resolucion`.
- Límite: 30 solicitudes por minuto por operador.
- **El operador no puede cancelar una alerta** (a propósito: si lo obligan, debe seguir activa). Solo la cierra un
  administrador desde la web.

## Fases

### Fase 1 · Base del proyecto y sesión
- Proyecto, tema (tabla de colores), tipografías, navegación, capa de red, almacenamiento cifrado del token.
- Pantalla de **inicio de sesión** (correo, contraseña, botón «Entrar», errores del servidor visibles).
- Al abrir: si hay token, validar con `GET /auth/me`; si no, ir al inicio de sesión. Cerrar sesión en el menú.
- **Listo cuando:** puedo entrar con `juan.perez@trazzo.mx` / `trazzo123` contra el backend local (emulador) y
  una cuenta que no es operador recibe el aviso.

### Fase 2 · Mi viaje
- **Inicio:** tarjeta grande del viaje activo (folio, origen → destino, cliente, mercancía y peso, placas y modelo,
  salida, hora estimada de llegada, barra de avance, estado con color) y los botones de la transición que
  corresponda. Si no tiene viaje activo: «No tienes viajes asignados».
- **Detalle:** datos completos e historial de eventos.
- **Historial:** lista paginada de sus viajes.
- Refrescar al jalar hacia abajo y cada 30 s mientras la pantalla esté visible.
- **Listo cuando:** inicio un viaje asignado, reporto un retraso con nota y confirmo la entrega, y lo veo
  reflejado en la web.

### Fase 3 · Botón de pánico (la más importante)

El flujo es: **agitar el teléfono → se abre la pantalla de pánico → mantener presionado el botón 5 segundos →
se envía la alerta y empieza el rastreo.**

**3a. Agitar el teléfono para abrir la pantalla de pánico**
- Un **Foreground Service de detección** escucha el acelerómetro y el giroscopio. Está encendido solo mientras el
  operador tiene sesión y un viaje `asignado`, `en_ruta` o `retraso` (para cuidar la batería), con una
  notificación discreta y permanente («Trazzo · protección activa»). Se apaga al cerrar sesión o al terminar el
  viaje, y se vuelve a encender al reiniciar el teléfono (`BOOT_COMPLETED`) si sigue habiendo un viaje activo.
- **Cómo se reconoce el agitado** (para no confundirlo con baches, frenadas o con el teléfono en el tablero):
  - Al menos **3 sacudidas en menos de 1.5 segundos**. Cada sacudida es una aceleración (sin gravedad) mayor a
    unos **2.5 g**, alternando de dirección.
  - El **giroscopio** confirma que hubo un movimiento brusco de la mano: rotación por encima de unos **4 rad/s**
    durante las sacudidas. La vibración pareja del camión no gira el teléfono así.
  - Después de reconocer un agitado, esperar **10 segundos** antes de aceptar otro.
  - Los umbrales van en constantes y hay un ajuste de **sensibilidad** (baja, media o alta) en Ajustes, además de
    un interruptor para apagar la función.
- **Al reconocer el agitado:** vibrar dos veces cortas y **abrir la app directo en la pantalla de pánico**,
  incluso si la app está cerrada o en segundo plano y **con la pantalla bloqueada**:
  - Android no deja abrir una Activity desde segundo plano sin más. Usa una notificación con **full-screen
    intent** (categoría alarma, prioridad máxima) que abre la pantalla de pánico, con `setShowWhenLocked(true)` y
    `setTurnScreenOn(true)` en esa Activity.
  - En Android 14 o más reciente el permiso `USE_FULL_SCREEN_INTENT` puede requerir que el usuario lo conceda:
    revísalo con `NotificationManager.canUseFullScreenIntent()` y, si falta, llévalo a la pantalla de ajustes
    correspondiente durante la configuración inicial.
  - Si no se puede mostrar a pantalla completa, al menos muestra una notificación de alta prioridad que abra la
    pantalla de pánico al tocarla.
  - Si la app ya está abierta, solo navega a la pantalla de pánico.
- **Abrir la pantalla de pánico NO envía nada.** Solo el paso 3b envía la alerta. Si el operador no hace nada en
  **30 segundos**, la pantalla se cierra sola sin enviar.
- Explica en el resumen de la fase qué tipo de Foreground Service usaste para la detección y por qué (en Android
  14+ cada servicio debe declarar su tipo; si usas `specialUse`, incluye la justificación en el manifiesto).

**3b. Pantalla de pánico y envío**
- Pantalla roja (color alerta) con un **botón circular grande «Mantén presionado para enviar alerta»**, el folio y
  las placas del viaje, y un enlace pequeño «Cancelar» para salir sin enviar.
- La misma pantalla también se puede abrir sin agitar: botón rojo «Pánico» siempre visible en la pantalla de
  inicio.
- **Mantener presionado 5 segundos** con un anillo de progreso y una cuenta regresiva (5, 4, 3, 2, 1) y una
  vibración corta por segundo. Si suelta antes, el progreso vuelve a cero y no se envía nada. Al completarse,
  vibración larga y se envía.
- **Al enviarse, en este orden:**
  1. Enviar `POST /panico` **de inmediato** con la última ubicación conocida (o sin ubicación) y, si se puede,
     una segunda vez en cuanto haya una lectura precisa (el endpoint es idempotente).
  2. Iniciar un **Foreground Service** de ubicación con notificación persistente («Alerta enviada · compartiendo
     ubicación») que mande `POST /panico/:id/ubicacion` cada **30 s** mientras la alerta siga activa.
  3. Consultar `GET /panico/mia` periódicamente (cada 60 s) y al volver a la app; cuando la alerta ya no esté
     activa (o una ubicación responda `409`), detener el servicio y mostrar «Un administrador atendió tu alerta».
- **Sin red:** encolar la alerta con WorkManager (restricción de red, reintento con backoff) y mostrar
  «Sin señal: la alerta se enviará en cuanto haya conexión». Las ubicaciones tomadas sin red se pueden descartar;
  lo importante es que la alerta llegue.
- **Sesión vencida durante una emergencia:** si `POST /panico` responde `401`, guarda la alerta pendiente, pide
  iniciar sesión y envíala automáticamente justo después. Nunca descartes una alerta por `401`.
- **Modo discreto** (activado en Ajustes, apagado por defecto): tras activar, la pantalla no muestra nada llamativo
  (sin pantalla roja ni sonido; notificación con texto neutro como «Sincronizando ruta»), por si el asaltante
  está viendo el teléfono.
- **Permisos y configuración inicial:** una pantalla propia que explique para qué sirve cada cosa antes de
  pedirla: ubicación precisa, ubicación en segundo plano, notificaciones, servicios en primer plano,
  notificaciones a pantalla completa (`USE_FULL_SCREEN_INTENT`), arranque al encender (`RECEIVE_BOOT_COMPLETED`)
  y, si hace falta para que el servicio de detección no se detenga, excluir la app de la optimización de batería.
  Incluye un botón **«Probar agitado»** que confirme que la detección funciona **sin enviar ninguna alerta**.
  Si el operador niega la ubicación, el botón de pánico **sigue funcionando** sin GPS y se le avisa.
- **Estado visible:** mientras haya alerta activa, una franja en la pantalla de inicio («Alerta activa desde las
  02:09 · enviando ubicación») salvo en modo discreto.
- **Listo cuando:**
  - Con un viaje activo y la app cerrada o la pantalla bloqueada, agitar el teléfono abre la pantalla de pánico.
    Caminar, dejarlo en el tablero o moverlo normal no la abre.
  - Abrir la pantalla y no hacer nada, o soltar el botón antes de 5 s, **no envía alerta**.
  - Mantenerlo 5 s envía la alerta y la web muestra el aviso en menos de 10 s con el recorrido.
  - Con la ubicación simulada en movimiento, el teléfono sigue mandando la ubicación con la app en segundo plano.
  - Al marcarla como atendida en la web, la app detiene el rastreo y lo indica.
  - Con el modo avión activado y luego desactivado, la alerta llega en cuanto vuelve la señal.
  - Sin viaje activo o al cerrar sesión, el servicio de detección se apaga.

### Fase 4 · Pulido
- Estados de carga, vacío y error en todas las pantallas; mensajes del servidor visibles.
- Accesibilidad: descripciones de contenido, tamaños táctiles de al menos 48 dp, contraste suficiente.
- Pruebas unitarias de ViewModels y repositorios (API simulada con MockWebServer), incluido el flujo de pánico
  sin red y con `401`.
- Pruebas unitarias del **detector de agitado** con series de lecturas grabadas o generadas: agitado real (sí),
  baches y frenadas del camión, caminar, teléfono en el tablero (no), y que respete los 10 s de espera.
- Medir el consumo de batería del servicio de detección durante 1 hora y reportarlo; si es alto, bajar la
  frecuencia de muestreo (`SENSOR_DELAY_GAME` o menor).
- `README` del proyecto Android: cómo correrlo contra el backend local y contra producción.

## Cómo probar contra el backend local

El backend corre en mi computadora en el puerto 3000 (`pnpm dev` o `node --watch-path=src src/server.js` dentro de `Trazzo/Backend`).
Desde el emulador se llega con `http://10.0.2.2:3000/api/`. Cuentas de prueba (solo en la base local):
`juan.perez@trazzo.mx`, `laura@trazzo.mx`, `raul@trazzo.mx`, todas con contraseña `trazzo123`. Para ver las
alertas en la web entra a `http://localhost:3000` con la cuenta de administrador.

Para simular el agitado en el emulador usa **Extended controls → Virtual sensors** (mover y rotar el dispositivo
de forma brusca). Como eso es difícil de reproducir, agrega en el build `debug` una opción oculta en Ajustes que
inyecte una serie de lecturas de agitado en el detector. La prueba final del agitado debe hacerse en un
teléfono físico.

## Fuera de alcance por ahora
- Pantallas para administradores dentro de la app (las alertas se atienden en la web).
- Notificaciones push con Firebase Cloud Messaging (requiere cambios en el backend que aún no existen).
- Seguimiento GPS continuo fuera de una alerta de pánico.
