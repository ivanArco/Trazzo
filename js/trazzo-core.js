
    /* ==========================================================
       TRAZZO · Centro de Control — comportamiento de la interfaz
       Cada función atiende una sola parte de la página y se
       inicializa al final del archivo.
       ========================================================== */
    'use strict';

    const $ = (sel, raiz = document) => raiz.querySelector(sel);
    const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

    /* ---------- Aviso flotante (toast) ---------- */
    let temporizadorAviso;

    function mostrarAviso(texto) {
      const toast = $('#toast');
      if (!toast) return;
      // Con un diálogo abierto, el aviso va dentro de él para que no quede detrás
      ($('dialog[open]') || document.body).append(toast);
      toast.textContent = texto;
      toast.classList.add('is-on');
      clearTimeout(temporizadorAviso);
      temporizadorAviso = setTimeout(() => toast.classList.remove('is-on'), 3200);
    }

    /* ---------- Navegación: enlace activo y menú móvil ---------- */
    function marcarEnlaceActivo() {
      const actual = location.hash || '#login';
      $$('.nav__links a').forEach((a) => {
        if (a.getAttribute('href') === actual) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    }

    function iniciarMenu() {
      const nav = $('#nav');
      const boton = $('.nav__toggle');
      if (!nav || !boton) return;

      const cerrar = () => {
        nav.classList.remove('is-open');
        boton.setAttribute('aria-expanded', 'false');
        boton.setAttribute('aria-label', 'Abrir menú');
      };

      boton.addEventListener('click', () => {
        const abierto = nav.classList.toggle('is-open');
        boton.setAttribute('aria-expanded', String(abierto));
        boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
      });

      // Al elegir una sección, el menú se cierra
      $$('.nav__links a').forEach((a) => a.addEventListener('click', cerrar));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

      window.addEventListener('hashchange', marcarEnlaceActivo);
      marcarEnlaceActivo();
    }

    /* ---------- Reloj en vivo del encabezado ---------- */
    function iniciarReloj() {
      const reloj = $('#reloj');
      if (!reloj) return;

      const formato = new Intl.DateTimeFormat('es-MX', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false
      });

      const actualizar = () => {
        const ahora = new Date();
        reloj.textContent = formato.format(ahora).replace(/\./g, '');
        reloj.dateTime = ahora.toISOString();
      };

      actualizar();
      setInterval(actualizar, 30000);

      const anio = $('#anio');
      if (anio) anio.textContent = new Date().getFullYear();
    }

    /* ---------- Monitoreo: filtro por estado y búsqueda ---------- */
    const filtro = { estado: 'todos', texto: '' };

    function aplicarFiltro() {
      const tarjetas = $$('#tablero-viajes .tcard');
      let visibles = 0;

      tarjetas.forEach((t) => {
        const coincideEstado = filtro.estado === 'todos' || t.dataset.estado === filtro.estado;
        const coincideTexto = t.textContent.toLowerCase().includes(filtro.texto);
        const mostrar = coincideEstado && coincideTexto;
        t.hidden = !mostrar;
        if (mostrar) visibles++;
      });

      $('#sin-resultados').hidden = visibles > 0;

      // La búsqueda también filtra la tabla del tablero
      $$('#tabla-viajes tbody tr').forEach((fila) => {
        fila.hidden = !fila.textContent.toLowerCase().includes(filtro.texto);
      });
    }

    function iniciarFiltros() {
      const botones = $$('.seg button[data-filtro]');
      botones.forEach((b) => {
        b.addEventListener('click', () => {
          botones.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          filtro.estado = b.dataset.filtro;
          aplicarFiltro();
        });
      });

      const buscar = $('#buscar');
      if (!buscar) return;

      buscar.addEventListener('input', () => {
        filtro.texto = buscar.value.trim().toLowerCase();
        aplicarFiltro();
      });

      // Enter lleva al monitoreo con el resultado
      buscar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') location.hash = '#monitoreo';
      });

      // Atajo Ctrl + K (o ⌘ + K) para enfocar el buscador
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          buscar.focus();
        }
      });
    }

    /* ---------- Validación de formularios ---------- */
    function mensajeDeError(campo) {
      const v = campo.validity;
      if (v.valueMissing) return 'Este campo es obligatorio.';
      if (v.typeMismatch && campo.type === 'email') return 'Escribe un correo válido, por ejemplo usuario@trazzo.mx.';
      if (v.typeMismatch && campo.type === 'url') return 'Pega un enlace completo que empiece con https://';
      if (v.tooShort) return `Usa al menos ${campo.minLength} caracteres.`;
      if (v.rangeUnderflow) return `El valor mínimo es ${campo.min}.`;
      return 'Revisa este dato.';
    }

    function validarCampo(campo) {
      const etiqueta = campo.closest('.f');
      let error = etiqueta && $('.err', etiqueta);

      if (campo.checkValidity()) {
        campo.removeAttribute('aria-invalid');
        if (error) error.remove();
        return true;
      }

      campo.setAttribute('aria-invalid', 'true');
      if (etiqueta && !error) {
        error = document.createElement('small');
        error.className = 'err';
        etiqueta.append(error);
      }
      if (error) error.textContent = mensajeDeError(campo);
      return false;
    }

    function validarFormulario(form) {
      const campos = $$('input, select, textarea', form);
      const validos = campos.map(validarCampo).every(Boolean);
      if (!validos) $('[aria-invalid="true"]', form)?.focus();
      return validos;
    }

    function revalidarAlEscribir(form) {
      form.addEventListener('input', (e) => {
        if (e.target.hasAttribute('aria-invalid')) validarCampo(e.target);
      });
    }

    /* ---------- Utilidades: HTML seguro y formatos ---------- */
    // Todo texto entra con textContent: un dato de la base nunca se interpreta como HTML
    function el(etiqueta, props = {}, ...hijos) {
      const nodo = document.createElement(etiqueta);
      for (const [clave, valor] of Object.entries(props)) {
        if (valor === null || valor === undefined || valor === false) continue;
        if (clave === 'class') nodo.className = valor;
        else if (clave === 'text') nodo.textContent = valor;
        else if (clave === 'style') nodo.style.cssText = valor;
        else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
        else nodo.setAttribute(clave, valor === true ? '' : valor);
      }
      nodo.append(...hijos.flat().filter((h) => h !== null && h !== undefined && h !== false));
      return nodo;
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';

    function icono(nombre) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'i');
      svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS(SVG_NS, 'use');
      use.setAttribute('href', `#${nombre}`);
      svg.append(use);
      return svg;
    }

    const fmtHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    const fmtFechaHora = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    const fmtDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const fmtDineroCorto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', notation: 'compact', maximumFractionDigits: 1 });
    const fmtNumero = new Intl.NumberFormat('es-MX');
    const fmtRelativo = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });

    const esHoy = (fecha) => new Date(fecha).toDateString() === new Date().toDateString();
    const hora = (fecha) => (fecha ? (esHoy(fecha) ? fmtHora : fmtFechaHora).format(new Date(fecha)).replace(/\./g, '') : '—');
    const dosDigitos = (n) => String(n).padStart(2, '0');

    function haceCuanto(fecha) {
      const minutos = Math.round((new Date(fecha) - Date.now()) / 60000);
      if (Math.abs(minutos) < 60) return fmtRelativo.format(minutos, 'minute');
      const horas = Math.round(minutos / 60);
      if (Math.abs(horas) < 24) return fmtRelativo.format(horas, 'hour');
      return fmtRelativo.format(Math.round(horas / 24), 'day');
    }

    // "Parque Industrial FINSA, Puebla" → "Puebla"
    const ciudad = (texto) => ((texto || '').split(',').pop().trim() || '—');
    // "Juan Pérez" → "J. Pérez"
    const nombreCorto = (nombre) => {
      const partes = (nombre || '').trim().split(/\s+/);
      return partes.length > 1 ? `${partes[0][0]}. ${partes.slice(1).join(' ')}` : (nombre || '—');
    };
    const iniciales = (nombre) => (nombre || '').trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

    // Estado del viaje → texto y color (go, wait, alert, done son las clases del diseño)
    const ESTADOS = {
      pendiente: { texto: 'Pendiente', clase: 'wait' },
      asignado: { texto: 'Asignado', clase: 'go' },
      en_ruta: { texto: 'En ruta', clase: 'go' },
      retraso: { texto: 'Retraso', clase: 'alert' },
      entregado: { texto: 'Entregado', clase: 'done' },
      cancelado: { texto: 'Cancelado', clase: 'done' }
    };

    function etaTexto(viaje) {
      if (['pendiente', 'asignado'].includes(viaje.estado)) return `Sale ${hora(viaje.salida)}`;
      if (viaje.estado === 'entregado') return hora(viaje.entregado_en);
      if (viaje.estado === 'cancelado') return '—';
      return `ETA ${hora(viaje.eta)}`;
    }

    /* ---------- Conexión con la API (backend) ---------- */
    // Dónde está la API (misma regla que rastreo.html):
    //   · servidor de archivos de desarrollo (Live Server 5500/5501, python 8000/8080) → puerto 3000 del mismo equipo
    //   · otra dirección local o Render: la página la sirve el propio backend → la misma dirección
    //   · publicada en otro hosting (GitLab Pages) → el backend publicado en Render
    const API_PUBLICA = 'https://trazzo-vosj.onrender.com/api';
    const RED_LOCAL = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
    const SERVIDOR_DE_ARCHIVOS = ['5500', '5501', '8000', '8080'].includes(location.port);
    const API_URL = RED_LOCAL.test(location.hostname)
      ? (SERVIDOR_DE_ARCHIVOS ? `${location.protocol}//${location.hostname}:3000/api` : `${location.origin}/api`)
      : location.hostname.endsWith('.onrender.com') ? `${location.origin}/api` : API_PUBLICA;

    const ROLES = {
      admin: { nombre: 'Administrador', clase: 'role--admin', dispositivos: 'Web · TV' },
      capturista: { nombre: 'Capturista', clase: 'role--cap', dispositivos: 'Web' },
      operador: { nombre: 'Operador', clase: 'role--op', dispositivos: 'Móvil · Wear OS' },
      cliente: { nombre: 'Cliente', clase: 'role--cli', dispositivos: 'Web' }
    };

    // La sesión vive en sessionStorage: se borra al cerrar la pestaña
    const sesion = {
      leer() {
        try { return JSON.parse(sessionStorage.getItem('trazzo-sesion')); } catch { return null; }
      },
      guardar(datos) { sessionStorage.setItem('trazzo-sesion', JSON.stringify(datos)); },
      borrar() { sessionStorage.removeItem('trazzo-sesion'); }
    };

    // Copia de las últimas consultas en la Cache API del navegador para poder mostrarlas sin conexión.
    // Cada respuesta se guarda como un Response con su URL completa; se borra al cerrar sesión.
    // (El nombre 'trazzo-api' también está en sw.js para que no se borre al publicar una versión nueva.)
    const CACHE_API = 'trazzo-api';
    const cacheApi = {
      async leer(ruta) {
        try {
          const guardado = await (await caches.open(CACHE_API)).match(API_URL + ruta);
          return guardado ? await guardado.json() : null;
        } catch { return null; } // sin Cache API (http sin localhost) o almacenamiento bloqueado
      },
      async guardar(ruta, datos) {
        try {
          const respuesta = new Response(JSON.stringify(datos), {
            headers: { 'Content-Type': 'application/json', 'X-Guardado-En': new Date().toISOString() }
          });
          await (await caches.open(CACHE_API)).put(API_URL + ruta, respuesta);
        } catch { /* almacenamiento lleno o bloqueado */ }
      },
      async borrar() {
        try { await caches.delete(CACHE_API); } catch { /* sin acceso al almacenamiento */ }
        // Limpia la copia de versiones anteriores, que se guardaba en localStorage
        try {
          Object.keys(localStorage).filter((k) => k.startsWith('trazzo-cache:')).forEach((k) => localStorage.removeItem(k));
        } catch { /* sin acceso al almacenamiento */ }
      }
    };

    // fetch con el token y manejo de errores; lanza Error con el mensaje del servidor
    async function api(ruta, { method = 'GET', body } = {}) {
      const token = sesion.leer()?.token;
      let respuesta;
      try {
        respuesta = await fetch(API_URL + ruta, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: body && JSON.stringify(body)
        });
      } catch {
        // Sin red: las consultas usan la última copia guardada; los cambios no se pueden enviar
        const guardado = method === 'GET' && await cacheApi.leer(ruta);
        if (guardado) return guardado;
        throw new Error(navigator.onLine
          ? 'No hay conexión con el servidor. ¿Está encendido el backend?'
          : 'Sin conexión a internet. Inténtalo cuando vuelva la señal.');
      }

      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.status === 401 && token) {
        cerrarSesion();
        mostrarAviso(datos.message || 'Tu sesión expiró.');
      }
      if (!respuesta.ok) throw Object.assign(new Error(datos.message || `Error ${respuesta.status}`), { status: respuesta.status });
      if (method === 'GET') await cacheApi.guardar(ruta, datos);
      return datos;
    }

    /* ---------- Acceso y permisos por rol ---------- */
    let destinoTrasLogin = '#tablero';

    // data-rol="admin capturista" → solo esos roles ven el elemento o la sección
    const permitidoPara = (elemento, rol) => !elemento?.dataset.rol || elemento.dataset.rol.split(' ').includes(rol);
    const enlaceDeSeccion = (hash) => $$('.nav__links a').find((a) => a.getAttribute('href') === hash);
    const usuarioActual = () => sesion.leer()?.usuario;
    const esOficina = () => ['admin', 'capturista'].includes(usuarioActual()?.rol);

    function mostrarUsuario(usuario) {
      const rol = ROLES[usuario?.rol];
      $('#usuario-iniciales').textContent = iniciales(usuario?.nombre) || '—';
      $('#usuario-nombre').textContent = usuario?.nombre || '—';
      $('#usuario-rol').textContent = rol ? rol.nombre : '';
      $('#pv-capturo').textContent = usuario?.nombre || '—';

      // Oculta enlaces y botones que no corresponden al rol
      $$('[data-rol]').forEach((n) => { n.hidden = !permitidoPara(n, usuario?.rol); });
      actualizarBotonAvisos(usuario);
    }

    function cerrarSesion() {
      quitarAvisosDelServidor(); // este equipo deja de recibir los avisos de quien cerró sesión
      sesion.borrar();
      cacheApi.borrar();
      $('#asis-panel').hidden = true;
      $('#asig').hidden = true;
      reiniciarAsistente();
      mostrarUsuario(null);
      location.hash = '#login';
    }

    // Sin sesión solo se puede ver el acceso; con sesión, solo las secciones del rol
    function protegerSecciones() {
      const actual = location.hash;
      const usuario = usuarioActual();

      if (!usuario) {
        if (actual && actual !== '#login') {
          destinoTrasLogin = actual;
          location.hash = '#login';
        }
        return false;
      }
      if (!permitidoPara(enlaceDeSeccion(actual), usuario.rol)) {
        mostrarAviso('Tu rol no tiene acceso a esa sección.');
        location.hash = '#tablero';
        return false;
      }
      return true;
    }

    function iniciarLogin() {
      const form = $('#form-login');
      if (!form) return;
      revalidarAlEscribir(form);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validarFormulario(form)) return;

        const boton = $('button[type="submit"]', form);
        boton.disabled = true;
        try {
          const datos = await api('/auth/login', {
            method: 'POST',
            body: { correo: form.correo.value, contraseña: form.clave.value }
          });
          sesion.guardar(datos);
          mostrarUsuario(datos.usuario);
          form.reset();
          location.hash = destinoTrasLogin === '#login' ? '#tablero' : destinoTrasLogin;
          mostrarAviso(`Bienvenido, ${datos.usuario.nombre}.`);
        } catch (error) {
          mostrarAviso(error.message);
        } finally {
          boton.disabled = false;
        }
      });

      $('#cerrar-sesion')?.addEventListener('click', (e) => {
        e.preventDefault();
        cerrarSesion();
        mostrarAviso('Sesión cerrada.');
      });

      // Al recargar la página se conserva la sesión; se confirma con el servidor
      const guardada = sesion.leer();
      mostrarUsuario(guardada?.usuario);
      if (guardada) api('/auth/me').catch(() => { /* api() ya cierra la sesión si expiró */ });
    }

    /* ---------- Carga de datos por sección ---------- */
    const cargadores = {
      tablero: cargarTablero,
      monitoreo: cargarMonitoreo,
      ruta: cargarPorAsignar,
      personal: cargarUsuarios,
      historial: cargarHistorial,
      flota: cargarFlota,
      trafico: cargarTrafico
    };

    async function cargarSeccion({ silencioso = false } = {}) {
      const cargar = cargadores[location.hash.slice(1)];
      if (!cargar || !usuarioActual() || !permitidoPara(enlaceDeSeccion(location.hash), usuarioActual().rol)) return;
      try {
        await cargar();
      } catch (error) {
        if (!silencioso) mostrarAviso(error.message);
      }
    }

    function iniciarNavegacionConDatos() {
      // «Asignación» ahora vive dentro de «Rutas»: los enlaces viejos a #asignar llevan ahí
      const redirigir = () => { if (location.hash === '#asignar') location.replace('#ruta'); };
      window.addEventListener('hashchange', () => {
        redirigir();
        if (protegerSecciones()) cargarSeccion();
      });
      redirigir();
      if (protegerSecciones()) cargarSeccion();

      // Seguimiento en vivo: cada 10 s se refresca lo que se está viendo
      setInterval(() => {
        if (document.hidden || !navigator.onLine || !usuarioActual()) return;
        if (['#tablero', '#monitoreo', '#trafico'].includes(location.hash)) cargarSeccion({ silencioso: true });
        if ($('#dlg-viaje').open) refrescarDetalle();
      }, 10000);
    }

    /* ---------- Tablero ---------- */
    async function cargarTablero() {
      const [resumen, viajes, eventos] = await Promise.all([
        api('/viajes/resumen'), api('/viajes'), api('/viajes/eventos')
      ]);
      pintarResumen(resumen);
      pintarTablaViajes(viajes);
      pintarMapa(viajes);
      pintarEventos(eventos);
      aplicarFiltro();
    }

    function pintarResumen(r) {
      $('#kpi-activos').textContent = dosDigitos(r.activos);
      $('#kpi-retrasos').textContent = r.retrasos ? `${r.retrasos} con retraso` : 'Sin retrasos';
      $('#kpi-por-asignar').textContent = dosDigitos(r.por_asignar);
      $('#kpi-entregas').textContent = dosDigitos(r.entregas_hoy);
      $('#kpi-flete').textContent = fmtDineroCorto.format(r.flete_mes);
      $('#flota-disponible').textContent = dosDigitos(r.flota.disponible);
      $('#flota-en-ruta').textContent = dosDigitos(r.flota.en_ruta);
      $('#flota-taller').textContent = dosDigitos(r.flota.taller);

      const badge = $('#alertas-total');
      badge.hidden = !r.retrasos;
      badge.textContent = r.retrasos;
      badge.title = 'Viajes con retraso';
      pintarContadorMenu(r.por_asignar);
    }

    function pintarContadorMenu(porAsignar) {
      const em = $('#nav-por-asignar');
      em.hidden = !porAsignar;
      em.textContent = porAsignar;
      em.setAttribute('aria-label', `${porAsignar} por asignar`);
    }

    function pintarTablaViajes(viajes) {
      const cuerpo = $('#tabla-viajes-cuerpo');
      const filas = viajes.slice(0, 8).map((v) => {
        const e = ESTADOS[v.estado];
        return el('tr', { class: 'fila-viaje', tabindex: 0, onclick: () => abrirDetalle(v.id), onkeydown: (ev) => { if (ev.key === 'Enter') abrirDetalle(v.id); } },
          el('td', { class: 'mono', text: v.folio }),
          el('td', { text: `${ciudad(v.origen)} → ${ciudad(v.destino)}` }),
          el('td', { text: v.operador ? nombreCorto(v.operador) : '—' }),
          el('td', { class: 'mono', text: v.placas || '—' }),
          el('td', {}, el('div', { class: 'bar-p', style: `--p:${v.avance}%`, role: 'img', 'aria-label': `${v.avance} %` })),
          el('td', { text: etaTexto(v) }),
          el('td', {}, el('span', { class: `st st--${e.clase}`, text: e.texto })));
      });
      cuerpo.replaceChildren(...(filas.length ? filas : [el('tr', {}, el('td', { colspan: 7, class: 'muted', text: 'Aún no hay viajes registrados.' }))]));
    }

    // Mapa esquemático: cada viaje en movimiento se coloca sobre una ruta según su avance (simulado)
    function pintarMapa(viajes) {
      const enMovimiento = viajes.filter((v) => ['en_ruta', 'retraso'].includes(v.estado));
      const rutas = $$('#mapa-unidades .mapa-ruta');
      const grupo = $('#mapa-puntos');
      const vigentes = new Set();

      enMovimiento.forEach((v, i) => {
        const ruta = rutas[i % rutas.length];
        const punto = ruta.getPointAtLength(ruta.getTotalLength() * v.avance / 100);
        let circulo = grupo.querySelector(`[data-id="${v.id}"]`);
        if (!circulo) {
          circulo = document.createElementNS(SVG_NS, 'circle');
          circulo.dataset.id = v.id;
          circulo.setAttribute('r', '2.4');
          circulo.append(document.createElementNS(SVG_NS, 'title'));
          grupo.append(circulo);
        }
        circulo.setAttribute('class', `punto ${v.estado === 'retraso' ? 'p-alert' : 'p-go'}`);
        circulo.setAttribute('cx', punto.x);
        circulo.setAttribute('cy', punto.y);
        circulo.firstChild.textContent = `${v.folio} · ${v.avance} %`;
        vigentes.add(String(v.id));
      });
      $$('circle', grupo).forEach((c) => { if (!vigentes.has(c.dataset.id)) c.remove(); });

      const n = enMovimiento.length;
      $('#mapa-texto').textContent = n ? `${n} unidad${n === 1 ? '' : 'es'} en movimiento · posición simulada` : 'Sin unidades en movimiento';
    }

    const claseEvento = (tipo) => ({ retraso: 'alert', creado: 'wait', cancelado: 'alert' }[tipo] || '');

    function pintarEventos(eventos) {
      const feed = $('#feed-alertas');
      const items = eventos.map((ev) => el('li', { class: `${claseEvento(ev.tipo)} fila-viaje`, tabindex: 0, onclick: () => abrirDetalle(ev.viaje_id) },
        el('b', { text: `${ev.folio} · ${ev.descripcion}` }),
        el('small', { text: haceCuanto(ev.creado_en) })));
      feed.replaceChildren(...(items.length ? items : [el('li', {}, el('b', { text: 'Sin actividad todavía' }))]));
    }

    /* ---------- Monitoreo ---------- */
    async function cargarMonitoreo() {
      const viajes = await api('/viajes');
      $('#tablero-viajes').replaceChildren(...viajes.map(tarjetaViaje));
      $('#mon-actualizado').textContent = `actualizado ${new Date().toLocaleTimeString('es-MX')}`;
      aplicarFiltro();
    }

    function tarjetaViaje(v) {
      const e = ESTADOS[v.estado];
      return el('article', { class: `tcard tcard--${e.clase}`, 'data-estado': e.clase },
        el('header', {}, el('span', { class: 'mono', text: v.folio }), el('span', { class: `st st--${e.clase}`, text: e.texto })),
        el('h3', {}, `${ciudad(v.origen)} `, el('i', { text: '→' }), ` ${ciudad(v.destino)}`),
        el('div', { class: 'track' }, el('span', { style: `--p:${v.avance}%` })),
        el('footer', {},
          el('span', {}, icono('i-user'), v.operador ? nombreCorto(v.operador) : 'Sin asignar'),
          el('span', {}, icono(v.estado === 'entregado' ? 'i-check' : 'i-clock'), etaTexto(v))),
        el('button', { type: 'button', class: 'tcard__ver', onclick: () => abrirDetalle(v.id) }, `Seguimiento · ${v.avance} % →`));
    }

    /* ---------- Seguimiento de un viaje (diálogo) ---------- */
    let viajeAbierto = null;

    async function abrirDetalle(id) {
      try {
        if (viajeAbierto !== id) $('#dv-rastreo').hidden = true;
        viajeAbierto = id;
        $('#dv-nota').value = '';
        pintarDetalle(await api(`/viajes/${id}`));
        const dialogo = $('#dlg-viaje');
        if (!dialogo.open) dialogo.showModal();
      } catch (error) {
        mostrarAviso(error.message);
      }
    }

    async function refrescarDetalle() {
      if (!viajeAbierto) return;
      try { pintarDetalle(await api(`/viajes/${viajeAbierto}`)); } catch { /* se reintenta en la siguiente vuelta */ }
    }

    function pintarDetalle(v) {
      const e = ESTADOS[v.estado];
      $('#dv-tarjeta').className = `tcard tcard--${e.clase}`;
      $('#dv-folio').textContent = v.folio;
      $('#dv-estado').className = `st st--${e.clase}`;
      $('#dv-estado').textContent = e.texto;
      $('#dv-ruta').textContent = `${v.origen} → ${v.destino}`;
      $('#dv-avance').style.setProperty('--p', `${v.avance}%`);

      const entregado = v.estado === 'entregado';
      const datos = [
        ['Avance', `${v.avance} %`],
        ['Operador', v.operador || 'Sin asignar'],
        ['Unidad', v.placas ? `${v.placas} · ${v.marca_modelo}` : '—'],
        ['Mercancía', `${v.mercancia} · ${fmtNumero.format(v.peso_kg)} kg`],
        ['Cliente', v.cliente],
        ['Salida', hora(v.salida)],
        ['Traslado estimado', v.duracion_min ? `${duracionTexto(v.duracion_min)} · ${fmtNumero.format(v.distancia_km)} km` : '—'],
        [entregado ? 'Entregado' : 'Llegada estimada', entregado ? hora(v.entregado_en) : hora(v.eta)],
        ['Flete', fmtDinero.format(v.flete)]
      ];
      const filas = datos.map(([clave, valor]) => el('div', {}, el('dt', { text: clave }), el('dd', { text: valor })));
      [['GPS de origen', v.gps_origen], ['GPS de destino', v.gps_destino]].forEach(([clave, enlace]) => {
        if (enlace) filas.push(el('div', {}, el('dt', { text: clave }), el('dd', {}, el('a', { href: enlace, target: '_blank', rel: 'noopener', text: 'Abrir mapa ↗' }))));
      });
      $('#dv-datos').replaceChildren(...filas);

      pintarAcciones(v);
      $('#dv-eventos').replaceChildren(...v.eventos.map((ev) => el('li', { class: claseEvento(ev.tipo) },
        el('b', { text: ev.descripcion }),
        el('small', { text: `${hora(ev.creado_en)} · ${ev.usuario || 'Sistema'}` }))));
    }

    // Botones según el estado del viaje y el rol de quien lo ve
    function accionesPara(v, usuario) {
      const oficina = ['admin', 'capturista'].includes(usuario.rol);
      const puedeMover = oficina || (usuario.rol === 'operador' && v.operador_id === usuario.id);
      const acciones = [];

      if (oficina && ['pendiente', 'asignado'].includes(v.estado)) {
        acciones.push({ texto: v.estado === 'pendiente' ? 'Asignar operador' : 'Reasignar', irAsignar: true, principal: v.estado === 'pendiente' });
      }
      if (puedeMover && v.estado === 'asignado') acciones.push({ texto: 'Iniciar viaje', estado: 'en_ruta', principal: true });
      if (puedeMover && v.estado === 'en_ruta') acciones.push({ texto: 'Reportar retraso', estado: 'retraso' });
      if (puedeMover && v.estado === 'retraso') acciones.push({ texto: 'Recorrido normalizado', estado: 'en_ruta' });
      if (puedeMover && ['en_ruta', 'retraso'].includes(v.estado)) acciones.push({ texto: 'Marcar entregado', estado: 'entregado', principal: true });
      if (oficina && v.estado !== 'cancelado') {
        acciones.push({ texto: v.rastreo_activo ? 'Enlace de rastreo' : 'Compartir rastreo', rastreo: true });
      }
      if (oficina && !['entregado', 'cancelado'].includes(v.estado)) {
        acciones.push({ texto: 'Cancelar viaje', estado: 'cancelado', confirmar: `¿Cancelar el viaje ${v.folio}? Esta acción no se puede deshacer.` });
      }
      return acciones;
    }

    function pintarAcciones(v) {
      const usuario = usuarioActual();
      // Solo se redibujan si cambió el estado (el refresco de 10 s no debe quitar el botón bajo el dedo)
      const contenedor = $('#dv-botones');
      const clave = `${v.id}|${v.estado}|${v.operador_id}|${v.rastreo_activo}`;
      if (contenedor.dataset.clave === clave) return;
      contenedor.dataset.clave = clave;

      const acciones = usuario ? accionesPara(v, usuario) : [];
      $('#dv-acciones').hidden = !acciones.length;
      $('#dv-nota-campo').hidden = !acciones.some((a) => a.estado);
      $('#dv-botones').replaceChildren(...acciones.map((a) => el('button', {
        type: 'button',
        class: `btn ${a.principal ? 'btn--accent' : 'btn--ghost'}`,
        onclick: (ev) => ejecutarAccion(v, a, ev.currentTarget)
      }, a.texto)));
    }

    /* Rastreo público: enlace + QR que el cliente abre en su celular sin cuenta */
    async function mostrarRastreo(v, boton) {
      boton.disabled = true;
      try {
        // Se envía la carpeta donde está publicada la app (p. ej. usuario.gitlab.io/trazzo/) para armar el enlace
        const base = new URL('.', location.href).href;
        const { url, qr_svg: qr } = await api(`/viajes/${v.id}/rastreo`, { method: 'POST', body: { base } });
        const zona = $('#dv-rastreo');
        const enRedLocal = /^https?:\/\/(10|172\.(1[6-9]|2\d|3[01])|192\.168)\./.test(url);
        const copiar = async (ev) => {
          try {
            await navigator.clipboard.writeText(url);
            ev.currentTarget.textContent = 'Copiado ✓';
          } catch {
            mostrarAviso('No se pudo copiar; selecciona el enlace a mano.');
          }
        };
        const compartir = () => navigator.share({ title: `Rastreo ${v.folio} · Trazzo`, text: `Sigue tu envío ${v.folio} en vivo:`, url }).catch(() => {});
        const desactivar = async () => {
          if (!confirm('¿Desactivar el enlace? El QR que ya compartiste dejará de funcionar.')) return;
          try {
            await api(`/viajes/${v.id}/rastreo`, { method: 'DELETE' });
            zona.hidden = true;
            mostrarAviso('Enlace de rastreo desactivado.');
            await refrescarDetalle();
          } catch (error) {
            mostrarAviso(error.message);
          }
        };

        zona.replaceChildren(
          el('img', { class: 'dv-rastreo__qr', alt: `Código QR para rastrear ${v.folio}`, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}` }),
          el('div', { class: 'dv-rastreo__info' },
            el('b', { text: 'Rastreo para el cliente' }),
            el('small', { class: 'muted', text: 'Escanea el QR o comparte el enlace: verá el avance en vivo sin necesidad de cuenta.' }),
            el('a', { class: 'dv-rastreo__url mono', href: url, target: '_blank', rel: 'noopener', text: url }),
            enRedLocal && el('small', { class: 'muted', text: 'Enlace de red local: el celular debe estar conectado al mismo wifi que esta computadora.' }),
            el('div', { class: 'actions' },
              el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: copiar }, 'Copiar enlace'),
              navigator.share && el('button', { type: 'button', class: 'btn btn--accent btn--sm', onclick: compartir }, 'Compartir'),
              el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: desactivar }, 'Desactivar'))));
        zona.hidden = false;
        zona.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        await refrescarDetalle();
      } catch (error) {
        mostrarAviso(error.message);
      } finally {
        boton.disabled = false;
      }
    }

    async function ejecutarAccion(v, accion, boton) {
      if (accion.rastreo) {
        mostrarRastreo(v, boton);
        return;
      }
      if (accion.irAsignar) {
        $('#dlg-viaje').close();
        abrirAsignacion(v.id);
        return;
      }
      if (accion.confirmar && !confirm(accion.confirmar)) return;

      boton.disabled = true;
      try {
        const actualizado = await api(`/viajes/${v.id}/estado`, {
          method: 'PATCH',
          body: { estado: accion.estado, nota: $('#dv-nota').value }
        });
        $('#dv-nota').value = '';
        mostrarAviso(`${actualizado.folio}: ${ESTADOS[actualizado.estado].texto.toLowerCase()}.`);
        await refrescarDetalle();
        cargarSeccion({ silencioso: true });
      } catch (error) {
        mostrarAviso(error.message);
        boton.disabled = false;
      }
    }

    function iniciarDetalle() {
      const dialogo = $('#dlg-viaje');
      $('#dv-cerrar').addEventListener('click', () => dialogo.close());
      dialogo.addEventListener('close', () => {
        viajeAbierto = null;
        delete $('#dv-botones').dataset.clave;
      });
    }

    /* ---------- Nueva ruta ---------- */
    // Fecha de salida sugerida: mañana a las 13:00
    function fijarSalidaSugerida(form) {
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      manana.setHours(13, 0, 0, 0);
      const local = new Date(manana.getTime() - manana.getTimezoneOffset() * 60000);
      form.salida.value = local.toISOString().slice(0, 16);
    }

    // 135 → "2 h 15 min"
    function duracionTexto(minutos) {
      if (!minutos && minutos !== 0) return '—';
      const h = Math.floor(minutos / 60);
      const m = minutos % 60;
      return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
    }

    /* Mapa real de la vista previa (Leaflet + OpenStreetMap) */
    let mapaRuta = null;
    let capaRuta = null;

    function dibujarRuta(ruta) {
      if (!window.L) return; // sin internet Leaflet no carga: se queda el trazo esquemático
      const contenedor = $('#mapa-ruta');
      if (!mapaRuta) {
        contenedor.replaceChildren();
        mapaRuta = L.map(contenedor, { zoomControl: false, scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap'
        }).addTo(mapaRuta);
      }

      const color = (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      const punto = (lugar, relleno, texto) => L.circleMarker([lugar.lat, lugar.lon], {
        radius: 7, color: '#fff', weight: 2, fillColor: relleno, fillOpacity: 1
      }).bindTooltip(texto);

      capaRuta?.remove();
      capaRuta = L.layerGroup([
        L.polyline(ruta.trazo, { color: color('--accent'), weight: 5, opacity: .9 }),
        punto(ruta.origen, color('--go'), 'Origen'),
        punto(ruta.destino, color('--accent'), 'Destino')
      ]).addTo(mapaRuta);
      mapaRuta.invalidateSize();
      mapaRuta.fitBounds(L.latLngBounds(ruta.trazo), { padding: [24, 24] });
    }

    /* ---------- Tráfico en vivo (TomTom, solo administradores) ---------- */
    // El backend consulta TomTom a lo más cada 5 min por viaje; aquí se refresca cada 10 s
    // para mover el camión, pero las rutas y el tráfico salen de su caché.
    const NIVELES = {
      fluido: { texto: 'Fluido', clase: 'go' },
      moderado: { texto: 'Moderado', clase: 'wait' },
      pesado: { texto: 'Pesado', clase: 'alert' }
    };

    let mapaTrafico = null;
    const capasTrafico = {};          // flujo e incidentes: imágenes de TomTom servidas por el backend
    let capaViajeTrafico = null;      // rutas, incidentes y camión del viaje elegido
    let viajeTraficoId = null;
    let viajeEncuadrado = null;       // el mapa solo se reencuadra al cambiar de viaje

    const colorTema = (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim();

    function crearMapaTrafico() {
      if (mapaTrafico || !window.L) return mapaTrafico;
      const contenedor = $('#tr-mapa');
      contenedor.replaceChildren();
      mapaTrafico = L.map(contenedor).setView([19.9, -99.6], 7);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap'
      }).addTo(mapaTrafico);
      for (const capa of ['flujo', 'incidentes']) {
        capasTrafico[capa] = L.tileLayer(`${API_URL}/trafico/tiles/${capa}/{z}/{x}/{y}`, {
          maxZoom: 18,
          opacity: capa === 'flujo' ? 0.8 : 1,
          attribution: capa === 'flujo' ? 'Tráfico © TomTom' : ''
        });
        if ($(`.seg button[data-capa="${capa}"]`)?.getAttribute('aria-pressed') !== 'false') capasTrafico[capa].addTo(mapaTrafico);
      }
      return mapaTrafico;
    }

    async function cargarTrafico() {
      const viajes = await api('/trafico/viajes');
      const estado = await api('/trafico/estado'); // después de la lista, para contar sus consultas

      const aviso = $('#tr-aviso');
      aviso.hidden = estado.configurado;
      aviso.textContent = 'Falta la clave de TomTom (TOMTOM_API_KEY en Backend/.env): solo se muestra la ruta planeada, sin tráfico.';
      $('#tr-consultas').textContent = `${fmtNumero.format(estado.consultas_hoy)} de ${fmtNumero.format(estado.limite_diario)} consultas hoy`;
      $('#tr-actualizado').textContent = `actualizado ${fmtHora.format(new Date())}`;

      const conDatos = viajes.filter((v) => v.nivel);
      $('#tr-total').textContent = viajes.filter((v) => !v.error).length;
      $('#tr-pesado').textContent = conDatos.filter((v) => v.nivel === 'pesado').length;
      $('#tr-retraso').textContent = duracionTexto(conDatos.reduce((suma, v) => suma + v.retraso_min, 0));
      $('#tr-ahorro').textContent = duracionTexto(conDatos.reduce((suma, v) => suma + v.ahorro_min, 0));

      pintarListaTrafico(viajes);
      crearMapaTrafico()?.invalidateSize(); // la sección estaba oculta al crear el mapa

      const elegido = viajes.find((v) => v.id === viajeTraficoId && !v.error) || viajes.find((v) => !v.error);
      if (elegido) await mostrarViajeTrafico(elegido.id);
      else limpiarViajeTrafico();
    }

    function pintarListaTrafico(viajes) {
      const lista = $('#tr-lista');
      if (!viajes.length) {
        lista.replaceChildren(el('li', { class: 'empty', text: 'No hay viajes asignados ni en ruta.' }));
        return;
      }
      lista.replaceChildren(...viajes.map((v) => {
        const nivel = NIVELES[v.nivel];
        const detalles = [
          v.retraso_min ? `+${v.retraso_min} min` : null,
          v.incidentes ? `${v.incidentes} incidente${v.incidentes > 1 ? 's' : ''}` : null,
          v.ahorro_min ? `ahorra ${v.ahorro_min} min` : null
        ].filter(Boolean).join(' · ');

        return el('li', {}, el('button', {
          type: 'button',
          class: 'tr-item',
          'data-id': v.id,
          'aria-pressed': String(v.id === viajeTraficoId),
          disabled: Boolean(v.error),
          onclick: () => mostrarViajeTrafico(v.id).catch((error) => mostrarAviso(error.message))
        },
        el('span', { class: 'tr-item__cabeza' },
          el('span', { class: 'mono', text: v.folio }),
          v.error ? el('span', { class: 'st st--alert', text: 'Sin ruta' })
            : nivel ? el('span', { class: `st st--${nivel.clase}`, text: nivel.texto })
              : el('span', { class: 'muted', text: 'Sin tráfico' })),
        el('span', { class: 'tr-item__ruta', text: `${ciudad(v.origen)} → ${ciudad(v.destino)}` }),
        el('small', { text: v.error || [ESTADOS[v.estado]?.texto, detalles].filter(Boolean).join(' · ') })));
      }));
    }

    async function mostrarViajeTrafico(id) {
      const datos = await api(`/trafico/viajes/${id}`);
      viajeTraficoId = id;
      $$('#tr-lista .tr-item').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.id) === id)));
      pintarMapaTrafico(datos);
      pintarDetalleTrafico(datos);
    }

    function limpiarViajeTrafico() {
      viajeTraficoId = null;
      capaViajeTrafico?.remove();
      $('#tr-titulo').textContent = 'Mapa de tráfico';
      $('#tr-sub').textContent = 'Sin viajes activos';
      $('#tr-detalle').hidden = true;
    }

    function pintarMapaTrafico({ viaje, origen, destino, posicion, planeado, trafico }) {
      if (!crearMapaTrafico()) return; // sin internet Leaflet no carga

      const punto = (lugar, relleno, texto) => L.circleMarker(lugar, {
        radius: 7, color: '#fff', weight: 2, fillColor: relleno, fillOpacity: 1
      }).bindTooltip(texto);

      const capas = [];
      if (trafico) {
        // Las alternativas van debajo y la recomendada encima
        const rutas = [...trafico.rutas].sort((a, b) => Number(Boolean(a.recomendada)) - Number(Boolean(b.recomendada)));
        for (const ruta of rutas) {
          const estilo = ruta.recomendada
            ? { color: colorTema('--info'), weight: 6, opacity: 0.95 }
            : { color: colorTema('--muted'), weight: 4, opacity: 0.85, dashArray: '6 8' };
          capas.push(L.polyline(ruta.trazo, estilo)
            .bindTooltip(`${ruta.nombre} · ${duracionTexto(ruta.minutos)} · ${ruta.distancia_km} km`));
        }
        for (const incidente of trafico.rutas.find((r) => r.recomendada).incidentes) {
          capas.push(L.circleMarker(incidente.posicion, {
            radius: 6, color: '#fff', weight: 2, fillOpacity: 1,
            fillColor: colorTema(incidente.magnitud === 3 ? '--alert' : '--wait')
          }).bindTooltip(`${incidente.texto}${incidente.retraso_min ? ` · +${incidente.retraso_min} min` : ''}`));
        }
      } else {
        capas.push(L.polyline(planeado, { color: colorTema('--accent'), weight: 5, opacity: 0.9 }));
      }

      capas.push(
        punto([origen.lat, origen.lon], colorTema('--go'), 'Origen'),
        punto([destino.lat, destino.lon], colorTema('--accent'), 'Destino'),
        L.marker(posicion, {
          icon: L.divIcon({ className: 'tr-camion', html: '<svg class="i" aria-hidden="true"><use href="#i-truck" /></svg>', iconSize: [30, 30] }),
          keyboard: false
        }).bindTooltip(`${viaje.folio} · ${viaje.placas || 'sin unidad'} · ${viaje.avance}%`)
      );

      capaViajeTrafico?.remove();
      capaViajeTrafico = L.layerGroup(capas).addTo(mapaTrafico);

      // Si la sección aún no tiene tamaño, Leaflet calcularía un zoom enorme: se encuadra en la siguiente vuelta
      mapaTrafico.invalidateSize();
      const { x: ancho, y: alto } = mapaTrafico.getSize();
      if (viajeEncuadrado !== viaje.id && ancho > 0 && alto > 0) {
        const puntos = trafico ? trafico.rutas.flatMap((r) => r.trazo) : planeado;
        mapaTrafico.fitBounds(L.latLngBounds([...puntos, posicion]), { padding: [28, 28] });
        viajeEncuadrado = viaje.id;
      }
    }

    function pintarDetalleTrafico({ viaje, trafico }) {
      $('#tr-titulo').textContent = `${viaje.folio} · ${ciudad(viaje.origen)} → ${ciudad(viaje.destino)}`;
      $('#tr-sub').textContent = viaje.estado === 'asignado'
        ? 'Aún no sale: tráfico desde el origen'
        : `Avance ${viaje.avance} % · tráfico de lo que falta`;

      const panel = $('#tr-detalle');
      panel.hidden = !trafico;
      if (!trafico) return;

      const nivel = NIVELES[trafico.nivel];
      const etiqueta = $('#tr-nivel');
      etiqueta.className = `st st--${nivel.clase}`;
      etiqueta.textContent = `Tráfico ${nivel.texto.toLowerCase()}`;
      $('#tr-reco').textContent = trafico.recomendacion.texto
        + (trafico.desactualizado ? ' (Datos de hace unos minutos: TomTom no respondió.)' : '');

      $('#tr-rutas').replaceChildren(...trafico.rutas.map((ruta) => el('div', { class: `tr-ruta${ruta.recomendada ? ' is-reco' : ''}` },
        el('header', {},
          el('b', { text: ruta.nombre }),
          ruta.recomendada ? el('span', { class: 'tr-tag', text: 'Recomendada' })
            : ruta.habitual ? el('span', { class: 'tr-tag tr-tag--muted', text: 'Habitual' }) : null),
        el('p', { class: 'mono', text: duracionTexto(ruta.minutos) }),
        el('small', { text: `${ruta.distancia_km} km · ${ruta.retraso_min ? `+${ruta.retraso_min} min por tráfico` : 'sin retraso'} · llega ${hora(ruta.llegada)}` }))));

      const incidentes = trafico.rutas.find((r) => r.recomendada).incidentes;
      $('#tr-incidentes').replaceChildren(...(incidentes.length
        ? incidentes.map((i) => el('li', { class: i.magnitud === 3 ? 'alert' : 'wait' },
          el('b', { text: i.texto }),
          el('small', {
            text: [i.retraso_min ? `+${i.retraso_min} min` : null, i.velocidad_kmh != null ? `${i.velocidad_kmh} km/h` : null]
              .filter(Boolean).join(' · ') || 'Sin retraso estimado'
          })))
        : [el('li', {}, el('small', { text: 'Sin incidentes en la ruta recomendada.' }))]));
    }

    function iniciarTrafico() {
      $$('.seg button[data-capa]').forEach((boton) => {
        boton.addEventListener('click', () => {
          const activa = boton.getAttribute('aria-pressed') !== 'true';
          boton.setAttribute('aria-pressed', String(activa));
          const capa = capasTrafico[boton.dataset.capa];
          if (capa && mapaTrafico) activa ? capa.addTo(mapaTrafico) : capa.remove();
        });
      });
    }

    function iniciarFormRuta() {
      const form = $('#form-ruta');
      if (!form) return;
      revalidarAlEscribir(form);
      fijarSalidaSugerida(form);

      // Vista previa con la ciudad (último tramo después de la coma)
      const vista = $('#pv-ruta');
      const actualizarVista = () => {
        vista.textContent = `${ciudad(form.origen.value)} → ${ciudad(form.destino.value)}`;
      };
      form.origen.addEventListener('input', actualizarVista);
      form.destino.addEventListener('input', actualizarVista);
      actualizarVista();

      // Distancia y tiempo de traslado: se calculan cuando el usuario deja de escribir
      const nota = $('#pv-nota');
      let estimacion = null;
      let ultimaConsulta = '';
      let temporizador;

      const avisar = (texto, esError = false) => {
        nota.textContent = texto;
        nota.classList.toggle('es-error', esError);
      };

      const actualizarLlegada = () => {
        const salida = new Date(form.salida.value);
        $('#pv-llegada').textContent = estimacion && !Number.isNaN(salida.getTime())
          ? hora(new Date(salida.getTime() + estimacion.duracion_min * 60000))
          : '—';
      };

      const limpiar = (texto) => {
        estimacion = null;
        ultimaConsulta = '';
        $('#pv-distancia').textContent = '—';
        $('#pv-tiempo').textContent = '—';
        actualizarLlegada();
        avisar(texto);
      };

      const calcular = async () => {
        const origen = form.origen.value.trim();
        const destino = form.destino.value.trim();
        if (origen.length < 3 || destino.length < 3) {
          limpiar('Escribe origen y destino para calcular el recorrido.');
          return;
        }

        const consulta = new URLSearchParams({
          origen, destino, gps_origen: form.gpsOrigen.value.trim(), gps_destino: form.gpsDestino.value.trim()
        }).toString();
        if (consulta === ultimaConsulta) return;
        ultimaConsulta = consulta;
        avisar('Calculando la ruta…');

        try {
          const ruta = await api(`/rutas/estimar?${consulta}`);
          if (consulta !== ultimaConsulta) return; // llegó tarde: ya se escribió otra dirección
          estimacion = ruta;
          $('#pv-distancia').textContent = `${fmtNumero.format(ruta.distancia_km)} km`;
          $('#pv-tiempo').textContent = duracionTexto(ruta.duracion_min);
          actualizarLlegada();
          const aproximados = [['del origen', ruta.origen], ['del destino', ruta.destino]].filter(([, lugar]) => lugar.aproximado).map(([nombre]) => nombre);
          avisar(`Ruta por carretera de OpenStreetMap. En auto: ${duracionTexto(ruta.duracion_auto_min)}; en camión se estima un 30 % más.` +
            (aproximados.length ? ` No se ubicó el punto exacto ${aproximados.join(' ni ')}: se usó la ciudad (agrega el enlace GPS para precisar).` : ''));
          dibujarRuta(ruta);
        } catch (error) {
          if (consulta !== ultimaConsulta) return;
          limpiar(error.message);
          ultimaConsulta = consulta; // no repetir la misma consulta fallida hasta que cambie algo
          nota.classList.add('es-error');
        }
      };

      const programarCalculo = () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(calcular, 900);
      };
      ['origen', 'destino', 'gpsOrigen', 'gpsDestino'].forEach((campo) => form[campo].addEventListener('input', programarCalculo));
      form.salida.addEventListener('input', actualizarLlegada);

      // Al entrar a la sección: calcula con lo ya escrito y ajusta el mapa (estaba oculto)
      window.addEventListener('hashchange', () => {
        if (location.hash !== '#ruta') return;
        mapaRuta?.invalidateSize();
        if (usuarioActual() && esOficina()) programarCalculo();
      });
      if (location.hash === '#ruta' && usuarioActual() && esOficina()) programarCalculo();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validarFormulario(form)) return;

        const boton = $('button[type="submit"]', form);
        boton.disabled = true;
        try {
          const nuevo = await api('/viajes', {
            method: 'POST',
            body: {
              origen: form.origen.value,
              destino: form.destino.value,
              gps_origen: form.gpsOrigen.value,
              gps_destino: form.gpsDestino.value,
              mercancia: form.mercancia.value,
              peso_kg: form.peso.value,
              num_unidades: form.unidades.value,
              flete: form.flete.value || 0,
              cliente: form.cliente.value,
              salida: new Date(form.salida.value).toISOString()
            }
          });
          form.reset();
          fijarSalidaSugerida(form);
          actualizarVista();
          limpiar('Escribe origen y destino para calcular el recorrido.');
          cargarPorAsignar().catch(() => {});
          abrirAsignacion(nuevo.id, { recienGuardado: true }); // se asigna aquí mismo, sin cambiar de pantalla
        } catch (error) {
          mostrarAviso(error.message);
        } finally {
          boton.disabled = false;
        }
      });
    }

    /* ---------- Asignación rápida (panel tipo toast) ---------- */
    // Rutas y asignación viven en la misma pestaña: al guardar una ruta, al tocar un viaje «Por asignar»
    // o desde el detalle de un viaje, aparece este panel con el operador y la unidad recomendados.
    let asignacion = { viaje: null, operadores: [], unidades: [] };

    async function cargarPorAsignar() {
      const viajes = await api('/viajes?estado=pendiente');
      $('#por-asignar').hidden = !viajes.length;
      $('#por-asignar-lista').replaceChildren(...viajes.map((v) => el('button', {
        type: 'button', class: 'por-asignar__viaje', onclick: () => abrirAsignacion(v.id)
      },
      el('b', { class: 'mono', text: v.folio }),
      el('span', { text: `${ciudad(v.origen)} → ${ciudad(v.destino)}` }),
      el('small', { class: 'muted', text: `${fmtNumero.format(v.peso_kg)} kg · sale ${hora(v.salida)}` }))));
      pintarContadorMenu(viajes.length);
    }

    // Recomendación: el operador libre con menos viajes este mes y la unidad libre más justa para el peso
    const operadorOcupado = (o, viaje) => Boolean(o.viaje_activo && o.viaje_activo !== viaje.folio);
    const unidadLibre = (u, viaje) => u.estado === 'disponible' || u.id === viaje.unidad_id;

    function recomendar(viaje, operadores, unidades) {
      const libres = operadores.filter((o) => !operadorOcupado(o, viaje)).sort((a, b) => a.viajes_mes - b.viajes_mes);
      const aptas = unidades.filter((u) => unidadLibre(u, viaje) && u.capacidad_kg >= viaje.peso_kg)
        .sort((a, b) => a.capacidad_kg - b.capacidad_kg);
      return {
        operador: libres.find((o) => o.id === viaje.operador_id) || libres[0],
        unidad: aptas.find((u) => u.id === viaje.unidad_id) || aptas[0]
      };
    }

    const asignacionLista = () => Boolean($('input[name="asig-op"]:checked') && $('#asig-unidad')?.value);

    function pintarAsignacion({ recienGuardado = false } = {}) {
      const { viaje, operadores, unidades } = asignacion;
      const sugerido = recomendar(viaje, operadores, unidades);

      $('#asig-estado').textContent = recienGuardado ? `✓ Ruta ${viaje.folio} guardada` : viaje.estado === 'asignado' ? 'Reasignar viaje' : 'Pendiente de asignar';
      $('#asig-folio').textContent = viaje.folio;
      $('#asig-ruta').textContent = `${ciudad(viaje.origen)} → ${ciudad(viaje.destino)} · ${fmtNumero.format(viaje.peso_kg)} kg · sale ${hora(viaje.salida)}`;

      const ordenados = [...operadores].sort((a, b) =>
        Number(operadorOcupado(a, viaje)) - Number(operadorOcupado(b, viaje)) || a.viajes_mes - b.viajes_mes);
      const listaOperadores = ordenados.length
        ? el('div', { class: 'pick asig__ops' }, ordenados.map((o) => {
          const ocupado = operadorOcupado(o, viaje);
          const recomendado = o === sugerido.operador;
          return el('label', {},
            el('input', { type: 'radio', name: 'asig-op', value: o.id, disabled: ocupado, checked: recomendado }),
            el('span', { class: 'av', text: iniciales(o.nombre) }),
            el('span', {}, el('b', { text: o.nombre }),
              el('small', { text: ocupado ? `En ${o.viaje_activo}` : `${o.viajes_mes} viaje${o.viajes_mes === 1 ? '' : 's'} este mes` })),
            el('span', { class: `st ${ocupado ? 'st--wait' : 'st--go'}`, text: ocupado ? 'Ocupado' : recomendado ? 'Recomendado' : 'Libre' }));
        }))
        : el('p', { class: 'empty', text: 'No hay operadores. Regístralos en Personal y roles con el rol Operador.' });

      const libres = unidades.filter((u) => unidadLibre(u, viaje)).sort((a, b) => a.capacidad_kg - b.capacidad_kg);
      const select = el('select', { id: 'asig-unidad' }, libres.map((u) => {
        const noAlcanza = u.capacidad_kg < viaje.peso_kg;
        return el('option', {
          value: u.id,
          disabled: noAlcanza,
          selected: u === sugerido.unidad,
          text: `${u.placas} · ${u.marca_modelo} · ${fmtNumero.format(u.capacidad_kg)} kg${noAlcanza ? ' (no soporta el peso)' : u === sugerido.unidad ? ' · recomendada' : ''}`
        });
      }));
      if (!sugerido.unidad) {
        select.prepend(el('option', {
          value: '', selected: true,
          text: libres.length ? `Ninguna unidad libre soporta ${fmtNumero.format(viaje.peso_kg)} kg` : 'No hay unidades disponibles'
        }));
      }

      $('#asig-cuerpo').replaceChildren(
        el('h3', { text: 'Operador' }), listaOperadores,
        el('label', { class: 'f' }, el('span', { text: 'Unidad' }), select));
      $('#asig-pie').replaceChildren(
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: cerrarAsignacion }, 'Más tarde'),
        el('button', { type: 'button', class: 'btn btn--accent btn--sm', id: 'asig-confirmar', onclick: confirmarAsignacion, disabled: !asignacionLista() },
          icono('i-check'), 'Asignar'));
    }

    async function abrirAsignacion(id, opciones = {}) {
      try {
        const [viaje, operadores, unidades] = await Promise.all([api(`/viajes/${id}`), api('/flota/operadores'), api('/flota/unidades')]);
        if (!['pendiente', 'asignado'].includes(viaje.estado)) {
          mostrarAviso(`${viaje.folio} ya salió o terminó: no se puede asignar.`);
          return;
        }
        asignacion = { viaje, operadores, unidades };
        pintarAsignacion(opciones);
        const panel = $('#asig');
        panel.hidden = false;
        requestAnimationFrame(() => panel.classList.add('is-on'));
        ($('#asig input[name="asig-op"]:checked') || $('#asig-unidad'))?.focus({ preventScroll: true });
      } catch (error) {
        mostrarAviso(error.message);
      }
    }

    function cerrarAsignacion() {
      const panel = $('#asig');
      panel.classList.remove('is-on');
      setTimeout(() => { if (!panel.classList.contains('is-on')) panel.hidden = true; }, 200);
    }

    async function confirmarAsignacion(e) {
      const boton = e.currentTarget;
      const operador = $('input[name="asig-op"]:checked');
      const unidad = Number($('#asig-unidad')?.value);
      if (!operador || !unidad) {
        mostrarAviso('Elige un operador y una unidad.');
        return;
      }
      boton.disabled = true;
      try {
        const v = await api(`/viajes/${asignacion.viaje.id}/asignar`, {
          method: 'PATCH',
          body: { operador_id: Number(operador.value), unidad_id: unidad }
        });
        $('#asig-estado').textContent = '✓ Viaje asignado';
        $('#asig-cuerpo').replaceChildren(el('p', { class: 'asig__listo' },
          el('b', { text: v.folio }), ` quedó asignado a ${v.operador} con la unidad ${v.placas}. `,
          'Avisamos al chofer y a quien creó el viaje (si activaron sus avisos).'));
        $('#asig-pie').replaceChildren(
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: (ev) => qrParaCliente(v, ev.currentTarget) }, 'QR para el cliente'),
          el('a', { href: '#monitoreo', class: 'btn btn--ghost btn--sm', onclick: cerrarAsignacion }, 'Ver en monitoreo'),
          el('button', { type: 'button', class: 'btn btn--accent btn--sm', onclick: cerrarAsignacion }, 'Listo'));
        $('#asig-pie .btn--accent').focus();
        cargarSeccion({ silencioso: true });
        if (location.hash !== '#ruta') cargarPorAsignar().catch(() => {});
      } catch (error) {
        mostrarAviso(error.message);
        boton.disabled = false;
      }
    }

    // El cliente recibe avisos desde su página de rastreo («Avísame»): aquí se genera el QR para enviárselo
    async function qrParaCliente(v, boton) {
      boton.disabled = true;
      try {
        const base = new URL('.', location.href).href;
        const { url, qr_svg: qr } = await api(`/viajes/${v.id}/rastreo`, { method: 'POST', body: { base } });
        boton.remove();
        $('#asig-cuerpo').append(el('div', { class: 'asis-qr' },
          el('small', { class: 'muted', text: 'Envíalo al cliente: al abrirlo puede pulsar «Avísame» y recibirá los avisos de su envío.' }),
          el('img', { alt: `Código QR para rastrear ${v.folio}`, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}` }),
          el('a', { class: 'mono', href: url, target: '_blank', rel: 'noopener', text: url }),
          navigator.share && el('button', {
            type: 'button', class: 'btn btn--accent btn--sm',
            onclick: () => navigator.share({ title: `Rastreo ${v.folio} · Trazzo`, text: `Sigue tu envío ${v.folio} en vivo:`, url }).catch(() => {})
          }, 'Compartir enlace')));
      } catch (error) {
        mostrarAviso(error.message);
        boton.disabled = false;
      }
    }

    function iniciarAsignacion() {
      $('#asig-cerrar').addEventListener('click', cerrarAsignacion);
      $('#asig-cuerpo').addEventListener('change', () => {
        const boton = $('#asig-confirmar');
        if (boton) boton.disabled = !asignacionLista();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('#asig').hidden && !$('dialog[open]')) cerrarAsignacion();
      });
    }

    /* ---------- Historial de viajes ---------- */
    const POR_PAGINA_HISTORIAL = 15;
    let paginaHistorial = 1;

    function consultaHistorial() {
      const form = $('#form-historial');
      const consulta = new URLSearchParams();
      ['q', 'estado', 'desde', 'hasta'].forEach((campo) => {
        const valor = form[campo].value.trim();
        if (valor) consulta.set(campo, valor);
      });
      return consulta;
    }

    async function cargarHistorial() {
      const consulta = consultaHistorial();
      consulta.set('pagina', paginaHistorial);
      consulta.set('por_pagina', POR_PAGINA_HISTORIAL);
      const r = await api(`/viajes/historial?${consulta}`);

      $('#hi-total').textContent = fmtNumero.format(r.total);
      $('#hi-flete').textContent = fmtDineroCorto.format(r.flete);
      $('#hi-km').textContent = `${fmtNumero.format(Math.round(r.km))} km`;

      const filas = r.viajes.map((v) => {
        const e = ESTADOS[v.estado];
        return el('tr', { class: 'fila-viaje', tabindex: 0, onclick: () => abrirDetalle(v.id), onkeydown: (ev) => { if (ev.key === 'Enter') abrirDetalle(v.id); } },
          el('td', { class: 'mono', text: v.folio }),
          el('td', { text: hora(v.salida) }),
          el('td', { text: `${ciudad(v.origen)} → ${ciudad(v.destino)}` }),
          el('td', { text: v.cliente }),
          el('td', { text: v.operador ? nombreCorto(v.operador) : '—' }),
          el('td', { class: 'mono', text: v.placas || '—' }),
          el('td', { text: fmtDinero.format(v.flete) }),
          el('td', {}, el('span', { class: `st st--${e.clase}`, text: e.texto })));
      });
      $('#tabla-historial-cuerpo').replaceChildren(...(filas.length ? filas
        : [el('tr', {}, el('td', { colspan: 8, class: 'muted', text: 'No hay viajes con esos filtros.' }))]));

      paginaHistorial = r.pagina;
      $('#hi-pagina').textContent = `Página ${r.pagina} de ${r.paginas}`;
      $('#hi-anterior').disabled = r.pagina <= 1;
      $('#hi-siguiente').disabled = r.pagina >= r.paginas;
    }

    // El CSV necesita el token, por eso se descarga con fetch y no con un enlace normal
    async function exportarHistorial(boton) {
      const consulta = consultaHistorial();
      consulta.set('formato', 'csv');
      boton.disabled = true;
      try {
        const respuesta = await fetch(`${API_URL}/viajes/historial?${consulta}`, {
          headers: { Authorization: `Bearer ${sesion.leer()?.token}` }
        });
        if (!respuesta.ok) throw new Error((await respuesta.json().catch(() => ({}))).message || 'No se pudo exportar');
        const url = URL.createObjectURL(await respuesta.blob());
        const enlace = el('a', { href: url, download: `trazzo-viajes-${new Date().toISOString().slice(0, 10)}.csv` });
        document.body.append(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        mostrarAviso('Historial exportado. Ábrelo con Excel.');
      } catch (error) {
        mostrarAviso(navigator.onLine ? error.message : 'Sin conexión: no se puede exportar ahora.');
      } finally {
        boton.disabled = false;
      }
    }

    function iniciarHistorial() {
      const form = $('#form-historial');
      const recargar = () => cargarHistorial().catch((error) => mostrarAviso(error.message));

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        paginaHistorial = 1;
        recargar();
      });
      // El reset vacía los campos después del evento: se espera un momento antes de recargar
      form.addEventListener('reset', () => setTimeout(() => { paginaHistorial = 1; recargar(); }));
      $('#hi-anterior').addEventListener('click', () => { paginaHistorial -= 1; recargar(); });
      $('#hi-siguiente').addEventListener('click', () => { paginaHistorial += 1; recargar(); });
      $('#hi-exportar').addEventListener('click', (e) => exportarHistorial(e.currentTarget));
    }

    /* ---------- Flota ---------- */
    let unidadEditando = null;

    // Estado visible: "en_ruta" en la base significa ocupada; se distingue si el viaje ya salió
    function estadoUnidad(u) {
      if (u.estado === 'taller') return { texto: 'En taller', clase: 'done' };
      if (!u.viaje_activo) return { texto: 'Disponible', clase: 'go' };
      if (u.viaje_estado === 'asignado') return { texto: `Asignada · ${u.viaje_activo}`, clase: 'wait' };
      if (u.viaje_estado === 'retraso') return { texto: `Retraso · ${u.viaje_activo}`, clase: 'alert' };
      return { texto: `En ruta · ${u.viaje_activo}`, clase: 'go' };
    }

    async function cambiarTaller(u, boton) {
      const destino = u.estado === 'taller' ? 'disponible' : 'taller';
      if (destino === 'taller' && !confirm(`¿Enviar ${u.placas} al taller? No se podrá asignar a viajes hasta que vuelva a servicio.`)) return;
      boton.disabled = true;
      try {
        await api(`/flota/unidades/${u.id}`, { method: 'PATCH', body: { estado: destino } });
        mostrarAviso(destino === 'taller' ? `${u.placas} enviada al taller.` : `${u.placas} volvió a servicio.`);
        await cargarFlota();
      } catch (error) {
        mostrarAviso(error.message);
        boton.disabled = false;
      }
    }

    async function cargarFlota() {
      const unidades = await api('/flota/unidades');
      const disponibles = unidades.filter((u) => u.estado === 'disponible' && !u.viaje_activo);
      const enUso = unidades.filter((u) => u.viaje_activo);
      const asignadas = enUso.filter((u) => u.viaje_estado === 'asignado').length;

      $('#fl-disponibles').textContent = dosDigitos(disponibles.length);
      $('#fl-en-uso').textContent = dosDigitos(enUso.length);
      $('#fl-en-uso-detalle').textContent = enUso.length ? `${asignadas} por salir · ${enUso.length - asignadas} en camino` : 'Ninguna en viaje';
      $('#fl-taller').textContent = dosDigitos(unidades.filter((u) => u.estado === 'taller').length);
      $('#fl-capacidad').textContent = `${fmtNumero.format(Math.round(disponibles.reduce((t, u) => t + u.capacidad_kg, 0) / 1000))} t`;
      $('#fl-total').textContent = `${unidades.length} unidad${unidades.length === 1 ? '' : 'es'}`;

      $('#tabla-unidades').replaceChildren(...unidades.map((u) => {
        const e = estadoUnidad(u);
        const taller = el('button', {
          type: 'button',
          class: 'btn btn--ghost btn--sm',
          disabled: Boolean(u.viaje_activo),
          title: u.viaje_activo ? 'Está en un viaje' : null,
          onclick: (ev) => cambiarTaller(u, ev.currentTarget)
        }, u.estado === 'taller' ? 'Volver a servicio' : 'A taller');
        return el('tr', {},
          el('td', {}, el('b', { class: 'mono', text: u.placas })),
          el('td', { text: u.marca_modelo }),
          el('td', { text: u.anio }),
          el('td', { text: `${fmtNumero.format(u.capacidad_kg)} kg` }),
          el('td', { class: 'mono muted', text: u.poliza || '—' }),
          el('td', {}, el('span', { class: `st st--${e.clase}`, text: e.texto })),
          el('td', { text: u.viajes_entregados }),
          el('td', {}, el('div', { class: 'tabla-acciones' },
            el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => abrirFormUnidad(u) }, 'Editar'),
            taller)));
      }));
    }

    function abrirFormUnidad(u = null) {
      const form = $('#form-unidad');
      unidadEditando = u;
      form.reset();
      $$('[aria-invalid]', form).forEach((c) => c.removeAttribute('aria-invalid'));
      $$('.f .err', form).forEach((e) => e.remove());
      $('#err-unidad').hidden = true;
      $('#t-dlg-unidad').textContent = u ? `Editar ${u.placas}` : 'Agregar unidad';
      form.anio.max = new Date().getFullYear() + 1;
      if (u) ['placas', 'marca_modelo', 'anio', 'capacidad_kg', 'poliza'].forEach((c) => { form[c].value = u[c] ?? ''; });
      $('#dlg-unidad').showModal();
    }

    function iniciarFlota() {
      const dialogo = $('#dlg-unidad');
      const form = $('#form-unidad');
      const error = $('#err-unidad');
      revalidarAlEscribir(form);

      $('#btn-nueva-unidad').addEventListener('click', () => abrirFormUnidad());
      $('#cancelar-unidad').addEventListener('click', () => dialogo.close());

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validarFormulario(form)) return;

        const boton = $('button[type="submit"]', form);
        boton.disabled = true;
        error.hidden = true;
        const datos = {
          placas: form.placas.value,
          marca_modelo: form.marca_modelo.value,
          anio: Number(form.anio.value),
          capacidad_kg: Number(form.capacidad_kg.value),
          poliza: form.poliza.value
        };
        try {
          const u = unidadEditando
            ? await api(`/flota/unidades/${unidadEditando.id}`, { method: 'PATCH', body: datos })
            : await api('/flota/unidades', { method: 'POST', body: datos });
          dialogo.close();
          mostrarAviso(unidadEditando ? `Unidad ${u.placas} actualizada.` : `Unidad ${u.placas} agregada a la flota.`);
          await cargarFlota();
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
        } finally {
          boton.disabled = false;
        }
      });
    }

    /* ---------- Personal y roles ---------- */
    function pintarUsuarios(usuarios) {
      $('#tabla-usuarios').replaceChildren(...usuarios.map((u) => {
        const rol = ROLES[u.rol] || { nombre: u.rol, clase: '', dispositivos: '—' };
        return el('tr', {},
          el('td', {}, el('b', { text: u.nombre })),
          el('td', { class: 'muted', text: u.correo }),
          el('td', {}, el('span', { class: `role ${rol.clase}`, text: rol.nombre })),
          el('td', { text: rol.dispositivos }));
      }));

      $$('[data-kpi]').forEach((b) => {
        b.textContent = usuarios.filter((u) => u.rol === b.dataset.kpi).length;
      });
      $('#total-usuarios').textContent = `${usuarios.length} registrado${usuarios.length === 1 ? '' : 's'}`;
    }

    async function cargarUsuarios() {
      try {
        pintarUsuarios(await api('/users'));
      } catch (error) {
        $('#tabla-usuarios').replaceChildren(el('tr', {}, el('td', { colspan: 4, class: 'muted', text: error.message })));
        $('#total-usuarios').textContent = '';
      }
    }

    function iniciarPersonal() {
      const dialogo = $('#dlg-usuario');
      const form = $('#form-usuario');
      const error = $('#err-usuario');
      if (!dialogo || !form) return;
      revalidarAlEscribir(form);

      $('#btn-nuevo-usuario').addEventListener('click', () => {
        form.reset();
        $$('[aria-invalid]', form).forEach((c) => c.removeAttribute('aria-invalid'));
        $$('.f .err', form).forEach((e) => e.remove());
        error.hidden = true;
        dialogo.showModal();
      });
      $('#cancelar-usuario').addEventListener('click', () => dialogo.close());

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validarFormulario(form)) return;

        const boton = $('button[type="submit"]', form);
        boton.disabled = true;
        error.hidden = true;
        try {
          const nuevo = await api('/users', {
            method: 'POST',
            body: {
              nombre: form.nombre.value,
              correo: form.correo.value,
              contraseña: form.clave.value,
              rol: form.rol.value
            }
          });
          dialogo.close();
          mostrarAviso(`Usuario ${nuevo.nombre} registrado como ${ROLES[nuevo.rol].nombre}.`);
          cargarUsuarios();
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
        } finally {
          boton.disabled = false;
        }
      });
    }

    /* ---------- ChatBot sin coste ---------- */
    // La conversación vive solo en esta pestaña. Las acciones que propone el chatbot
    // no se guardan hasta que la persona pulsa "Confirmar".
    let conversacion = [];
    const MAX_HISTORIAL = 18;

    // Primero se usa el asistente con IA (/asistente). Si no está configurado, sin saldo o sin servicio (503),
    // la conversación sigue con el chatbot por palabras clave (/chatbot), que no tiene costo.
    let modoAsistente = 'ia';

    const SUGERENCIAS = {
      ia: {
        oficina: [
          '¿Qué viajes van con retraso y por qué?',
          '¿Qué operador está libre para un viaje de 12 toneladas?',
          'Comparte el rastreo del último viaje en ruta',
          'Resumen de operación de hoy'
        ],
        operador: [
          '¿Cuál es mi viaje actual?',
          '¿A qué hora debo llegar?',
          'Reporta retraso en mi viaje por tráfico'
        ]
      },
      basico: {
        oficina: [
          'Resumen de operación de hoy',
          '¿Qué viajes van con retraso?',
          'Viajes pendientes por asignar',
          'Ayuda'
        ],
        operador: [
          'Mis viajes',
          '¿Cuál es mi viaje actual?',
          'Reportar retraso en TRZ-0142 por tráfico',
          'Ayuda'
        ]
      }
    };

    function pintarModoAsistente() {
      const etiqueta = $('#asis-titulo small');
      if (etiqueta) etiqueta.textContent = modoAsistente === 'ia' ? 'Con IA' : 'Sin coste';
    }

    function mensajeAsistente(rol, contenido) {
      const caja = $('#asis-mensajes');
      const burbuja = el('div', { class: `asis-msg asis-msg--${rol}` }, contenido);
      caja.append(burbuja);
      caja.scrollTop = caja.scrollHeight;
      return burbuja;
    }

    // Ejecuta una propuesta con los endpoints normales (mismos permisos y validaciones que la interfaz)
    async function confirmarPropuesta(p) {
      if (p.tipo === 'registrar') {
        const v = await api('/viajes', { method: 'POST', body: { ...p.datos, salida: new Date(p.datos.salida).toISOString() } });
        return `Viaje ${v.folio} registrado.`;
      }
      if (p.tipo === 'asignar') {
        const v = await api(`/viajes/${p.datos.viaje_id}/asignar`, { method: 'PATCH', body: { operador_id: p.datos.operador_id, unidad_id: p.datos.unidad_id } });
        return `${v.folio} asignado a ${v.operador} con la unidad ${v.placas}.`;
      }
      if (p.tipo === 'estado') {
        const v = await api(`/viajes/${p.datos.viaje_id}/estado`, { method: 'PATCH', body: { estado: p.datos.estado, nota: p.datos.nota } });
        return `${v.folio}: ${ESTADOS[v.estado].texto.toLowerCase()}.`;
      }
      if (p.tipo === 'rastreo') {
        const base = new URL('.', location.href).href;
        const { url, qr_svg: qr } = await api(`/viajes/${p.datos.viaje_id}/rastreo`, { method: 'POST', body: { base } });
        mensajeAsistente('asistente', el('div', { class: 'asis-qr' },
          el('img', { alt: `Código QR para rastrear ${p.datos.folio}`, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}` }),
          el('a', { class: 'mono', href: url, target: '_blank', rel: 'noopener', text: url })));
        return `Rastreo de ${p.datos.folio} listo: envía el QR o el enlace al cliente.`;
      }
      throw new Error('Acción desconocida');
    }

    function tarjetaPropuesta(p) {
      const estado = el('small', { class: 'muted', text: 'Pendiente de confirmar' });
      const confirmar = el('button', { type: 'button', class: 'btn btn--accent btn--sm' }, 'Confirmar');
      const descartar = el('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, 'Descartar');
      const botones = el('div', { class: 'actions' }, descartar, confirmar);

      confirmar.addEventListener('click', async () => {
        confirmar.disabled = true;
        descartar.disabled = true;
        try {
          const texto = await confirmarPropuesta(p);
          estado.textContent = `✓ ${texto}`;
          estado.className = 'c-green';
          botones.remove();
          conversacion.push({ rol: 'usuario', texto: `(Confirmé en pantalla: ${p.titulo}. Resultado: ${texto})` });
          cargarSeccion({ silencioso: true });
        } catch (error) {
          estado.textContent = `✕ ${error.message}`;
          estado.className = 'err';
          confirmar.disabled = false;
          descartar.disabled = false;
        }
      });
      descartar.addEventListener('click', () => {
        estado.textContent = 'Descartada';
        botones.remove();
        conversacion.push({ rol: 'usuario', texto: `(Descarté la propuesta: ${p.titulo})` });
      });

      return el('div', { class: 'asis-propuesta' },
        el('b', { text: p.titulo }),
        el('ul', {}, p.detalle.map((linea) => el('li', { text: linea }))),
        estado,
        botones);
    }

    async function preguntar(texto) {
      const form = $('#asis-form');
      const boton = $('button[type="submit"]', form);
      conversacion.push({ rol: 'usuario', texto });
      // Se conservan los últimos mensajes; la conversación debe empezar con el usuario
      conversacion = conversacion.slice(-MAX_HISTORIAL);
      while (conversacion.length && conversacion[0].rol !== 'usuario') conversacion.shift();

      mensajeAsistente('usuario', texto);
      $('#asis-sugerencias').hidden = true;
      const pensando = mensajeAsistente('asistente', el('span', { class: 'asis-pensando', text: 'Consultando datos…' }));
      boton.disabled = true;

      try {
        const consultar = () => api(modoAsistente === 'ia' ? '/asistente' : '/chatbot', { method: 'POST', body: { mensajes: conversacion } });
        let resultado;
        try {
          resultado = await consultar();
        } catch (error) {
          if (modoAsistente !== 'ia' || error.status !== 503) throw error;
          modoAsistente = 'basico';
          pintarModoAsistente();
          mensajeAsistente('asistente', el('small', { class: 'muted', text: `La IA no está disponible (${error.message}). Sigo con el chatbot básico.` }));
          resultado = await consultar();
        }
        const { respuesta, propuestas } = resultado;
        pensando.replaceChildren(respuesta);
        conversacion.push({ rol: 'asistente', texto: respuesta });
        propuestas.forEach((p) => mensajeAsistente('asistente', tarjetaPropuesta(p)));
      } catch (error) {
        pensando.replaceChildren(el('span', { class: 'err', text: error.message }));
        conversacion.pop(); // la pregunta no obtuvo respuesta: se puede reintentar
      } finally {
        boton.disabled = false;
        $('#asis-mensajes').scrollTop = $('#asis-mensajes').scrollHeight;
      }
    }

    function reiniciarAsistente() {
      conversacion = [];
      const usuario = usuarioActual();
      const hola = `Hola${usuario ? `, ${usuario.nombre.split(' ')[0]}` : ''}.`;
      $('#asis-mensajes').replaceChildren(el('div', { class: 'asis-msg asis-msg--asistente' }, modoAsistente === 'ia'
        ? `${hola} Soy el asistente de Trazzo con IA. Pregúntame lo que necesites de los viajes y la flota con tus palabras. Puedo preparar registros, asignaciones, cambios de estado y el QR de rastreo para el cliente; tú los confirmas.`
        : `${hola} Soy el ChatBot de Trazzo (sin coste). Puedo consultar viajes, flota y ayudarte a iniciar, asignar, reportar retraso o entregar viajes. Escribe "ayuda" para ver comandos.`));
      pintarModoAsistente();
      const lista = SUGERENCIAS[modoAsistente][esOficina() ? 'oficina' : 'operador'];
      $('#asis-sugerencias').replaceChildren(...lista.map((s) => el('button', { type: 'button', class: 'asis-chip', onclick: () => preguntar(s) }, s)));
      $('#asis-sugerencias').hidden = false;
    }

    function iniciarAsistente() {
      const abrir = $('#asis-abrir');
      const panel = $('#asis-panel');
      const form = $('#asis-form');

      const alternar = (abierto) => {
        panel.hidden = !abierto;
        abrir.setAttribute('aria-expanded', String(abierto));
        if (abierto) {
          if (!conversacion.length) reiniciarAsistente();
          form.texto.focus();
        }
      };

      abrir.addEventListener('click', () => alternar(panel.hidden));
      $('#asis-cerrar').addEventListener('click', () => alternar(false));
      $('#asis-nuevo').addEventListener('click', reiniciarAsistente);
      panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') alternar(false); });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const texto = form.texto.value.trim();
        if (!texto || $('button[type="submit"]', form).disabled) return;
        form.texto.value = '';
        preguntar(texto);
      });
      // Enter envía; Shift + Enter hace un salto de línea
      form.texto.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          form.requestSubmit();
        }
      });
    }

    /* ---------- PWA: instalación ---------- */
    let eventoInstalacion = null;

    function iniciarInstalacion() {
      const botones = $$('.js-instalar');
      const mostrarBotones = (visible) => botones.forEach((b) => { b.hidden = !visible; });

      // El navegador avisa que la app se puede instalar: mostramos nuestro propio botón
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        eventoInstalacion = e;
        mostrarBotones(true);
      });

      botones.forEach((b) => b.addEventListener('click', async () => {
        if (!eventoInstalacion) return;
        eventoInstalacion.prompt();
        await eventoInstalacion.userChoice;
        eventoInstalacion = null;
        mostrarBotones(false);
      }));

      window.addEventListener('appinstalled', () => {
        mostrarBotones(false);
        mostrarAviso('Trazzo quedó instalada. Ábrela desde tu pantalla de inicio.');
      });
    }

    /* ---------- PWA: notificaciones push ---------- */
    // Avisos cuando un viaje se asigna, inicia, cambia de estado o está por llegar (los manda el backend con Web Push).
    // Requieren HTTPS (o localhost) y el Service Worker; en iPhone, además, la app instalada en la pantalla de inicio.
    const pushSoportado = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const claveAvisos = (usuario) => `trazzo-avisos:${usuario?.id}`; // recuerda en este equipo quién los activó

    // La clave pública VAPID viene en base64url; pushManager.subscribe() la necesita en bytes
    function claveABytes(base64url) {
      const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
      return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    }

    async function suscripcionPush(clave) {
      const registro = await navigator.serviceWorker.getRegistration();
      if (!registro) throw new Error('La app aún no termina de instalarse. Recarga la página e inténtalo de nuevo.');
      const bytes = claveABytes(clave);
      const suscripcion = await registro.pushManager.getSubscription();
      const anterior = suscripcion?.options?.applicationServerKey;
      const mismaClave = anterior && new Uint8Array(anterior).every((b, i) => b === bytes[i]) && anterior.byteLength === bytes.length;
      if (suscripcion && mismaClave) return suscripcion;
      await suscripcion?.unsubscribe(); // era de otra clave del servidor: se renueva
      return registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    }

    function pintarBotonAvisos(activo) {
      const boton = $('#btn-avisos');
      boton.setAttribute('aria-pressed', String(activo));
      boton.querySelector('span').textContent = activo ? 'Avisos activos' : 'Activar avisos';
    }

    async function actualizarBotonAvisos(usuario) {
      const boton = $('#btn-avisos');
      if (!boton) return;
      boton.hidden = !usuario || !pushSoportado();
      if (boton.hidden) return;
      let activo = false;
      try { activo = localStorage.getItem(claveAvisos(usuario)) === '1'; } catch { /* sin almacenamiento */ }
      activo = activo && Notification.permission === 'granted';
      pintarBotonAvisos(activo);
      if (!activo) return;
      // Ya estaban activados en este equipo: se vuelve a registrar la suscripción para este usuario
      try {
        const { clave } = await api('/push/clave');
        const suscripcion = await suscripcionPush(clave);
        await api('/push/suscripcion', { method: 'POST', body: { suscripcion: suscripcion.toJSON() } });
      } catch { pintarBotonAvisos(false); }
    }

    // Con fetch directo (no api()): si la sesión ya expiró no debe volver a llamar a cerrarSesion()
    function quitarAvisosDelServidor() {
      const token = sesion.leer()?.token;
      if (!token || !pushSoportado()) return;
      navigator.serviceWorker.getRegistration()
        .then((registro) => registro?.pushManager.getSubscription())
        .then((suscripcion) => suscripcion && fetch(`${API_URL}/push/suscripcion`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint: suscripcion.endpoint })
        }))
        .catch(() => {});
      pintarBotonAvisos(false);
    }

    function iniciarNotificaciones() {
      const boton = $('#btn-avisos');
      if (!boton) return;
      boton.addEventListener('click', async () => {
        const usuario = usuarioActual();
        boton.disabled = true;
        try {
          if (boton.getAttribute('aria-pressed') === 'true') {
            const suscripcion = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
            if (suscripcion) await api('/push/suscripcion', { method: 'DELETE', body: { endpoint: suscripcion.endpoint } });
            try { localStorage.removeItem(claveAvisos(usuario)); } catch { /* sin almacenamiento */ }
            pintarBotonAvisos(false);
            mostrarAviso('Avisos desactivados en este equipo.');
            return;
          }
          const { disponible, clave } = await api('/push/clave');
          if (!disponible) throw new Error('El servidor no tiene configuradas las notificaciones (claves VAPID en .env).');
          if (await Notification.requestPermission() !== 'granted') {
            throw new Error('Permite las notificaciones de este sitio en el navegador para recibir avisos.');
          }
          const suscripcion = await suscripcionPush(clave);
          await api('/push/suscripcion', { method: 'POST', body: { suscripcion: suscripcion.toJSON() } });
          try { localStorage.setItem(claveAvisos(usuario), '1'); } catch { /* sin almacenamiento */ }
          pintarBotonAvisos(true);
          mostrarAviso(esOficina()
            ? 'Listo: te avisaremos de los viajes que crees o asignes: cuando se asignen, inicien, cambien de estado o estén por llegar.'
            : 'Listo: te avisaremos cuando te asignen un viaje y cuando cambie su estado.');
        } catch (error) {
          mostrarAviso(error.message);
        } finally {
          boton.disabled = false;
        }
      });
    }

    /* ---------- PWA: aviso de conexión ---------- */
    function iniciarAvisoConexion() {
      const aviso = $('#aviso-offline');
      const actualizar = () => { aviso.hidden = navigator.onLine; };

      window.addEventListener('offline', actualizar);
      window.addEventListener('online', () => {
        actualizar();
        mostrarAviso('Conexión recuperada. Actualizando datos…');
        cargarSeccion({ silencioso: true });
      });
      actualizar();
    }

    /* ---------- PWA: Service Worker y aviso de nueva versión ---------- */
    function registrarServiceWorker() {
      const local = ['localhost', '127.0.0.1'].includes(location.hostname);
      if (!('serviceWorker' in navigator) || (location.protocol !== 'https:' && !local)) return;

      // Si la página ya estaba controlada, al activarse la versión nueva se recarga una vez
      const habiaVersion = Boolean(navigator.serviceWorker.controller);
      let recargando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!habiaVersion || recargando) return;
        recargando = true;
        location.reload();
      });

      const ofrecerActualizacion = (worker) => {
        $('#aviso-version').hidden = false;
        $('#btn-actualizar').onclick = () => worker.postMessage('actualizar');
      };

      // Este archivo lo carga js/app.js DESPUÉS de los parciales, cuando el evento «load» puede haber pasado ya:
      // si la página ya cargó, se registra en ese momento; si no, al terminar de cargar
      const registrar = async () => {
        try {
          const registro = await navigator.serviceWorker.register('sw.js');
          if (registro.waiting && navigator.serviceWorker.controller) ofrecerActualizacion(registro.waiting);

          registro.addEventListener('updatefound', () => {
            const nuevo = registro.installing;
            nuevo.addEventListener('statechange', () => {
              if (nuevo.state === 'installed' && navigator.serviceWorker.controller) ofrecerActualizacion(nuevo);
            });
          });

          // Mientras la app está abierta, busca versiones nuevas cada hora
          setInterval(() => registro.update(), 60 * 60 * 1000);
        } catch { /* sin soporte en este hospedaje */ }
      };
      if (document.readyState === 'complete') registrar();
      else window.addEventListener('load', registrar);
    }

    /* ---------- Arranque ---------- */
    function arrancarTrazzo() {
      iniciarMenu();
      iniciarReloj();
      iniciarFiltros();
      iniciarLogin();
      iniciarFormRuta();
      iniciarAsignacion();
      iniciarPersonal();
      iniciarHistorial();
      iniciarFlota();
      iniciarTrafico();
      iniciarDetalle();
      iniciarInstalacion();
      iniciarAvisoConexion();
      iniciarNotificaciones();
      iniciarNavegacionConDatos();
      iniciarAsistente();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', arrancarTrazzo);
    } else {
      arrancarTrazzo();
    }

    registrarServiceWorker();
  