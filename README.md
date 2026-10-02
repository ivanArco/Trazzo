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

Para entrar a la demostración escribe cualquier correo y una contraseña de 6 caracteres o más.
