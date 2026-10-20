
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
      const botones = $$('.seg button');
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
    // El backend corre en el puerto 3000 de la misma computadora (o de la misma red local).
    // Cuando lo publiques en internet, cambia esta línea por su dirección.
    const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : 'https://trazzo-vosj.onrender.com/api';

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

    // Copia de las últimas consultas para poder mostrarlas sin conexión
    const PREFIJO_CACHE = 'trazzo-cache:';
    const cacheApi = {
      leer(ruta) {
        try { return JSON.parse(localStorage.getItem(PREFIJO_CACHE + ruta)); } catch { return null; }
      },
      guardar(ruta, datos) {
        try { localStorage.setItem(PREFIJO_CACHE + ruta, JSON.stringify(datos)); } catch { /* almacenamiento lleno o bloqueado */ }
      },
      borrar() {
        try {
          Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO_CACHE)).forEach((k) => localStorage.removeItem(k));
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
        const guardado = method === 'GET' && cacheApi.leer(ruta);
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
      if (!respuesta.ok) throw new Error(datos.message || `Error ${respuesta.status}`);
      if (method === 'GET') cacheApi.guardar(ruta, datos);
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
    }

    function cerrarSesion() {
      sesion.borrar();
      cacheApi.borrar();
      $('#asis-panel').hidden = true;
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
      asignar: cargarAsignacion,
      personal: cargarUsuarios,
      historial: cargarHistorial,
      flota: cargarFlota
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
      window.addEventListener('hashchange', () => {
        if (protegerSecciones()) cargarSeccion();
      });
      if (protegerSecciones()) cargarSeccion();

      // Seguimiento en vivo: cada 10 s se refresca lo que se está viendo
      setInterval(() => {
        if (document.hidden || !navigator.onLine || !usuarioActual()) return;
        if (['#tablero', '#monitoreo'].includes(location.hash)) cargarSeccion({ silencioso: true });
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
        const { url, qr_svg: qr } = await api(`/viajes/${v.id}/rastreo`, { method: 'POST' });
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
        viajeParaAsignar = v.id;
        $('#dlg-viaje').close();
        if (location.hash === '#asignar') cargarSeccion();
        else location.hash = '#asignar';
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
          viajeParaAsignar = nuevo.id;
          location.hash = '#asignar';
          mostrarAviso(`Ruta ${nuevo.folio} guardada. Ahora elige operador y unidad.`);
        } catch (error) {
          mostrarAviso(error.message);
        } finally {
          boton.disabled = false;
        }
      });
    }

    /* ---------- Asignación ---------- */
    let viajeParaAsignar = null;
    let datosAsignacion = { viajes: [], operadores: [], unidades: [] };

    async function cargarAsignacion() {
      const [viajes, operadores, unidades] = await Promise.all([
        api('/viajes?estado=pendiente,asignado'), api('/flota/operadores'), api('/flota/unidades')
      ]);
      // Primero los pendientes, luego los que ya tienen operador pero no salen
      viajes.sort((a, b) => (a.estado === 'pendiente' ? 0 : 1) - (b.estado === 'pendiente' ? 0 : 1));
      datosAsignacion = { viajes, operadores, unidades };

      const select = $('#as-viaje');
      select.replaceChildren(...viajes.map((v) => el('option', {
        value: v.id,
        text: `${v.folio} · ${ciudad(v.origen)} → ${ciudad(v.destino)} · ${ESTADOS[v.estado].texto}`
      })));
      if (viajes.some((v) => v.id === viajeParaAsignar)) select.value = viajeParaAsignar;

      const hayViajes = viajes.length > 0;
      $('#as-vacio').hidden = hayViajes;
      select.closest('.f').hidden = !hayViajes;
      $('#confirmar-viaje').disabled = !hayViajes;
      mostrarViajeElegido();
    }

    const viajeElegido = () => datosAsignacion.viajes.find((v) => v.id === Number($('#as-viaje').value));

    function mostrarViajeElegido() {
      const v = viajeElegido();
      $('#as-folio').textContent = v?.folio || '—';
      $('#as-ruta').textContent = v ? `${ciudad(v.origen)} → ${ciudad(v.destino)}` : '—';
      $('#res-origen').textContent = v?.origen || '—';
      $('#res-destino').textContent = v?.destino || '—';
      $('#res-mercancia').textContent = v?.mercancia || '—';
      $('#res-peso').textContent = v ? `${fmtNumero.format(v.peso_kg)} kg` : '—';
      $('#res-flete').textContent = v ? fmtDinero.format(v.flete) : '—';
      $('#res-salida').textContent = v ? hora(v.salida) : '—';
      pintarOperadores(v);
      pintarUnidades(v);
    }

    function pintarOperadores(viaje) {
      const { operadores } = datosAsignacion;
      const lista = $('#as-operadores');
      const ocupado = (o) => o.viaje_activo && o.viaje_activo !== viaje?.folio;
      $('#as-op-total').textContent = `${operadores.filter((o) => !ocupado(o)).length} disponibles de ${operadores.length}`;

      if (!operadores.length) {
        lista.replaceChildren(el('p', { class: 'empty', text: 'No hay operadores. Regístralos en Personal y roles con el rol Operador.' }));
      } else {
        lista.replaceChildren(...operadores.map((o) => el('label', {},
          el('input', { type: 'radio', name: 'op', value: o.id, 'data-nombre': o.nombre, disabled: ocupado(o), checked: viaje?.operador_id === o.id }),
          el('span', { class: 'av', text: iniciales(o.nombre) }),
          el('span', {}, el('b', { text: o.nombre }), el('small', { text: `${o.viajes_mes} viaje${o.viajes_mes === 1 ? '' : 's'} este mes` })),
          el('span', { class: 'muted mono', text: ocupado(o) ? o.viaje_activo : '' }),
          el('span', { class: `st ${ocupado(o) ? 'st--wait' : 'st--go'}`, text: ocupado(o) ? 'Ocupado' : 'Libre' }))));
      }
      // Si no hay uno elegido, se propone el primero libre
      if (!$('input[name="op"]:checked')) {
        const primero = $('input[name="op"]:not(:disabled)');
        if (primero) primero.checked = true;
      }
      $('#res-operador').textContent = $('input[name="op"]:checked')?.dataset.nombre || '—';
    }

    function pintarUnidades(viaje) {
      const select = $('#as-unidad');
      const usables = datosAsignacion.unidades.filter((u) => u.estado === 'disponible' || u.id === viaje?.unidad_id);
      select.replaceChildren(...usables.map((u) => {
        const noAlcanza = viaje && viaje.peso_kg > u.capacidad_kg;
        return el('option', {
          value: u.id,
          disabled: noAlcanza,
          text: `${u.placas} · ${u.marca_modelo}${noAlcanza ? ' (no soporta el peso)' : ''}`
        });
      }));
      if (!usables.length) select.replaceChildren(el('option', { value: '', text: 'No hay unidades disponibles' }));

      const preferida = usables.find((u) => u.id === viaje?.unidad_id) || usables.find((u) => !(viaje && viaje.peso_kg > u.capacidad_kg));
      if (preferida) {
        select.value = preferida.id;
      } else if (usables.length && viaje) {
        select.prepend(el('option', { value: '', text: `Ninguna unidad libre soporta ${fmtNumero.format(viaje.peso_kg)} kg` }));
        select.value = '';
      }
      mostrarUnidad();
    }

    function mostrarUnidad() {
      const u = datosAsignacion.unidades.find((x) => x.id === Number($('#as-unidad').value));
      const datos = u ? [
        ['Marca y modelo', u.marca_modelo], ['Año', u.anio],
        ['Capacidad', `${fmtNumero.format(u.capacidad_kg)} kg`], ['Póliza de seguro', u.poliza || '—']
      ] : [];
      $('#as-unidad-info').replaceChildren(...datos.map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v }))));
      $('#res-unidad').textContent = u ? u.placas : '—';
    }

    function iniciarAsignacion() {
      $('#as-viaje').addEventListener('change', () => {
        viajeParaAsignar = Number($('#as-viaje').value);
        mostrarViajeElegido();
      });
      $('#as-unidad').addEventListener('change', mostrarUnidad);
      $('#as-operadores').addEventListener('change', (e) => {
        $('#res-operador').textContent = e.target.dataset.nombre || '—';
      });

      $('#confirmar-viaje').addEventListener('click', async (e) => {
        const viaje = viajeElegido();
        const operador = $('input[name="op"]:checked');
        const unidad = Number($('#as-unidad').value);
        if (!viaje || !operador || !unidad) {
          mostrarAviso('Elige un viaje, un operador y una unidad.');
          return;
        }

        const boton = e.currentTarget;
        boton.disabled = true;
        try {
          const v = await api(`/viajes/${viaje.id}/asignar`, {
            method: 'PATCH',
            body: { operador_id: Number(operador.value), unidad_id: unidad }
          });
          viajeParaAsignar = null;
          location.hash = '#monitoreo';
          mostrarAviso(`${v.folio} asignado a ${v.operador} con la unidad ${v.placas}.`);
        } catch (error) {
          mostrarAviso(error.message);
        } finally {
          boton.disabled = false;
        }
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

    const SUGERENCIAS = {
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
    };

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
        const { respuesta, propuestas } = await api('/chatbot', { method: 'POST', body: { mensajes: conversacion } });
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
      $('#asis-mensajes').replaceChildren(el('div', { class: 'asis-msg asis-msg--asistente' },
        `Hola${usuario ? `, ${usuario.nombre.split(' ')[0]}` : ''}. Soy el ChatBot de Trazzo (sin coste). Puedo consultar viajes, flota y ayudarte a iniciar, asignar, reportar retraso o entregar viajes. Escribe "ayuda" para ver comandos.`));
      const lista = SUGERENCIAS[esOficina() ? 'oficina' : 'operador'];
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

      window.addEventListener('load', async () => {
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
      });
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
      iniciarDetalle();
      iniciarInstalacion();
      iniciarAvisoConexion();
      iniciarNavegacionConDatos();
      iniciarAsistente();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', arrancarTrazzo);
    } else {
      arrancarTrazzo();
    }

    registrarServiceWorker();
  