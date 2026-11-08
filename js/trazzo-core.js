
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
      return `ETA ${hora(viaje.eta_proyectada || viaje.eta)}`;
    }

    /* ---------- Conexión con la API (backend) ---------- */
    // Dónde está la API (misma regla que rastreo.html):
    //   · servidor de archivos de desarrollo (Live Server 5500/5501, python 8000/8080) → puerto 3000 del mismo equipo
    //   · otra dirección local o Render: la página la sirve el propio backend → la misma dirección
    //   · publicada en otro hosting (GitLab Pages) → el backend publicado en Render
    const API_PUBLICA = 'https://trazzo-vosj.onrender.com/api';
    const RED_LOCAL = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
    const SERVIDOR_DE_ARCHIVOS = ['5500', '5501', '8000', '8080'].includes(location.port);
    const API_URL =  RED_LOCAL.test(location.hostname)
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

    /* ---------- Cambios sin conexión ---------- */
    // Lo que se hace sin señal se guarda en IndexedDB y se envía, en el mismo orden, al volver la conexión.
    // Solo se guardan los cambios de operaciones_sin_conexion: nunca contraseñas ni archivos. Lo que necesita al
    // servidor para responder (acceso, usuarios, documentos, QR, pánico) sigue pidiendo conexión.
    const ID_LOCAL = /\/-\d+(\/|$)/; // los registros creados sin señal llevan un id negativo hasta que llegan al servidor
    const operacionesSinConexion = [
      ['POST', /^\/viajes$/],
      ['PATCH', /^\/viajes\/-?\d+\/(estado|asignar)$/],
      ['POST', /^\/flota\/unidades$/],
      ['PATCH', /^\/flota\/unidades\/-?\d+$/]
    ];
    const seGuardaSinConexion = (ruta, method) => operacionesSinConexion.some(([m, patron]) => m === method && patron.test(ruta));
    const nuevaClave = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;

    let cambiosPorEnviar = 0;
    let cambiosFallidos = 0;

    const colaOffline = {
      abrir() {
        this.bd ??= new Promise((listo, fallo) => {
          const peticion = indexedDB.open('trazzo-offline', 1);
          peticion.onupgradeneeded = () => peticion.result.createObjectStore('cambios', { keyPath: 'id', autoIncrement: true });
          peticion.onsuccess = () => listo(peticion.result);
          peticion.onerror = () => fallo(peticion.error);
        });
        return this.bd;
      },
      async operar(modo, trabajo) {
        const bd = await this.abrir();
        return new Promise((listo, fallo) => {
          const transaccion = bd.transaction('cambios', modo);
          const peticion = trabajo(transaccion.objectStore('cambios'));
          transaccion.oncomplete = () => listo(peticion.result);
          transaccion.onerror = transaccion.onabort = () => fallo(transaccion.error);
        });
      },
      // Cada persona ve y envía solo sus cambios, aunque compartan el equipo
      async todos() {
        const usuario = usuarioActual();
        if (!usuario) return [];
        return (await this.operar('readonly', (s) => s.getAll())).filter((c) => c.usuario_id === usuario.id);
      },
      guardar(cambio) { return this.operar('readwrite', (s) => s.put(cambio)); },
      borrar(id) { return this.operar('readwrite', (s) => s.delete(id)); }
    };

    const leCorresponde = (cambio, base, id) => `${cambio.ruta}/`.startsWith(`${base}/${id}/`);

    // Copia guardada + los cambios que aún no se envían: así la pantalla ya muestra lo que hizo la persona
    async function conCambios(ruta, datos) {
      const cambios = (await colaOffline.todos().catch(() => [])).filter((c) => !c.error);
      if (!cambios.length) return datos;
      const [camino, consulta] = ruta.split('?');
      const aplicar = (registro, base) => cambios.reduce(
        (actual, c) => (!c.idLocal && leCorresponde(c, base, actual.id) ? { ...actual, ...c.local } : actual), registro);
      const nuevos = (base) => cambios.filter((c) => c.idLocal && c.ruta === base).map((c) => c.local);

      if (camino === '/viajes') {
        const estados = new URLSearchParams(consulta).get('estado')?.split(',');
        return [...nuevos('/viajes').map((v) => aplicar(v, '/viajes')), ...datos.map((v) => aplicar(v, '/viajes'))]
          .filter((v) => !estados || estados.includes(v.estado));
      }
      if (camino === '/viajes/historial') return { ...datos, viajes: datos.viajes.map((v) => aplicar(v, '/viajes')) };
      if (/^\/viajes\/-?\d+$/.test(camino)) return aplicar(datos, '/viajes');
      if (camino === '/flota/unidades') return [...nuevos(camino), ...datos].map((u) => aplicar(u, camino));
      return datos;
    }

    // Sin red: la copia guardada de esa consulta o, si nunca se abrió, lo que se pueda armar con la lista de viajes
    async function leerSinConexion(ruta) {
      const guardado = await cacheApi.leer(ruta);
      if (guardado) return conCambios(ruta, guardado);

      const lista = /^\/viajes(\?estado=|$)/.test(ruta) || /^\/viajes\/-?\d+$/.test(ruta)
        ? await cacheApi.leer('/viajes') : null;
      const [camino] = ruta.split('?');
      if (camino === '/viajes') return lista ? conCambios(ruta, lista) : null;

      const viajeId = camino.match(/^\/viajes\/(-?\d+)$/)?.[1];
      if (!viajeId) return null;
      const viaje = (await conCambios('/viajes', lista || [])).find((v) => String(v.id) === viajeId);
      return viaje ? { ...viaje, eventos: [] } : null;
    }

    // Arma el resultado que la pantalla espera del servidor y lo que hay que aplicar a las copias guardadas
    async function prepararCambio(ruta, method, body) {
      const ahora = new Date().toISOString();
      if (ruta === '/viajes') {
        const id = -Date.now();
        const local = {
          ...body, id, idLocal: true, folio: 'Por enviar', estado: 'pendiente', avance: 0, eta: null,
          peso_kg: Number(body.peso_kg), num_unidades: Number(body.num_unidades ?? 1), flete: Number(body.flete ?? 0),
          distancia_km: null, duracion_min: null, operador_id: null, operador: null, unidad_id: null, placas: null,
          marca_modelo: null, capturo: usuarioActual().nombre, creado_en: ahora, entregado_en: null, rastreo_activo: 0
        };
        return { local, idLocal: id, resultado: local, texto: `Registrar el viaje ${ciudad(body.origen)} → ${ciudad(body.destino)}` };
      }
      if (ruta === '/flota/unidades') {
        const id = -Date.now();
        const local = { ...body, id, estado: 'disponible', viaje_activo: null };
        return { local, idLocal: id, resultado: local, texto: `Agregar la unidad ${body.placas}` };
      }
      if (ruta.startsWith('/flota/unidades/')) {
        const unidades = await leerSinConexion('/flota/unidades');
        const actual = unidades?.find((u) => ruta.endsWith(`/${u.id}`));
        return { local: body, resultado: { ...actual, ...body }, texto: `Actualizar la unidad ${body.placas || actual?.placas || ''}`.trim() };
      }

      const [, viajeId, accion] = ruta.match(/^\/viajes\/(-?\d+)\/(estado|asignar)$/);
      const viaje = await leerSinConexion(`/viajes/${viajeId}`);
      if (accion === 'estado') {
        const local = { estado: body.estado, ...(body.estado === 'entregado' && { avance: 100, entregado_en: ahora }) };
        return { local, resultado: { ...viaje, ...local }, texto: `${viaje?.folio || 'Viaje'}: ${ESTADOS[body.estado]?.texto.toLowerCase() || body.estado}` };
      }
      const [operadores, unidades] = await Promise.all([cacheApi.leer('/flota/operadores'), cacheApi.leer('/flota/unidades')]);
      const unidad = unidades?.find((u) => u.id === body.unidad_id);
      const local = {
        estado: 'asignado', operador_id: body.operador_id, unidad_id: body.unidad_id,
        operador: operadores?.find((o) => o.id === body.operador_id)?.nombre || 'Operador',
        placas: unidad?.placas || '—', marca_modelo: unidad?.marca_modelo || null
      };
      return { local, resultado: { ...viaje, ...local }, texto: `${viaje?.folio || 'Viaje'}: asignar a ${local.operador}` };
    }

    async function guardarCambio(ruta, method, body) {
      try {
        const { resultado, ...cambio } = await prepararCambio(ruta, method, body);
        await colaOffline.guardar({ ...cambio, usuario_id: usuarioActual().id, ruta, method, body, creado_en: Date.now() });
        await pintarCola();
        return { ...resultado, pendiente_de_enviar: true };
      } catch {
        throw new Error('Sin conexión y este navegador no permite guardar el cambio. Inténtalo cuando vuelva la señal.');
      }
    }

    // Envía los cambios en orden. Si se va la señal se detiene y conserva el resto; si el servidor rechaza uno,
    // lo marca para que la persona decida, sin perderlo y sin enviar lo que dependía de él.
    async function enviarCola() {
      let enviados = 0;
      let rechazados = 0;
      for (;;) {
        const cambios = await colaOffline.todos();
        const cambio = cambios.find((c) => !c.error);
        const token = sesion.leer()?.token;
        if (!cambio || !token) break;

        let respuesta;
        try {
          respuesta = await fetch(API_URL + cambio.ruta, {
            method: cambio.method,
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(cambio.body)
          });
        } catch { break; }

        const datos = await respuesta.json().catch(() => ({}));
        if (respuesta.status === 401) {
          cerrarSesion();
          mostrarAviso('Tu sesión expiró. Entra de nuevo y tus cambios guardados se enviarán.');
          return;
        }
        if (respuesta.status >= 500 || respuesta.status === 429) break; // falla temporal: se reintenta después

        if (respuesta.ok || await yaSeAplico(cambio, respuesta.status, token)) {
          await colaOffline.borrar(cambio.id);
          enviados++;
          if (cambio.idLocal && respuesta.ok) {
            // Lo que se hizo después con ese registro ya puede usar el id que le dio el servidor
            await Promise.all(cambios.filter((c) => c.id !== cambio.id && ID_LOCAL.test(c.ruta)
              && c.ruta.includes(`/${cambio.idLocal}`)).map((c) => colaOffline.guardar({
              ...c, ruta: c.ruta.replace(`/${cambio.idLocal}`, `/${datos.id}`)
            })));
          }
          continue;
        }

        const motivo = datos.message || `Error ${respuesta.status}`;
        await colaOffline.guardar({ ...cambio, error: motivo });
        rechazados++;
        if (cambio.idLocal) {
          await Promise.all(cambios.filter((c) => c.ruta.includes(`/${cambio.idLocal}`)).map((c) => colaOffline.guardar({
            ...c, error: 'Depende de un registro que no se pudo guardar'
          })));
        }
      }
      await pintarCola();
      if (enviados || rechazados) {
        const partes = [];
        if (enviados) partes.push(`${enviados} ${enviados === 1 ? 'cambio enviado' : 'cambios enviados'}`);
        if (rechazados) partes.push(`${rechazados} sin aplicar`);
        mostrarAviso(`Sincronizado: ${partes.join(' · ')}.`);
      }
      if (enviados) {
        await cargarSeccion({ silencioso: true });
        if ($('#dlg-viaje').open) refrescarDetalle();
        precargarDatos();
      }
    }

    // Si se perdió la respuesta, el servidor pudo haber aplicado ya el cambio de estado: no es un rechazo
    async function yaSeAplico(cambio, status, token) {
      if (status !== 409 || !cambio.ruta.endsWith('/estado')) return false;
      try {
        const respuesta = await fetch(API_URL + cambio.ruta.replace(/\/estado$/, ''), {
          cache: 'no-store', headers: { Authorization: `Bearer ${token}` }
        });
        return respuesta.ok && (await respuesta.json()).estado === cambio.body.estado;
      } catch { return false; }
    }

    let sincronizando = false;
    async function sincronizarCola() {
      if (sincronizando || !usuarioActual()) return;
      sincronizando = true;
      try {
        // Con varias pestañas abiertas, solo una envía a la vez
        await (navigator.locks ? navigator.locks.request('trazzo-cola', enviarCola) : enviarCola());
      } catch { /* almacenamiento bloqueado: se reintenta en la siguiente vuelta */ }
      finally { sincronizando = false; }
    }

    // Guarda en la caché lo principal para poder abrir esas secciones sin señal aunque no se hayan visitado.
    // Tráfico no se incluye porque cada consulta gasta el cupo de TomTom.
    function precargarDatos() {
      const usuario = usuarioActual();
      if (!usuario || !navigator.onLine) return;
      const rutas = ['/viajes', '/viajes/resumen', '/viajes/eventos', '/viajes/mapa'];
      const historial = consultaHistorial();
      historial.set('pagina', 1);
      historial.set('por_pagina', POR_PAGINA_HISTORIAL);
      rutas.push(`/viajes/historial?${historial}`);
      if (esOficina()) rutas.push('/viajes?estado=pendiente', '/flota/operadores', '/flota/unidades');
      if (usuario.rol === 'admin') rutas.push('/users');
      Promise.allSettled(rutas.map((ruta) => api(ruta)));
    }

    const plural = (n, una, varias) => `${n} ${n === 1 ? una : varias}`;

    async function pintarCola() {
      const cambios = await colaOffline.todos().catch(() => []);
      cambiosPorEnviar = cambios.filter((c) => !c.error).length;
      cambiosFallidos = cambios.length - cambiosPorEnviar;

      const partes = [];
      if (!navigator.onLine) partes.push('Sin conexión · se muestran los últimos datos guardados');
      if (cambiosPorEnviar) partes.push(`${plural(cambiosPorEnviar, 'cambio', 'cambios')} por enviar`);
      if (cambiosFallidos) partes.push(`${plural(cambiosFallidos, 'cambio', 'cambios')} sin aplicar`);
      $('#aviso-offline-texto').textContent = partes.join(' · ');
      $('#aviso-offline').hidden = !partes.length;
      $('#btn-cola').hidden = !cambios.length;

      const lista = $('#cola-lista');
      lista.replaceChildren(...cambios.map((c) => el('li', { class: 'cola__item' },
        el('div', {},
          el('b', { text: c.texto }),
          el('small', { class: c.error ? 'es-error' : 'muted', text: c.error || `Guardado ${fmtHora.format(new Date(c.creado_en))} · por enviar` })),
        el('div', { class: 'cola__botones' },
          c.error ? el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => reintentarCambio(c), text: 'Reintentar' }) : '',
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => descartarCambio(c, cambios), text: 'Descartar' })))));
      if (!cambios.length && $('#dlg-cola').open) $('#dlg-cola').close();
    }

    async function reintentarCambio(cambio) {
      const { error, ...limpio } = cambio;
      await colaOffline.guardar(limpio);
      await pintarCola();
      sincronizarCola();
    }

    async function descartarCambio(cambio, cambios) {
      const dependientes = cambio.idLocal ? cambios.filter((c) => c.id !== cambio.id && c.ruta.includes(`/${cambio.idLocal}`)) : [];
      const extra = dependientes.length ? ` También se descartarán ${plural(dependientes.length, 'cambio', 'cambios')} que dependen de él.` : '';
      if (!confirm(`¿Descartar «${cambio.texto}»? No se enviará al servidor.${extra}`)) return;
      await Promise.all([cambio, ...dependientes].map((c) => colaOffline.borrar(c.id)));
      await pintarCola();
      cargarSeccion({ silencioso: true });
    }

    function iniciarCola() {
      $('#btn-cola').addEventListener('click', () => $('#dlg-cola').showModal());
      $('#cola-cerrar').addEventListener('click', () => $('#dlg-cola').close());
      window.addEventListener('offline', pintarCola);
      window.addEventListener('online', () => {
        pintarCola();
        sincronizarCola();
        precargarDatos();
      });
      // navigator.onLine no detecta todo (wifi sin internet, servidor apagado): con pendientes se reintenta
      setInterval(() => {
        if (cambiosPorEnviar && navigator.onLine && !document.hidden) sincronizarCola();
      }, 30000);
      pintarCola().then(sincronizarCola);
      precargarDatos();
    }

    // fetch con el token y manejo de errores; lanza Error con el mensaje del servidor
    async function api(ruta, { method = 'GET', body } = {}) {
      const token = sesion.leer()?.token;
      const esDocumento = ruta.startsWith('/documentos');
      const cacheable = method === 'GET' && !esDocumento;
      const guardable = Boolean(token) && seGuardaSinConexion(ruta, method);
      // La clave evita un viaje duplicado si se pierde la respuesta y el registro se vuelve a enviar
      if (method === 'POST' && ruta === '/viajes') body = { clave_cliente: nuevaClave(), ...body };
      let respuesta;
      try {
        // Un registro creado sin señal solo existe aquí, y un cambio nuevo espera su turno detrás de los anteriores
        if (ID_LOCAL.test(ruta) || (guardable && cambiosPorEnviar)) throw new Error('Pendiente de enviar');
        respuesta = await fetch(API_URL + ruta, {
          method,
          cache: esDocumento ? 'no-store' : 'default',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: body && JSON.stringify(body)
        });
      } catch {
        // Sin red: las consultas usan la última copia guardada y los cambios se guardan para enviarlos después
        if (guardable) return guardarCambio(ruta, method, body);
        const guardado = cacheable && await leerSinConexion(ruta);
        if (guardado) return guardado;
        if (ID_LOCAL.test(ruta)) throw new Error('Este registro aún no llega al servidor: podrás hacerlo cuando se envíe.');
        if (cacheable) throw new Error('Sin conexión: esta información todavía no está guardada en este equipo.');
        throw new Error(navigator.onLine
          ? 'No hay conexión con el servidor. ¿Está encendido el backend?'
          : 'Esta acción necesita conexión a internet. Inténtalo cuando vuelva la señal.');
      }

      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.status === 401 && token) {
        cerrarSesion();
        mostrarAviso(datos.message || 'Tu sesión expiró.');
      }
      if (!respuesta.ok) throw Object.assign(new Error(datos.message || `Error ${respuesta.status}`), { status: respuesta.status });
      if (cacheable) await cacheApi.guardar(ruta, datos);
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
      // La configuración de OCR requiere sesión: se consulta al entrar, no al cargar la página
      if (['admin', 'operador'].includes(usuario?.rol)) {
        cargarAvisoPrivacidadOcr().catch((error) => {
          $('#doc-aviso-privacidad').textContent = `No se pudo consultar la configuración OCR: ${error.message}`;
        });
      }
      if (usuario?.rol === 'admin') {
        cargarConteoDocumentos().catch((error) => mostrarAviso(error.message));
      } else {
        $('#nav-documentos-pendientes').hidden = true;
      }
      actualizarBotonAvisos(usuario);
    }

    function cerrarSesion() {
      quitarAvisosDelServidor(); // este equipo deja de recibir los avisos de quien cerró sesión
      if (gpsViajeId) void detenerGpsTelefono({ aviso: false });
      sesion.borrar();
      cacheApi.borrar();
      $('#asis-panel').hidden = true;
      $('#asig').hidden = true;
      reiniciarAsistente();
      mostrarUsuario(null);
      pintarCola();
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
          pintarCola().then(sincronizarCola);
          precargarDatos();
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
        const sinEnviar = cambiosPorEnviar + cambiosFallidos;
        if (sinEnviar && !confirm(`Tienes ${plural(sinEnviar, 'cambio', 'cambios')} sin enviar. Se quedarán en este equipo hasta que vuelvas a entrar. ¿Cerrar sesión?`)) return;
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
      trafico: cargarTrafico,
      documentos: cargarDocumentos
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

    let mapaLeaflet = null;
    let capaRutasUnidades = null;
    let capaMarcadoresUnidades = null;
    let viajesMapa = [];
    let mapaEncuadrado = false;
    let cargandoMapa = false;

    function iniciarMapaUnidades() {
      const contenedor = $('#mapa-unidades');
      if (!contenedor || !window.L) {
        const controles = $('.mapa__controles');
        if (controles) controles.hidden = true;
        $('#mapa-texto').textContent = 'Vista esquemática · mapa detallado no disponible sin conexión';
        return;
      }

      contenedor.replaceChildren();
      mapaLeaflet = L.map(contenedor, { preferCanvas: true }).setView([23.6, -102.5], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(mapaLeaflet);
      capaRutasUnidades = L.layerGroup().addTo(mapaLeaflet);
      capaMarcadoresUnidades = L.layerGroup().addTo(mapaLeaflet);

      $('#mapa-filtro-ruta').addEventListener('change', () => pintarCapasMapa(true));
      $('#mapa-capa-rutas').addEventListener('change', () => pintarCapasMapa());
      $('#mapa-capa-unidades').addEventListener('change', () => pintarCapasMapa());
      $('#mapa-encuadrar').addEventListener('click', () => encuadrarMapa());
      window.addEventListener('hashchange', () => {
        if (location.hash === '#tablero') mapaLeaflet?.invalidateSize();
      });
    }

    function distanciaEntre(a, b) {
      const radianes = Math.PI / 180;
      const dLat = (b[0] - a[0]) * radianes;
      const dLon = (b[1] - a[1]) * radianes;
      const latA = a[0] * radianes;
      const latB = b[0] * radianes;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    function ubicarEnTrazo(trazo, avance) {
      if (!trazo?.length) return null;
      if (trazo.length === 1) return { posicion: trazo[0], recorrido: trazo };

      const segmentos = trazo.slice(1).map((punto, i) => distanciaEntre(trazo[i], punto));
      const distanciaTotal = segmentos.reduce((total, tramo) => total + tramo, 0);
      const objetivo = distanciaTotal * Math.max(0, Math.min(100, Number(avance) || 0)) / 100;
      let acumulada = 0;
      const recorrido = [trazo[0]];

      for (let i = 0; i < segmentos.length; i++) {
        const siguiente = acumulada + segmentos[i];
        if (siguiente >= objetivo || i === segmentos.length - 1) {
          const proporcion = segmentos[i] ? Math.max(0, Math.min(1, (objetivo - acumulada) / segmentos[i])) : 0;
          const posicion = [
            trazo[i][0] + (trazo[i + 1][0] - trazo[i][0]) * proporcion,
            trazo[i][1] + (trazo[i + 1][1] - trazo[i][1]) * proporcion
          ];
          recorrido.push(posicion);
          return { posicion, recorrido };
        }
        recorrido.push(trazo[i + 1]);
        acumulada = siguiente;
      }
      return { posicion: trazo.at(-1), recorrido };
    }

    function encuadrarMapa() {
      if (!mapaLeaflet) return;
      const seleccionado = $('#mapa-filtro-ruta').value;
      const viajes = viajesMapa.filter((viaje) => seleccionado === 'todas' || String(viaje.id) === seleccionado);
      const coordenadas = viajes.flatMap((viaje) => viaje.trazo || []);
      if (coordenadas.length) {
        mapaLeaflet.fitBounds(L.latLngBounds(coordenadas), { padding: [24, 24], maxZoom: 12 });
        mapaEncuadrado = true;
      } else {
        mapaLeaflet.setView([23.6, -102.5], 5);
      }
    }

    function pintarCapasMapa(encuadrar = false) {
      if (!mapaLeaflet) return;
      capaRutasUnidades.clearLayers();
      capaMarcadoresUnidades.clearLayers();
      const seleccionado = $('#mapa-filtro-ruta').value;
      const mostrarRutas = $('#mapa-capa-rutas').checked;
      const mostrarUnidades = $('#mapa-capa-unidades').checked;
      const colorVariable = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
      const colorRuta = colorVariable('--accent') || '#e0a526';
      const visibles = viajesMapa.filter((viaje) => seleccionado === 'todas' || String(viaje.id) === seleccionado);

      visibles.forEach((viaje) => {
        const puntoGps = viaje.gps_reciente
          && Number.isFinite(viaje.gps_latitud) && Number.isFinite(viaje.gps_longitud)
          ? [viaje.gps_latitud, viaje.gps_longitud]
          : null;
        const ubicacionSimulada = ubicarEnTrazo(viaje.trazo, viaje.avance_mapa ?? viaje.avance);
        const posicion = puntoGps || ubicacionSimulada?.posicion;
        if (!posicion) return;
        const color = colorVariable(viaje.estado === 'retraso' ? '--alert' : viaje.estado === 'pendiente' ? '--wait' : '--go') || '#257a4b';

        if (mostrarRutas && viaje.trazo?.length) {
          L.polyline(viaje.trazo, { color: colorRuta, weight: 4, opacity: .85 })
            .bindTooltip(`Ruta de ${viaje.folio}: ${ciudad(viaje.origen)} → ${ciudad(viaje.destino)}`)
            .addTo(capaRutasUnidades);
          if (!puntoGps && ubicacionSimulada?.recorrido) {
            L.polyline(ubicacionSimulada.recorrido, { color, weight: 5, opacity: .95 }).addTo(capaRutasUnidades);
          }
        }

        if (mostrarUnidades) {
          const popup = el('div', { class: 'mapa-popup' },
            el('b', { text: `${viaje.folio} · ${viaje.placas || 'Sin unidad'}` }),
            el('p', { text: `${ciudad(viaje.origen)} → ${ciudad(viaje.destino)}` }),
            el('p', { text: `${viaje.estado === 'retraso' ? 'Con retraso' : viaje.estado === 'pendiente' ? 'Pendiente de asignar' : viaje.estado === 'asignado' ? 'Asignado' : 'En ruta'} · ${viaje.avance_mapa ?? viaje.avance}%` }),
            el('p', { text: puntoGps ? `GPS del teléfono · precisión ±${Math.round(viaje.gps_precision_m || 0)} m` : viaje.estado === 'pendiente' ? 'Aún no sale · ruta planeada' : 'Ubicación simulada' }),
            el('p', { text: etaTexto(viaje) }),
            el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => abrirDetalle(viaje.id), text: 'Ver detalle' }));
          L.circleMarker(posicion, {
            radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1
          }).bindTooltip(`${viaje.folio} · ${viaje.avance_mapa ?? viaje.avance}%`).bindPopup(popup).addTo(capaMarcadoresUnidades);
        }
      });

      if (encuadrar) encuadrarMapa();
      else if (!mapaEncuadrado && visibles.some((viaje) => viaje.trazo?.length)) encuadrarMapa();
    }

    function pintarMapaEsquematico(viajes) {
      const enMovimiento = viajes.filter((v) => ['en_ruta', 'retraso'].includes(v.estado));
      const rutas = $$('#mapa-unidades .mapa-ruta');
      const grupo = $('#mapa-puntos');
      const vigentes = new Set();

      enMovimiento.forEach((v, i) => {
        const ruta = rutas[i % rutas.length];
        if (!ruta) return;
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
      $('#mapa-texto').textContent = enMovimiento.length
        ? `${enMovimiento.length} unidad${enMovimiento.length === 1 ? '' : 'es'} · posición simulada`
        : 'Sin unidades en movimiento';
    }

    async function cargarMapaInteractivo() {
      if (!mapaLeaflet || cargandoMapa) return;
      cargandoMapa = true;
      try {
        const datos = await api('/viajes/mapa');
        viajesMapa = datos;
        const filtroRuta = $('#mapa-filtro-ruta');
        const anterior = filtroRuta.value;
        filtroRuta.replaceChildren(el('option', { value: 'todas', text: 'Todas las rutas' }),
          ...datos.map((viaje) => el('option', {
            value: viaje.id,
            text: `${viaje.folio} · ${viaje.placas || 'Sin unidad'}`
          })));
        filtroRuta.value = datos.some((viaje) => String(viaje.id) === anterior) ? anterior : 'todas';

        const conError = datos.filter((viaje) => viaje.ruta_error);
        const fecha = fmtHora.format(new Date()).replace(/\./g, '');
        const gpsActivos = datos.filter((viaje) => viaje.gps_reciente).length;
        $('#mapa-texto').textContent = datos.length
          ? `${datos.length} ruta${datos.length === 1 ? '' : 's'} · ${gpsActivos} GPS real${gpsActivos === 1 ? '' : 'es'} · ${fecha}`
          : 'Sin viajes activos ni pendientes';
        $('#mapa-nota').textContent = conError.length
          ? `No se pudo trazar ${conError.map((viaje) => `${viaje.folio}: ${viaje.ruta_error}`).join(' · ')}. Las rutas pueden tardar al primer cálculo.`
          : 'Las rutas son por carretera (OpenStreetMap). Los operadores pueden compartir el GPS del teléfono durante un viaje; sin GPS reciente, se muestra la posición simulada.';
        mapaLeaflet.invalidateSize();
        pintarCapasMapa();
      } catch (error) {
        $('#mapa-texto').textContent = 'No se pudo actualizar el mapa';
        $('#mapa-nota').textContent = error.message;
      } finally {
        cargandoMapa = false;
      }
    }

    function pintarMapa(viajes) {
      if (!mapaLeaflet) {
        pintarMapaEsquematico(viajes);
        return;
      }
      cargarMapaInteractivo();
    }

    const claseEvento = (tipo) => ({ retraso: 'alert', creado: 'wait', cancelado: 'alert', panico: 'alert' }[tipo] || '');

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
    let gpsWatchId = null;
    let gpsViajeId = null;
    let gpsUltimoEnvio = 0;
    let gpsEnvioEnCurso = false;

    function mostrarEstadoGps(texto, error = false) {
      const estado = $('#dv-gps-estado');
      estado.textContent = texto;
      estado.classList.toggle('es-error', error);
    }

    function pintarGpsTelefono(viaje) {
      const zona = $('#dv-gps');
      const usuario = usuarioActual();
      const operadorAsignado = usuario?.rol === 'operador' && viaje.operador_id === usuario.id;
      const viajeActivo = ['en_ruta', 'retraso'].includes(viaje.estado);
      zona.hidden = !operadorAsignado || !viajeActivo;
      if (zona.hidden) return;

      const seguro = window.isSecureContext && Boolean(navigator.geolocation);
      const boton = $('#dv-gps-toggle');
      boton.disabled = !seguro;
      boton.textContent = gpsViajeId === viaje.id
        ? 'Dejar de compartir ubicación'
        : 'Compartir ubicación de este teléfono';
      if (!seguro) {
        mostrarEstadoGps('Para usar el GPS, abre Trazzo en una conexión HTTPS segura y permite la ubicación del teléfono.', true);
      } else if (gpsViajeId === viaje.id) {
        mostrarEstadoGps('GPS activo en este teléfono. La app enviará una ubicación cada 10 segundos mientras permanezca abierta.');
      } else {
        mostrarEstadoGps('La ubicación solo se comparte durante este viaje y se borra al detener el GPS o entregar el viaje.');
      }
    }

    async function enviarPosicionGps(viajeId, position) {
      if (gpsViajeId !== viajeId || gpsEnvioEnCurso || Date.now() - gpsUltimoEnvio < 10_000) return;
      gpsUltimoEnvio = Date.now();
      gpsEnvioEnCurso = true;
      try {
        await api(`/viajes/${viajeId}/ubicacion`, {
          method: 'PUT',
          body: {
            latitud: position.coords.latitude,
            longitud: position.coords.longitude,
            precision_m: position.coords.accuracy
          }
        });
        if (gpsViajeId === viajeId) {
          mostrarEstadoGps(`Compartiendo ubicación · precisión ±${Math.round(position.coords.accuracy)} m · actualizado ahora.`);
          if (location.hash === '#tablero') cargarMapaInteractivo();
        }
      } catch (error) {
        if (gpsViajeId === viajeId) {
          mostrarEstadoGps(`No se pudo enviar la ubicación: ${error.message}`, true);
          if (error.message.includes('solo se puede compartir durante un viaje en curso')) {
            if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
            gpsViajeId = null;
            $('#dv-gps-toggle').textContent = 'Compartir ubicación de este teléfono';
          } else if (error.message.includes('no está asignado a ti')) {
            if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
            gpsViajeId = null;
            $('#dv-gps-toggle').textContent = 'Compartir ubicación de este teléfono';
          }
        }
      } finally {
        gpsEnvioEnCurso = false;
      }
    }

    async function detenerGpsTelefono({ borrar = true, aviso = true } = {}) {
      const viajeId = gpsViajeId;
      if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
      gpsViajeId = null;
      gpsUltimoEnvio = 0;

      if (borrar && viajeId && usuarioActual()) {
        try {
          await api(`/viajes/${viajeId}/ubicacion`, { method: 'DELETE' });
        } catch (error) {
          if (aviso) mostrarEstadoGps(`El GPS se detuvo en el teléfono, pero no se pudo borrar la última ubicación: ${error.message}`, true);
        }
      }
      if (viajeAbierto === viajeId) {
        mostrarEstadoGps('Ubicación detenida y última posición borrada.');
        $('#dv-gps-toggle').textContent = 'Compartir ubicación de este teléfono';
      }
      if (aviso && viajeAbierto === viajeId) await refrescarDetalle();
    }

    function iniciarGpsTelefono(viajeId) {
      if (!window.isSecureContext || !navigator.geolocation) {
        mostrarEstadoGps('El GPS requiere HTTPS y permiso de ubicación en el teléfono.', true);
        return;
      }
      if (gpsViajeId && gpsViajeId !== viajeId) void detenerGpsTelefono({ aviso: false });

      gpsViajeId = viajeId;
      gpsUltimoEnvio = 0;
      mostrarEstadoGps('Esperando señal GPS del teléfono…');
      gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
          void enviarPosicionGps(viajeId, position);
        },
        (error) => {
          if (gpsViajeId !== viajeId) return;
          mostrarEstadoGps(`No se pudo obtener el GPS: ${error.message}`, true);
          if (error.code === error.PERMISSION_DENIED) void detenerGpsTelefono({ aviso: false });
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
      );
      $('#dv-gps-toggle').textContent = 'Dejar de compartir ubicación';
    }

    /* ---------- Mapa del seguimiento ---------- */
    let mapaDetalle = null;
    let capaDetalle = null;
    let viajeEnMapa = null;

    function textoFuenteMapa(v, gps) {
      if (gps) {
        const precision = Number.isFinite(gps.precision_m) ? ` · ±${Math.round(gps.precision_m)} m` : '';
        return `Ubicación en vivo · GPS del camión, actualizada ${fmtHora.format(new Date(gps.actualizada_en))}${precision}`;
      }
      if (v.estado === 'entregado') return 'Viaje entregado';
      if (v.estado === 'cancelado') return 'Viaje cancelado · se muestra la ruta planeada';
      if (['pendiente', 'asignado'].includes(v.estado)) return 'Aún no sale · se muestra la ruta planeada';
      return 'Posición aproximada según el avance del viaje · sin GPS del camión';
    }

    function avisoMapaDetalle(texto) {
      $('#dv-mapa-panel').hidden = false;
      $('#dv-mapa').hidden = true;
      $('#dv-mapa-fuente').textContent = texto;
      $('#dv-mapa-fuente').classList.remove('dv-mapa__fuente--vivo');
    }

    async function cargarMapaDetalle(v) {
      const panel = $('#dv-mapa-panel');
      let datos = null;
      let sinRespuesta = false;
      // Sin Leaflet, sin permiso o con un viaje que aún no llega al servidor, la ventana sigue sin mapa
      if (window.L && usuarioActual()?.rol !== 'cliente') {
        try { datos = await api(`/viajes/${v.id}/mapa`); } catch { sinRespuesta = v.id > 0; }
      }
      if (viajeAbierto !== v.id) return;
      if (!datos?.trazo?.length) {
        if (viajeEnMapa === v.id) return; // ya hay un mapa a la vista: se conserva hasta la siguiente vuelta
        if (datos || sinRespuesta) avisoMapaDetalle('No se pudo cargar el mapa: el servicio de rutas no responde. Se reintenta solo.');
        else panel.hidden = true;
        return;
      }
      panel.hidden = false;
      $('#dv-mapa').hidden = false;

      if (!mapaDetalle) {
        mapaDetalle = L.map('dv-mapa', { zoomControl: true, scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapaDetalle);
        capaDetalle = L.layerGroup().addTo(mapaDetalle);
      }
      mapaDetalle.invalidateSize();

      const color = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
      const gps = datos.ubicacion;
      const estimada = ubicarEnTrazo(datos.trazo, v.avance);
      const posicion = gps ? [gps.lat, gps.lon] : estimada.posicion;

      capaDetalle.clearLayers();
      L.polyline(datos.trazo, { color: color('--accent'), weight: 5, opacity: .85 }).bindTooltip('Ruta del viaje').addTo(capaDetalle);
      if (!gps) L.polyline(estimada.recorrido, { color: color('--go'), weight: 5 }).addTo(capaDetalle);
      if (datos.origen) L.circleMarker([datos.origen.lat, datos.origen.lon], { radius: 7, color: '#fff', weight: 2, fillColor: color('--go'), fillOpacity: 1 }).bindTooltip(`Origen: ${ciudad(v.origen)}`).addTo(capaDetalle);
      if (datos.destino) L.circleMarker([datos.destino.lat, datos.destino.lon], { radius: 7, color: '#fff', weight: 2, fillColor: color('--accent'), fillOpacity: 1 }).bindTooltip(`Destino: ${ciudad(v.destino)}`).addTo(capaDetalle);
      L.marker(posicion, {
        icon: L.divIcon({
          className: '',
          html: `<span class="dv-mapa__camion${gps ? ' dv-mapa__camion--vivo' : ''}"><svg class="i" aria-hidden="true"><use href="#i-truck" /></svg></span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        }),
        keyboard: false
      }).bindTooltip(`${v.folio} · ${v.avance} %`).addTo(capaDetalle);

      // Se encuadra al abrir cada viaje; después solo se sigue al camión si sale de la vista
      if (viajeEnMapa !== v.id) {
        viajeEnMapa = v.id;
        mapaDetalle.fitBounds(L.latLngBounds([...datos.trazo, posicion]), { padding: [28, 28] });
      } else if (gps && !mapaDetalle.getBounds().contains(posicion)) {
        mapaDetalle.panTo(posicion);
      }

      const fuente = $('#dv-mapa-fuente');
      fuente.textContent = textoFuenteMapa(v, gps);
      fuente.classList.toggle('dv-mapa__fuente--vivo', Boolean(gps));
    }

    async function abrirDetalle(id) {
      try {
        if (viajeAbierto !== id) $('#dv-rastreo').hidden = true;
        if (viajeEnMapa !== id) { // no dejar a la vista el mapa del viaje anterior
          if (id > 0 && window.L && usuarioActual()?.rol !== 'cliente') avisoMapaDetalle('Cargando el mapa…');
          else $('#dv-mapa-panel').hidden = true;
        }
        viajeAbierto = id;
        $('#dv-nota').value = '';
        const viaje = await api(`/viajes/${id}`);
        pintarDetalle(viaje);
        const dialogo = $('#dlg-viaje');
        if (!dialogo.open) dialogo.showModal();
        cargarMapaDetalle(viaje);
      } catch (error) {
        mostrarAviso(error.message);
      }
    }

    async function refrescarDetalle() {
      if (!viajeAbierto) return;
      try {
        const viaje = await api(`/viajes/${viajeAbierto}`);
        pintarDetalle(viaje);
        cargarMapaDetalle(viaje);
      } catch { /* se reintenta en la siguiente vuelta */ }
    }

    function pintarDetalle(v) {
      viajeEscaner = v;
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

      pintarGpsTelefono(v);
      pintarAcciones(v);
      cargarDocumentosViaje(v).catch((error) => mostrarAviso(error.message));
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
        if (['entregado', 'cancelado'].includes(accion.estado) && gpsViajeId === v.id) {
          await detenerGpsTelefono({ aviso: false });
        }
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
      $('#dv-gps-toggle').addEventListener('click', () => {
        if (!viajeAbierto) return;
        if (gpsViajeId === viajeAbierto) void detenerGpsTelefono();
        else iniciarGpsTelefono(viajeAbierto);
      });
      dialogo.addEventListener('close', () => {
        viajeAbierto = null;
        viajeEnMapa = null;
        viajeEscaner = null;
        clearTimeout(temporizadorListaViaje);
        cerrarEscanerDocumento({ ocultar: true });
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
      // La selección se fija antes de pedir los datos: si el refresco automático y un clic se
      // cruzan, la respuesta que llegue tarde de un viaje que ya no está elegido se descarta
      viajeTraficoId = id;
      const datos = await api(`/trafico/viajes/${id}`);
      if (viajeTraficoId !== id) return;
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

    /* ---------- Botón de pánico: aviso para administradores ---------- */
    // El operador activa la alerta desde la app móvil. Aquí se revisa cada 10 s, también con la
    // pestaña en segundo plano, y el aviso suena hasta que alguien lo silencia o lo cierra.
    let alertasPanico = [];
    let alertaPanicoId = null;            // la alerta abierta en el diálogo
    let alertaPanicoEncuadrada = null;    // el mapa solo se reencuadra al cambiar de alerta
    const panicoSilenciadas = new Set();  // alertas que ya no suenan en esta pestaña
    let mapaPanico = null;
    let capaPanico = null;
    let sonidoPanico = null;
    const tituloOriginal = document.title;

    async function revisarPanico() {
      if (usuarioActual()?.rol !== 'admin') {
        alertasPanico = [];
      } else {
        try {
          alertasPanico = await api('/panico?estado=activa');
        } catch {
          return; // sin red se queda el último aviso
        }
      }
      pintarAvisoPanico();
      if ($('#dlg-panico').open && alertaPanicoId) abrirPanico(alertaPanicoId).catch(() => { /* se reintenta en 10 s */ });
    }

    function pintarAvisoPanico() {
      const activas = alertasPanico;
      $('#panico-aviso').hidden = !activas.length;
      document.title = activas.length ? `(${activas.length}) Alerta de pánico · ${tituloOriginal}` : tituloOriginal;
      if (!activas.length) {
        detenerSonidoPanico();
        return;
      }

      const primera = activas[0];
      $('#panico-titulo').textContent = activas.length > 1 ? `${activas.length} alertas de pánico activas` : 'Botón de pánico activado';
      $('#panico-detalle').textContent = [primera.operador, primera.folio, primera.placas, haceCuanto(primera.creada_en)]
        .filter(Boolean).join(' · ');

      const porSonar = activas.some((a) => !panicoSilenciadas.has(a.id));
      $('#panico-silenciar').hidden = !porSonar;
      if (porSonar) sonarPanico();
      else detenerSonidoPanico();
    }

    // Pitido con Web Audio (sin archivos). Si el navegador no deja sonar sin un clic previo,
    // se reanuda en el siguiente clic; mientras tanto queda el aviso visual.
    function sonarPanico() {
      if (sonidoPanico) return;
      try {
        const contexto = new (window.AudioContext || window.webkitAudioContext)();
        const pitido = () => {
          const oscilador = contexto.createOscillator();
          const volumen = contexto.createGain();
          oscilador.type = 'square';
          oscilador.frequency.value = 880;
          volumen.gain.value = 0.06;
          oscilador.connect(volumen).connect(contexto.destination);
          oscilador.start();
          oscilador.stop(contexto.currentTime + 0.25);
        };
        pitido();
        sonidoPanico = { contexto, intervalo: setInterval(pitido, 1500) };
      } catch { /* sin audio */ }
    }

    function detenerSonidoPanico() {
      if (!sonidoPanico) return;
      clearInterval(sonidoPanico.intervalo);
      sonidoPanico.contexto.close().catch(() => {});
      sonidoPanico = null;
    }

    async function abrirPanico(id) {
      const alerta = await api(`/panico/${id}`);
      const cambio = alertaPanicoId !== id;
      alertaPanicoId = id;

      const lista = $('#panico-lista');
      lista.hidden = alertasPanico.length < 2;
      lista.replaceChildren(...alertasPanico.map((a) => el('button', {
        type: 'button',
        class: 'tr-item',
        'aria-pressed': String(a.id === id),
        onclick: () => abrirPanico(a.id).catch((error) => mostrarAviso(error.message))
      },
      el('span', { class: 'tr-item__cabeza' },
        el('span', { class: 'mono', text: a.folio || 'Sin viaje' }),
        el('span', { class: 'st st--alert', text: haceCuanto(a.creada_en) })),
      el('span', { class: 'tr-item__ruta', text: a.operador }))));

      const fila = (titulo, ...valor) => [el('dt', { text: titulo }), el('dd', {}, ...valor)];
      $('#panico-datos').replaceChildren(
        ...fila('Operador', alerta.operador),
        ...fila('Viaje', alerta.folio ? `${alerta.folio} · ${ciudad(alerta.origen)} → ${ciudad(alerta.destino)}` : 'Sin viaje activo'),
        ...fila('Unidad', alerta.placas ? `${alerta.placas} · ${alerta.marca_modelo}` : '—'),
        ...fila('Activada', `${hora(alerta.creada_en)} (${haceCuanto(alerta.creada_en)})`),
        ...fila('Última ubicación', alerta.lat != null
          ? [`${hora(alerta.ubicacion_en)}${alerta.precision_m ? ` · ±${alerta.precision_m} m` : ''} · `,
            el('a', { href: `https://www.google.com/maps?q=${alerta.lat},${alerta.lon}`, target: '_blank', rel: 'noopener', text: 'Abrir en Google Maps' })]
          : 'El teléfono no envió ubicación GPS'),
        ...(alerta.nota ? fila('Nota del operador', alerta.nota) : []),
        ...(alerta.estado !== 'activa' ? fila('Cerrada por', `${alerta.atendio || '—'} · ${hora(alerta.atendida_en)}`) : [])
      );

      if (cambio) {
        $('#panico-nota').value = '';
        $('#err-panico').hidden = true;
      }
      const activa = alerta.estado === 'activa';
      $('#panico-atender').disabled = !activa;
      $('#panico-falsa').disabled = !activa;

      const dialogo = $('#dlg-panico');
      if (!dialogo.open) dialogo.showModal();
      pintarMapaPanico(alerta);
    }

    let rutaPanico = { alerta: null, trazo: null };

    async function rutaDeAlerta(alerta) {
      if (rutaPanico.alerta === alerta.id && rutaPanico.trazo) return rutaPanico.trazo;
      rutaPanico = { alerta: alerta.id, trazo: null };
      if (!alerta.viaje_id || !window.L) return null;
      try {
        rutaPanico.trazo = (await api(`/viajes/${alerta.viaje_id}/mapa`)).trazo;
      } catch { /* el mapa funciona sin la ruta */ }
      return rutaPanico.trazo;
    }

    async function pintarMapaPanico(alerta) {
      const contenedor = $('#panico-mapa');
      const puntos = alerta.ubicaciones.map((u) => [u.lat, u.lon]);
      const trazo = await rutaDeAlerta(alerta);
      contenedor.hidden = (!puntos.length && !trazo?.length) || !window.L;
      if (contenedor.hidden) return;

      if (!mapaPanico) {
        mapaPanico = L.map(contenedor);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap'
        }).addTo(mapaPanico);
      }
      mapaPanico.invalidateSize();

      const ultimo = puntos.at(-1);
      capaPanico?.remove();
      capaPanico = L.layerGroup([
        trazo?.length ? L.polyline(trazo, { color: colorTema('--accent'), weight: 4, opacity: 0.85 }).bindTooltip('Ruta del viaje') : null,
        puntos.length ? L.polyline(puntos, { color: colorTema('--alert'), weight: 4, opacity: 0.8, dashArray: '4 6' }) : null,
        ultimo && alerta.precision_m ? L.circle(ultimo, { radius: alerta.precision_m, color: colorTema('--alert'), weight: 1, fillOpacity: 0.15 }) : null,
        ultimo ? L.circleMarker(ultimo, { radius: 9, color: '#fff', weight: 3, fillColor: colorTema('--alert'), fillOpacity: 1 })
          .bindTooltip(`Última ubicación · ${hora(alerta.ubicacion_en)}`) : null
      ].filter(Boolean)).addTo(mapaPanico);

      if (alertaPanicoEncuadrada !== alerta.id) {
        const encuadre = [...(trazo || []), ...puntos];
        if (encuadre.length > 1) mapaPanico.fitBounds(L.latLngBounds(encuadre), { padding: [30, 30], maxZoom: 16 });
        else mapaPanico.setView(ultimo, 15);
        alertaPanicoEncuadrada = alerta.id;
      }
    }

    async function cerrarPanico(estado) {
      const botones = [$('#panico-atender'), $('#panico-falsa')];
      const error = $('#err-panico');
      botones.forEach((b) => { b.disabled = true; });
      error.hidden = true;
      try {
        await api(`/panico/${alertaPanicoId}`, {
          method: 'PATCH',
          body: { estado, resolucion: $('#panico-nota').value.trim() || undefined }
        });
        $('#dlg-panico').close();
        mostrarAviso(estado === 'atendida' ? 'Alerta marcada como atendida.' : 'Alerta marcada como falsa alarma.');
        await revisarPanico();
      } catch (e) {
        error.textContent = e.message;
        error.hidden = false;
        botones.forEach((b) => { b.disabled = false; });
      }
    }

    function iniciarPanico() {
      if (!$('#panico-aviso')) return;

      $('#panico-ver').addEventListener('click', () => {
        if (alertasPanico[0]) abrirPanico(alertasPanico[0].id).catch((e) => mostrarAviso(e.message));
      });
      $('#panico-silenciar').addEventListener('click', () => {
        alertasPanico.forEach((a) => panicoSilenciadas.add(a.id));
        pintarAvisoPanico();
      });
      $('#panico-cerrar').addEventListener('click', () => $('#dlg-panico').close());
      $('#dlg-panico').addEventListener('close', () => { alertaPanicoId = null; });
      $('#panico-atender').addEventListener('click', () => cerrarPanico('atendida'));
      $('#panico-falsa').addEventListener('click', () => cerrarPanico('falsa_alarma'));
      document.addEventListener('click', () => sonidoPanico?.contexto.resume().catch(() => {}));

      // Al iniciar o cerrar sesión cambia el ancla: se revisa de inmediato
      window.addEventListener('hashchange', revisarPanico);
      revisarPanico();
      setInterval(() => { if (navigator.onLine) revisarPanico(); }, 10000);
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
          avisar(`Ruta por carretera de OpenStreetMap. En auto: ${duracionTexto(ruta.duracion_auto_min)}; ETA de camión con promedio de ${ruta.velocidad_promedio_kmh} km/h y factor de restricciones ×${ruta.factor_restriccion}.` +
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
          v.pendiente_de_enviar
            ? 'Se guardó en este equipo y se enviará al volver la conexión.'
            : 'Avisamos al chofer y a quien creó el viaje (si activaron sus avisos).'));
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

    /* ---------- Módulo de documentos: carga, OCR, galería, revisión y escáner ---------- */
    async function cargarDocumentosViaje(viaje) {
      const usuario = usuarioActual();
      const section = $('#dv-documentos');
      const esAdmin = usuario?.rol === 'admin';
      const esOperadorPropio = usuario?.rol === 'operador' && Number(viaje.operador_id) === Number(usuario.id);
      section.hidden = !esAdmin && !esOperadorPropio;
      if (section.hidden) {
        detenerCamaraDocumento();
        return;
      }

      $('#dv-escanear').hidden = viaje.estado === 'cancelado' || (!esAdmin && !esOperadorPropio);
      if (viaje.estado === 'cancelado') cerrarEscanerDocumento({ ocultar: true });
      const documentos = await api(`/documentos/viaje/${viaje.id}`);
      const lista = $('#dv-lista-documentos');
      const elementos = documentos.map((doc) => {
        const estado = DOC_ESTADOS[doc.estado] || DOC_ESTADOS.pendiente;
        const momento = new Date(doc.creado_en);
        const fechaHora = Number.isNaN(momento.getTime()) ? 'Fecha no disponible' : fmtFechaHora.format(momento);
        const coincidencia = DOC_TIPOS_COMPARABLES.has(doc.tipo)
          ? doc.coincide_viaje === null ? 'Coincidencia sin datos' : doc.coincide_viaje ? 'Coincide con el viaje' : 'No coincide con el viaje'
          : 'No aplica';
        const partes = [
          el('b', { text: `${DOC_TIPOS[doc.tipo] || doc.tipo || 'Documento'} · ${estado.texto}` }),
          el('small', { text: fechaHora }),
          el('small', { text: `Guía: ${doc.numero_guia || 'No detectada'}` }),
          el('small', {
            class: DOC_TIPOS_COMPARABLES.has(doc.tipo) && doc.coincide_viaje === false
              ? 'doc-match doc-match--alert' : 'doc-match doc-match--muted',
            text: coincidencia
          }),
          doc.estado === 'rechazado' && doc.nota_revision && el('small', { class: 'doc-rechazo', text: `Nota de rechazo: ${doc.nota_revision}` })
        ];
        if (esAdmin) {
          partes.unshift(el('span', { class: 'mono', text: viaje.folio }));
          if (doc.ocr_estado === 'error') partes.push(el('small', { class: 'doc-ocr-error', text: doc.ocr_error || 'Falló la lectura OCR.' }));
          partes.push(el('button', {
            type: 'button',
            class: 'btn btn--ghost btn--sm',
            onclick: () => abrirDocumento(doc.id)
          }, 'Abrir revisión'));
        }
        return el('li', { class: 'doc-trip-item' }, ...partes);
      });
      lista.replaceChildren(...(elementos.length ? elementos : [
        el('li', {}, el('small', { text: 'Todavía no hay comprobantes en este viaje.' }))
      ]));
      const hayOcrPendiente = esAdmin && documentos.some((doc) => doc.ocr_estado === 'procesando');
      clearTimeout(temporizadorListaViaje);
      if (hayOcrPendiente && $('#dlg-viaje').open) {
        temporizadorListaViaje = setTimeout(() => {
          if (viajeAbierto === viaje.id && $('#dlg-viaje').open) {
            cargarDocumentosViaje(viaje).catch((error) => mostrarAviso(error.message));
          }
        }, 3000);
      }
    }

    function cerrarEscanerDocumento({ ocultar = false } = {}) {
      if (ocultar) {
        $('#doc-escaner').hidden = true;
        if (urlVistaPreviaDocumento) URL.revokeObjectURL(urlVistaPreviaDocumento);
        urlVistaPreviaDocumento = null;
        $('#doc-preview').removeAttribute('src');
        $('#doc-preview').hidden = true;
      }
      detenerCamaraDocumento();
      if ($('#doc-camara-apagada')) $('#doc-camara-apagada').hidden = Boolean(urlVistaPreviaDocumento);
      if (!ocultar) {
        $('#doc-escaner-estado').textContent = 'Cámara apagada. Abre la cámara o elige una foto para comenzar.';
        $('#doc-calidad').textContent = '';
        $('#doc-captura-motivo').textContent = 'Capturar requiere cámara activa, imagen enfocada e iluminación suficiente.';
        $('#doc-indicador-luz').textContent = 'Iluminación: sin medición';
        $('#doc-indicador-enfoque').textContent = 'Enfoque: sin medición';
      }
    }

    function detenerCamaraDocumento() {
      if (rafCalidadDocumento !== null) cancelAnimationFrame(rafCalidadDocumento);
      rafCalidadDocumento = null;
      if (camaraDocumento) camaraDocumento.getTracks().forEach((pista) => pista.stop());
      camaraDocumento = null;
      const video = $('#doc-video');
      if (video) {
        video.srcObject = null;
        video.hidden = true;
      }
      fotogramasBuenos = 0;
      const captura = $('#doc-capturar');
      if (captura) {
        captura.disabled = true;
        captura.removeAttribute('aria-busy');
      }
    }

    function medirCalidadFotograma(canvas) {
      const contexto = canvas.getContext('2d', { willReadFrequently: true });
      if (!contexto) return null;
      const pixels = contexto.getImageData(32, 24, 96, 72).data;
      const ancho = 96;
      const alto = 72;
      const gris = new Uint8Array(ancho * alto);
      let brillo = 0;
      for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
        gris[p] = Math.round(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
        brillo += gris[p];
      }
      brillo /= gris.length;
      let suma = 0;
      let sumaCuadrados = 0;
      let cuenta = 0;
      for (let y = 1; y < alto - 1; y++) {
        for (let x = 1; x < ancho - 1; x++) {
          const i = y * ancho + x;
          const laplaciano = 4 * gris[i] - gris[i - 1] - gris[i + 1] - gris[i - ancho] - gris[i + ancho];
          suma += laplaciano;
          sumaCuadrados += laplaciano * laplaciano;
          cuenta++;
        }
      }
      const enfoque = Math.max(0, sumaCuadrados / cuenta - (suma / cuenta) ** 2);
      return {
        brillo,
        enfoque,
        luzBuena: brillo >= 45 && brillo <= 225,
        enfoqueBueno: enfoque >= 80
      };
    }

    function medirCalidadCamara() {
      const video = $('#doc-video');
      if (!camaraDocumento || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        rafCalidadDocumento = requestAnimationFrame(medirCalidadCamara);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 120;
      const contextoDibujo = canvas.getContext('2d', { willReadFrequently: true });
      if (!contextoDibujo) {
        $('#doc-calidad').textContent = 'Este navegador no permite analizar el enfoque. Elige otra foto de galería o usa la cámara.';
        detenerCamaraDocumento();
        return;
      }
      contextoDibujo.drawImage(video, 0, 0, canvas.width, canvas.height);
      let calidad;
      try {
        calidad = medirCalidadFotograma(canvas);
      } catch {
        $('#doc-calidad').textContent = 'No se pudo analizar la iluminación y el enfoque. Elige otra foto de galería o usa la cámara.';
        detenerCamaraDocumento();
        return;
      }
      if (!calidad) {
        $('#doc-calidad').textContent = 'Este navegador no permite analizar el enfoque. Elige otra foto de galería o usa la cámara.';
        detenerCamaraDocumento();
        return;
      }
      const { brillo, enfoque, luzBuena, enfoqueBueno } = calidad;
      const bueno = luzBuena && enfoqueBueno;
      fotogramasBuenos = bueno ? fotogramasBuenos + 1 : 0;
      $('#doc-capturar').disabled = fotogramasBuenos < 3;
      $('#doc-indicador-luz').textContent = `Iluminación: ${Math.round(brillo)} · ${luzBuena ? 'adecuada' : 'ajustar'}`;
      $('#doc-indicador-enfoque').textContent = `Enfoque: ${Math.round(enfoque)} · ${enfoqueBueno ? 'adecuado' : 'ajustar'}`;
      $('#doc-captura-motivo').textContent = fotogramasBuenos >= 3
        ? 'Captura habilitada: luz y enfoque estables.'
        : !luzBuena ? 'Capturar deshabilitado: mejora la iluminación.'
          : !enfoqueBueno ? 'Capturar deshabilitado: enfoca y mantén estable el comprobante.'
            : 'Capturar deshabilitado: mantén la imagen estable durante 3 mediciones.';
      $('#doc-captura-motivo').hidden = fotogramasBuenos >= 3;
      $('#doc-escaner-estado').textContent = 'Cámara activa · vista previa en vivo.';
      $('#doc-calidad').textContent = `Luz ${Math.round(brillo)} · enfoque ${Math.round(enfoque)} · ${fotogramasBuenos >= 3 ? 'Listo para capturar' : bueno ? 'Mantén estable 3 fotogramas' : 'Ajusta luz y enfoque'}`;
      rafCalidadDocumento = requestAnimationFrame(medirCalidadCamara);
    }

    async function abrirCamaraDocumento() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        $('#doc-escaner-estado').textContent = 'Cámara no disponible. Requiere HTTPS o localhost; puedes elegir una foto.';
        $('#doc-calidad').textContent = 'Elige una foto de galería o usa la cámara para continuar.';
        $('#doc-abrir-camara').hidden = true;
        return;
      }
      detenerCamaraDocumento();
      try {
        camaraDocumento = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }
        });
        const video = $('#doc-video');
        video.srcObject = camaraDocumento;
        await video.play();
        $('#doc-camara-apagada').hidden = true;
        $('#doc-preview').hidden = true;
        $('#doc-video').hidden = false;
        $('#doc-escaner-estado').textContent = 'Cámara activa · vista previa en vivo.';
        $('#doc-indicador-luz').textContent = 'Iluminación: midiendo…';
        $('#doc-indicador-enfoque').textContent = 'Enfoque: midiendo…';
        fotogramasBuenos = 0;
        rafCalidadDocumento = requestAnimationFrame(medirCalidadCamara);
      } catch (error) {
        detenerCamaraDocumento();
        $('#doc-escaner-estado').textContent = error.name === 'NotAllowedError'
          ? 'Cámara apagada. Permite el acceso o usa una foto.'
          : 'No se pudo activar la cámara. Usa una foto o intenta de nuevo.';
        mostrarAviso(error.name === 'NotAllowedError'
          ? 'Permite el acceso a la cámara o elige una foto de galería.'
          : `No se pudo abrir la cámara: ${error.message}`);
      }
    }

    const DOC_POR_PAGINA = 12;
    const DOC_TIPOS = {
      comprobante_entrega: 'Comprobante de entrega',
      guia_remision: 'Guía de remisión',
      factura: 'Factura',
      identificacion: 'Identificación',
      otro: 'Otro'
    };
    const DOC_TIPOS_COMPARABLES = new Set(['comprobante_entrega', 'guia_remision', 'factura']);
    const DOC_ESTADOS = {
      pendiente: { texto: 'Pendiente', clase: 'wait' },
      aprobado: { texto: 'Aprobado', clase: 'go' },
      rechazado: { texto: 'Rechazado', clase: 'alert' },
      archivado: { texto: 'Archivado', clase: 'done' }
    };
    const DOC_OCR_ESTADOS = {
      procesando: { texto: 'Leyendo imagen…', clase: 'wait' },
      completado: { texto: 'Leído', clase: 'go' },
      error: { texto: 'Lectura fallida', clase: 'alert' }
    };
    let paginaDocumentos = 1;
    let documentoActual = null;
    let urlImagenDocumento = null;
    let zoomImagenDocumento = 1;
    let desplazamientoImagenDocumento = { x: 0, y: 0 };
    let arrastreImagenDocumento = null;
    let temporizadorOcrDocumentos = null;
    let temporizadorListaViaje = null;
    let miniaturasDocumentos = [];
    let generacionGaleria = 0;
    let vistaDocumentos = 'lista';
    let archivadosDocumentos = false;
    let documentosVisibles = [];
    const seleccionDocumentos = new Set();
    let archivoDocumentoDisponible = true;
    let valoresInicialesDocumento = '';
    let camaraDocumento = null;
    let rafCalidadDocumento = null;
    let fotogramasBuenos = 0;
    let urlVistaPreviaDocumento = null;
    let viajeEscaner = null;

    function programarActualizacionOcr() {
      clearTimeout(temporizadorOcrDocumentos);
      if (location.hash !== '#documentos') return;
      temporizadorOcrDocumentos = setTimeout(() => {
        if (location.hash !== '#documentos') return;
        if (document.hidden) {
          programarActualizacionOcr();
          return;
        }
        cargarDocumentos().catch((error) => mostrarAviso(error.message));
      }, 3000);
    }

    function formatoFechaCampo(fecha) {
      const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha));
      return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : '';
    }

    function fechaDocumentoApi(valor) {
      if (!valor) return null;
      const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
      if (!partes) throw new Error('La fecha debe tener el formato DD/MM/AAAA.');
      const [, diaTexto, mesTexto, anioTexto] = partes;
      const dia = Number(diaTexto);
      const mes = Number(mesTexto);
      const anio = Number(anioTexto);
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));
      if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
        throw new Error('La fecha no es válida.');
      }
      return `${anioTexto}-${mesTexto}-${diaTexto}`;
    }

    function datosFormularioDocumento() {
      return Object.fromEntries(new FormData($('#form-corregir-documento')));
    }

    function actualizarNavegacionDocumento() {
      const indice = documentosVisibles.findIndex((doc) => Number(doc.id) === Number(documentoActual?.id));
      const elegible = (doc) => doc.estado === 'pendiente' && !doc.archivado_en
        && Number(doc.subido_por) !== Number(usuarioActual()?.id);
      const anterior = indice > 0 && documentosVisibles.slice(0, indice).some(elegible);
      const siguiente = indice >= 0 && documentosVisibles.slice(indice + 1).some(elegible);
      $('#doc-anterior-pendiente').disabled = !anterior;
      $('#doc-siguiente-pendiente').disabled = !siguiente;
    }

    function actualizarEstadoGuardarCorreccion() {
      const boton = $('#doc-guardar-correccion');
      if (!boton || !documentoActual) return;
      const razonBloqueo = $('#doc-bloqueo').textContent;
      let razon = razonBloqueo;
      let fechaValida = true;
      try { fechaDocumentoApi($('#doc-corr-fecha').value.trim()); } catch { fechaValida = false; }
      const cambio = JSON.stringify(datosFormularioDocumento()) !== valoresInicialesDocumento;
      if (!razon && !fechaValida) razon = 'La fecha debe ser válida y usar DD/MM/AAAA.';
      else if (!razon && !cambio) razon = 'No hay cambios para guardar.';
      boton.disabled = Boolean(razon) || boton.getAttribute('aria-busy') === 'true';
      $('#doc-guardar-motivo').textContent = razon || 'Hay cambios listos para guardar.';
      boton.title = razon;
      boton.setAttribute('aria-describedby', 'doc-bloqueo doc-guardar-motivo');
    }

    function actualizarDetalleDocumento(doc) {
      documentoActual = doc;
      const estadoOcr = DOC_OCR_ESTADOS[doc.ocr_estado] || DOC_OCR_ESTADOS.error;
      let datos = doc.datos_json;
      if (typeof datos === 'string') {
        try { datos = JSON.parse(datos); } catch { datos = {}; }
      }
      const esIdentificacion = doc.tipo === 'identificacion';
      const discrepancia = DOC_TIPOS_COMPARABLES.has(doc.tipo) && doc.coincide_viaje === false;
      const avisoDiscrepancia = $('#doc-discrepancia');
      avisoDiscrepancia.hidden = !discrepancia;
      avisoDiscrepancia.textContent = discrepancia
        ? `El documento no coincide con el viaje asociado. Viaje: ${doc.folio || 'sin folio'} · Guía extraída: ${doc.numero_guia || 'no detectada'}. Verifica la evidencia; si apruebas el documento, justifica la discrepancia en la nota.`
        : '';
      const campos = [
        ['Tipo', DOC_TIPOS[doc.tipo] || doc.tipo || 'Sin dato'],
        ['Estado', DOC_ESTADOS[doc.estado]?.texto || doc.estado || 'Sin dato'],
        ['Número de guía', doc.numero_guia || 'Sin dato'],
        ['Coincidencia', DOC_TIPOS_COMPARABLES.has(doc.tipo)
          ? doc.coincide_viaje === null ? 'Sin dato' : doc.coincide_viaje ? 'Sí' : 'No'
          : 'No aplica'],
        ['Fecha', datos?.fecha ? formatoFechaCampo(datos.fecha) : 'Sin dato'],
        ['Receptor', datos?.receptor || 'Sin dato'],
        ['Monto', datos?.monto ?? 'Sin dato'],
        ['Confianza OCR', doc.confianza || 'Sin dato'],
        ['Revisión', doc.nota_revision || doc.reviso || 'Sin revisión']
      ];
      const listaDatos = (raiz) => raiz.replaceChildren(...campos.map(([etiqueta, valor]) =>
        el('div', {}, el('dt', { text: etiqueta }), el('dd', { text: valor }))));
      listaDatos($('#doc-datos'));
      listaDatos($('#doc-datos-lectura'));
      $('#doc-corr-tipo').value = doc.tipo || 'otro';
      $('#doc-corr-guia').value = doc.numero_guia || '';
      $('#doc-corr-fecha').value = datos?.fecha ? formatoFechaCampo(datos.fecha) : '';
      $('#doc-corr-receptor').value = datos?.receptor || '';
      $('#doc-corr-monto').value = datos?.monto ?? '';
      $('#doc-corr-texto').value = esIdentificacion ? '' : doc.texto_ocr || '';
      $('#doc-corr-texto').closest('.f').hidden = esIdentificacion;
      $('#doc-ocr').textContent = esIdentificacion
        ? 'Por privacidad, no se conserva el texto OCR completo de las identificaciones.'
        : doc.ocr_estado === 'procesando'
          ? 'El OCR está procesando el documento; esta ventana se actualizará al terminar.'
          : doc.texto_ocr || 'No se detectó texto. Puedes volver a ejecutar el OCR.';
      $('#doc-copiar-ocr').hidden = esIdentificacion || !doc.texto_ocr;
      $('#doc-aviso-calidad').hidden = esIdentificacion || !(doc.confianza === 'baja' || Number(doc.calidad_ocr) < 48);
      $('#doc-ocr-estado').textContent = doc.ocr_estado === 'error'
        ? `Lectura OCR fallida: ${doc.ocr_error || 'motivo no disponible'}.`
        : `Lectura OCR: ${estadoOcr.texto}${doc.calidad_ocr != null ? ` · calidad ${doc.calidad_ocr}/100` : ''}`;

      const propio = Number(doc.subido_por) === Number(usuarioActual()?.id);
      const archivado = Boolean(doc.archivado_en);
      const procesando = doc.ocr_estado === 'procesando';
      const razonBloqueo = !archivoDocumentoDisponible
        ? 'Archivo no disponible; no se puede revisar, corregir ni reprocesar.'
        : archivado
          ? 'Este documento está archivado; restáuralo para permitir cambios.'
          : propio
            ? 'Este documento lo subiste tú; otro administrador debe revisarlo.'
            : doc.estado !== 'pendiente'
              ? 'Este documento ya fue revisado y no admite cambios.'
              : procesando
                ? 'La revisión estará disponible cuando termine el OCR.'
                : '';
      const puedeRevisar = !razonBloqueo;
      $('#doc-bloqueo').textContent = razonBloqueo;
      $('#doc-bloqueo').hidden = !razonBloqueo;
      $('#doc-datos').hidden = !puedeRevisar;
      $('#doc-datos-lectura').hidden = puedeRevisar;
      $('#form-corregir-documento').hidden = !puedeRevisar;
      $('#doc-nota').disabled = !puedeRevisar;
      for (const id of ['doc-aprobar', 'doc-rechazar', 'doc-reprocesar', 'doc-guardar-correccion']) {
        const boton = $(`#${id}`);
        boton.disabled = !puedeRevisar || boton.getAttribute('aria-busy') === 'true';
        boton.title = razonBloqueo;
        boton.setAttribute('aria-describedby', 'doc-bloqueo');
      }
      $('#doc-guardar-motivo').textContent = puedeRevisar ? 'Se habilita al cambiar algún dato.' : razonBloqueo;
      valoresInicialesDocumento = JSON.stringify(datosFormularioDocumento());
      actualizarEstadoGuardarCorreccion();
      actualizarNavegacionDocumento();
    }

    function consultaDocumentos() {
      const form = $('#form-filtro-documentos');
      const consulta = new URLSearchParams();
      ['q', 'tipo'].forEach((campo) => {
        const valor = form[campo].value.trim();
        if (valor) consulta.set(campo, valor);
      });
      if (archivadosDocumentos) consulta.set('archivados', 'true');
      else if (form.estado.value) consulta.set('estado', form.estado.value);
      consulta.set('pagina', paginaDocumentos);
      consulta.set('por_pagina', DOC_POR_PAGINA);
      return consulta;
    }

    function textoCoincidencia(doc) {
      if (!DOC_TIPOS_COMPARABLES.has(doc.tipo)) return { texto: 'No aplica', clase: 'doc-match doc-match--muted' };
      if (doc.coincide_viaje === null) return { texto: 'Sin datos', clase: 'doc-match doc-match--muted' };
      return doc.coincide_viaje
        ? { texto: 'Coincide', clase: 'doc-match doc-match--ok' }
        : { texto: 'No coincide', clase: 'doc-match doc-match--alert' };
    }

    function seleccionarDocumento(doc, marcado) {
      if (marcado) seleccionDocumentos.add(Number(doc.id));
      else seleccionDocumentos.delete(Number(doc.id));
      $('#doc-seleccionados').textContent = `${seleccionDocumentos.size} seleccionados (máximo 20)`;
    }

    function selectorDocumento(doc) {
      return el('input', {
        type: 'checkbox',
        'aria-label': `Seleccionar documento ${doc.folio} ${DOC_TIPOS[doc.tipo] || doc.tipo}`,
        checked: seleccionDocumentos.has(Number(doc.id)),
        onchange: (evento) => seleccionarDocumento(doc, evento.currentTarget.checked)
      });
    }

    async function reintentarDocumento(doc, boton) {
      boton.disabled = true;
      boton.setAttribute('aria-busy', 'true');
      try {
        await api(`/documentos/${doc.id}/reprocesar`, { method: 'POST' });
        await cargarDocumentos();
      } catch (error) {
        mostrarAviso(error.message);
      } finally {
        boton.removeAttribute('aria-busy');
        boton.disabled = false;
      }
    }

    async function archivarDocumento(doc) {
      const motivo = prompt(`Motivo obligatorio para archivar ${doc.folio} · ${DOC_TIPOS[doc.tipo] || doc.tipo}:`);
      if (motivo === null) return;
      if (!motivo.trim()) {
        mostrarAviso('Escribe un motivo para archivar.');
        return;
      }
      if (!confirm('El documento quedará oculto, pero se conservarán el registro, la foto y la bitácora. ¿Continuar?')) return;
      try {
        await api(`/documentos/${doc.id}/archivar`, { method: 'POST', body: { motivo: motivo.trim() } });
        seleccionarDocumento(doc, false);
        await cargarDocumentos();
        mostrarAviso('Documento archivado. Puedes restaurarlo desde la pestaña Archivados.');
      } catch (error) {
        mostrarAviso(error.message);
      }
    }

    async function restaurarDocumento(doc) {
      try {
        await api(`/documentos/${doc.id}/restaurar`, { method: 'POST' });
        await cargarDocumentos();
        mostrarAviso('Documento restaurado.');
      } catch (error) {
        mostrarAviso(error.message);
      }
    }

    function botonesDocumento(doc) {
      const botones = [
        el('button', { type: 'button', class: 'btn btn--accent btn--sm', onclick: () => abrirDocumento(doc.id) }, 'Revisar')
      ];
      if (doc.archivado_en) {
        botones.push(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => restaurarDocumento(doc) }, 'Restaurar'));
      } else if (['pendiente', 'rechazado'].includes(doc.estado)) {
        botones.push(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => archivarDocumento(doc) }, 'Archivar'));
      }
      if (doc.ocr_estado === 'error') {
        const propio = Number(doc.subido_por) === Number(usuarioActual()?.id);
        const motivo = doc.archivado_en ? 'Documento archivado.'
          : doc.estado !== 'pendiente' ? 'El documento ya fue revisado.'
            : propio ? 'Otro administrador debe revisar el documento.'
              : 'Reintenta la lectura OCR.';
        botones.push(el('div', { class: 'doc-reintento' },
          el('small', { class: 'doc-ocr-error', text: doc.ocr_error || 'Falló la lectura OCR.' }),
          el('button', {
            type: 'button',
            class: 'btn btn--ghost btn--sm',
            disabled: Boolean(doc.archivado_en) || doc.estado !== 'pendiente' || propio,
            title: motivo,
            'aria-describedby': 'doc-bloqueo',
            onclick: (evento) => reintentarDocumento(doc, evento.currentTarget)
          }, 'Reintentar lectura')));
      }
      return el('div', { class: 'doc-acciones' }, ...botones);
    }

    function miniaturaDocumento(doc, generacion) {
      const marco = el('div', { class: 'doc-card__media' },
        el('div', { class: 'doc-placeholder', text: 'Cargando imagen…' }));
      apiImagenDocumento(`/documentos/${doc.id}/archivo?m=1`).then((blob) => {
        const url = URL.createObjectURL(blob);
        if (!marco.isConnected || generacion !== generacionGaleria) {
          URL.revokeObjectURL(url);
          return;
        }
        miniaturasDocumentos.push(url);
        const imagen = el('img', {
          class: 'doc-card__imagen',
          alt: `Miniatura ${doc.folio} · ${DOC_TIPOS[doc.tipo] || doc.tipo}`,
          loading: 'lazy',
          src: url,
          onerror: () => {
            URL.revokeObjectURL(url);
            marco.replaceChildren(el('div', { class: 'doc-placeholder', role: 'status', text: 'Archivo no disponible' }));
          }
        });
        marco.replaceChildren(imagen);
      }).catch(() => {
        if (marco.isConnected && generacion === generacionGaleria) {
          marco.replaceChildren(el('div', { class: 'doc-placeholder', role: 'status', text: 'Archivo no disponible' }));
        }
      });
      return marco;
    }

    function renderizarDocumentoTabla(doc) {
      const estado = doc.archivado_en ? DOC_ESTADOS.archivado : DOC_ESTADOS[doc.estado] || DOC_ESTADOS.pendiente;
      const coincide = textoCoincidencia(doc);
      const ocr = DOC_OCR_ESTADOS[doc.ocr_estado] || DOC_OCR_ESTADOS.error;
      const fecha = new Date(doc.creado_en);
      const creado = Number.isNaN(fecha.getTime()) ? '—' : fmtFechaHora.format(fecha);
      return el('tr', {},
        el('td', {}, selectorDocumento(doc)),
        el('td', {}, el('b', { class: 'mono', text: doc.folio || 'Sin folio' }), el('small', { text: creado })),
        el('td', { text: DOC_TIPOS[doc.tipo] || doc.tipo || 'Sin clasificar' }),
        el('td', {}, el('span', { class: 'mono', text: doc.numero_guia || 'Guía no detectada' }), el('small', { class: coincide.clase, text: coincide.texto })),
        el('td', {}, el('span', { class: `st st--${estado.clase}`, text: estado.texto }),
          doc.estado === 'rechazado' && doc.nota_revision ? el('small', { class: 'doc-rechazo', text: doc.nota_revision }) : null),
        el('td', {}, el('span', { class: `st st--${ocr.clase}`, text: ocr.texto }),
          doc.ocr_estado === 'error' ? el('small', { class: 'doc-ocr-error', text: doc.ocr_error || 'Motivo no disponible' }) : null),
        el('td', {}, botonesDocumento(doc)));
    }

    function renderizarDocumentoTarjeta(doc, generacion) {
      const estado = doc.archivado_en ? DOC_ESTADOS.archivado : DOC_ESTADOS[doc.estado] || DOC_ESTADOS.pendiente;
      const ocr = DOC_OCR_ESTADOS[doc.ocr_estado] || DOC_OCR_ESTADOS.error;
      const coincide = textoCoincidencia(doc);
      return el('article', { class: 'doc-card' },
        miniaturaDocumento(doc, generacion),
        el('div', { class: 'doc-card__contenido' },
          el('div', { class: 'doc-card__titulo' },
            selectorDocumento(doc),
            el('b', { class: 'mono', text: doc.folio || 'Sin folio' }),
            el('span', { class: `st st--${estado.clase}`, text: estado.texto })),
          el('p', { text: DOC_TIPOS[doc.tipo] || doc.tipo || 'Sin clasificar' }),
          el('p', { class: 'mono muted', text: doc.numero_guia || 'Guía no detectada' }),
          el('span', { class: coincide.clase, text: coincide.texto }),
          el('span', { class: `st st--${ocr.clase}`, text: ocr.texto }),
          doc.ocr_estado === 'error' ? el('small', { class: 'doc-ocr-error', text: doc.ocr_error || 'Motivo no disponible' }) : null,
          doc.estado === 'rechazado' && doc.nota_revision ? el('small', { class: 'doc-rechazo', text: doc.nota_revision }) : null,
          botonesDocumento(doc)));
    }

    async function ejecutarLote(accion) {
      const ids = [...seleccionDocumentos];
      if (!ids.length) {
        mostrarAviso('Selecciona al menos un documento.');
        return;
      }
      if (ids.length > 20) {
        mostrarAviso('Puedes seleccionar como máximo 20 documentos por operación.');
        return;
      }
      let motivo;
      if (accion === 'archivar') {
        motivo = prompt('Motivo obligatorio para archivar los documentos seleccionados:');
        if (motivo === null) return;
        if (!motivo.trim()) {
          mostrarAviso('Escribe un motivo para archivar.');
          return;
        }
        if (!confirm(`Se archivarán hasta ${ids.length} documentos sin borrar fotos ni bitácoras. ¿Continuar?`)) return;
      }
      const boton = accion === 'archivar' ? $('#doc-lote-archivar') : $('#doc-lote-reintentar');
      boton.disabled = true;
      boton.setAttribute('aria-busy', 'true');
      try {
        const respuesta = await api('/documentos/lote', {
          method: 'POST',
          body: { accion, ids, motivo }
        });
        const resultados = respuesta.resultados.map((resultado) => {
          if (resultado.ok) seleccionDocumentos.delete(Number(resultado.id));
          return el('li', { class: resultado.ok ? 'doc-lote-ok' : 'doc-lote-error' },
            el('b', { text: `Documento ${resultado.id}` }),
            el('span', { text: resultado.message }));
        });
        $('#doc-lote-resultados').replaceChildren(...resultados);
        $('#doc-seleccionados').textContent = `${seleccionDocumentos.size} seleccionados (máximo 20)`;
        await cargarDocumentos();
      } catch (error) {
        mostrarAviso(error.message);
      } finally {
        boton.disabled = false;
        boton.removeAttribute('aria-busy');
      }
    }

    function actualizarTabsDocumentos() {
      const estado = archivadosDocumentos ? 'archivado' : $('#form-filtro-documentos').estado.value;
      $$('#doc-tabs [data-doc-estado]').forEach((boton) =>
        boton.setAttribute('aria-selected', String(boton.dataset.docEstado === estado)));
    }

    async function cargarDocumentos() {
      const consulta = consultaDocumentos();
      const respuesta = await api(`/documentos?${consulta}`);
      const conteo = respuesta.conteo;
      documentosVisibles = respuesta.documentos;
      $('#doc-pendientes').textContent = fmtNumero.format(conteo.pendiente || 0);
      actualizarBurbujaDocumentos(conteo.pendiente || 0);
      $('#doc-aprobados').textContent = fmtNumero.format(conteo.aprobado || 0);
      $('#doc-rechazados').textContent = fmtNumero.format(conteo.rechazado || 0);
      $('#doc-conteo-todos').textContent = fmtNumero.format((conteo.pendiente || 0) + (conteo.aprobado || 0) + (conteo.rechazado || 0));
      $('#doc-conteo-pendiente').textContent = fmtNumero.format(conteo.pendiente || 0);
      $('#doc-conteo-aprobado').textContent = fmtNumero.format(conteo.aprobado || 0);
      $('#doc-conteo-rechazado').textContent = fmtNumero.format(conteo.rechazado || 0);
      $('#doc-conteo-archivado').textContent = fmtNumero.format(conteo.archivado || 0);
      actualizarTabsDocumentos();
      $('#doc-total').textContent = `${fmtNumero.format(respuesta.total)} documento${respuesta.total === 1 ? '' : 's'}`;
      const hayOcrEnProceso = respuesta.documentos.some((doc) => doc.ocr_estado === 'procesando');
      miniaturasDocumentos.forEach((url) => URL.revokeObjectURL(url));
      miniaturasDocumentos = [];
      const generacion = ++generacionGaleria;
      let contenedor;
      if (vistaDocumentos === 'lista') {
        const tabla = el('table', { class: 'doc-tabla' },
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col', text: 'Elegir' }),
            el('th', { scope: 'col', text: 'Viaje / fecha' }),
            el('th', { scope: 'col', text: 'Tipo' }),
            el('th', { scope: 'col', text: 'Guía / coincidencia' }),
            el('th', { scope: 'col', text: 'Estado' }),
            el('th', { scope: 'col', text: 'OCR' }),
            el('th', { scope: 'col', text: 'Acciones' }))),
          el('tbody', {}, ...respuesta.documentos.map(renderizarDocumentoTabla)));
        contenedor = el('div', { class: 'doc-tabla-scroll' }, tabla);
      } else {
        contenedor = el('div', { class: 'doc-galeria doc-galeria--tarjetas' },
          ...respuesta.documentos.map((doc) => renderizarDocumentoTarjeta(doc, generacion)));
      }
      $('#galeria-documentos').replaceChildren(respuesta.documentos.length
        ? contenedor
        : el('p', { class: 'empty', text: 'No hay documentos con esos filtros.' }));
      $('#doc-pagina').textContent = `Página ${respuesta.pagina} de ${respuesta.paginas}`;
      $('#doc-anterior').disabled = respuesta.pagina <= 1;
      $('#doc-siguiente').disabled = respuesta.pagina >= respuesta.paginas;
      if (documentoActual?.ocr_estado === 'procesando') {
        const actualizado = respuesta.documentos.find((doc) => Number(doc.id) === Number(documentoActual.id));
        if (actualizado && actualizado.ocr_estado !== 'procesando') {
          actualizarDetalleDocumento(await api(`/documentos/${actualizado.id}`));
        }
      }
      if (hayOcrEnProceso) programarActualizacionOcr();
      else clearTimeout(temporizadorOcrDocumentos);
      actualizarNavegacionDocumento();
    }

    function actualizarBurbujaDocumentos(total) {
      const burbuja = $('#nav-documentos-pendientes');
      const pendientes = Math.max(0, Number(total) || 0);
      burbuja.textContent = pendientes > 99 ? '99+' : String(pendientes);
      burbuja.hidden = pendientes === 0;
      burbuja.setAttribute('aria-label', `${pendientes} documento${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'}`);
    }

    async function cargarConteoDocumentos() {
      const respuesta = await api('/documentos?por_pagina=4');
      actualizarBurbujaDocumentos(respuesta.conteo?.pendiente);
    }

    async function apiImagenDocumento(ruta) {
      const token = sesion.leer()?.token;
      const respuesta = await fetch(API_URL + ruta, {
        cache: 'no-store',
        headers: { ...(token && { Authorization: ['Bearer', token].join(' ') }) }
      });
      if (respuesta.status === 401 && token) {
        cerrarSesion();
      }
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}));
        throw Object.assign(new Error(datos.message || `Error ${respuesta.status}`), { status: respuesta.status });
      }
      return respuesta.blob();
    }

    function actualizarZoomImagen() {
      const imagen = $('#doc-imagen');
      const marco = $('#doc-imagen-marco');
      const maxX = Math.max(0, (imagen.offsetWidth * zoomImagenDocumento - marco.clientWidth) / 2);
      const maxY = Math.max(0, (imagen.offsetHeight * zoomImagenDocumento - marco.clientHeight) / 2);
      desplazamientoImagenDocumento.x = Math.max(-maxX, Math.min(maxX, desplazamientoImagenDocumento.x));
      desplazamientoImagenDocumento.y = Math.max(-maxY, Math.min(maxY, desplazamientoImagenDocumento.y));
      imagen.style.transform = `translate(${desplazamientoImagenDocumento.x}px, ${desplazamientoImagenDocumento.y}px) scale(${zoomImagenDocumento})`;
      $('#doc-zoom-nivel').textContent = `${Math.round(zoomImagenDocumento * 100)}%`;
      $('#doc-zoom-alejar').disabled = zoomImagenDocumento <= 1;
      $('#doc-zoom-acercar').disabled = zoomImagenDocumento >= 5;
      $('#doc-zoom-restablecer').disabled = zoomImagenDocumento === 1;
      marco.classList.toggle('doc-imagen-marco--ampliado', zoomImagenDocumento > 1);
    }

    function cambiarZoomImagen(incremento) {
      const nuevoZoom = Math.max(1, Math.min(5, Math.round((zoomImagenDocumento + incremento) * 100) / 100));
      if (nuevoZoom === zoomImagenDocumento) return;
      zoomImagenDocumento = nuevoZoom;
      if (zoomImagenDocumento === 1) desplazamientoImagenDocumento = { x: 0, y: 0 };
      actualizarZoomImagen();
    }

    function restablecerZoomImagen() {
      zoomImagenDocumento = 1;
      desplazamientoImagenDocumento = { x: 0, y: 0 };
      actualizarZoomImagen();
    }

    function detectarEsquinasDocumento(canvas) {
      const limite = 720;
      const escala = Math.min(1, limite / Math.max(canvas.width, canvas.height));
      const ancho = Math.max(1, Math.round(canvas.width * escala));
      const alto = Math.max(1, Math.round(canvas.height * escala));
      const analisis = document.createElement('canvas');
      analisis.width = ancho;
      analisis.height = alto;
      const contexto = analisis.getContext('2d', { willReadFrequently: true });
      contexto.drawImage(canvas, 0, 0, ancho, alto);
      const { data } = contexto.getImageData(0, 0, ancho, alto);
      const total = ancho * alto;
      const gris = new Uint8Array(total);
      const histograma = new Uint32Array(256);
      for (let i = 0; i < total; i++) {
        const indice = i * 4;
        const valor = Math.round(data[indice] * 0.299 + data[indice + 1] * 0.587 + data[indice + 2] * 0.114);
        gris[i] = valor;
        histograma[valor]++;
      }

      let sumaTotal = 0;
      for (let i = 0; i < 256; i++) sumaTotal += i * histograma[i];
      let sumaFondo = 0;
      let pesoFondo = 0;
      let mejorVarianza = 0;
      let umbral = 0;
      for (let i = 0; i < 256; i++) {
        pesoFondo += histograma[i];
        if (!pesoFondo) continue;
        const pesoObjeto = total - pesoFondo;
        if (!pesoObjeto) break;
        sumaFondo += i * histograma[i];
        const diferencia = sumaFondo / pesoFondo - (sumaTotal - sumaFondo) / pesoObjeto;
        const varianza = pesoFondo * pesoObjeto * diferencia * diferencia;
        if (varianza > mejorVarianza) {
          mejorVarianza = varianza;
          umbral = i;
        }
      }

      let mejorContorno = null;
      const ajustes = [0, -16, 16, -32, 32, -48, 48];
      for (const ajuste of ajustes) {
        const umbralActual = Math.max(0, Math.min(254, umbral + ajuste));
        const visitado = new Uint8Array(total);
        const cola = new Int32Array(total);
        let mayor = null;
        for (let inicio = 0; inicio < total; inicio++) {
          if (visitado[inicio] || gris[inicio] <= umbralActual) continue;
          let cabeza = 0;
          let colaFin = 0;
          cola[colaFin++] = inicio;
          visitado[inicio] = 1;
          let minimoSuma = Infinity;
          let maximoSuma = -Infinity;
          let minimoResta = Infinity;
          let maximoResta = -Infinity;
          let puntoMinimoSuma;
          let puntoMaximoSuma;
          let puntoMinimoResta;
          let puntoMaximoResta;
          let tocaBorde = false;
          while (cabeza < colaFin) {
            const indice = cola[cabeza++];
            const x = indice % ancho;
            const y = Math.floor(indice / ancho);
            if (x === 0 || y === 0 || x === ancho - 1 || y === alto - 1) tocaBorde = true;
            const suma = x + y;
            const resta = x - y;
            if (suma < minimoSuma) { minimoSuma = suma; puntoMinimoSuma = { x, y }; }
            if (suma > maximoSuma) { maximoSuma = suma; puntoMaximoSuma = { x, y }; }
            if (resta < minimoResta) { minimoResta = resta; puntoMinimoResta = { x, y }; }
            if (resta > maximoResta) { maximoResta = resta; puntoMaximoResta = { x, y }; }
            if (x > 0 && !visitado[indice - 1] && gris[indice - 1] > umbralActual) {
              visitado[indice - 1] = 1;
              cola[colaFin++] = indice - 1;
            }
            if (x + 1 < ancho && !visitado[indice + 1] && gris[indice + 1] > umbralActual) {
              visitado[indice + 1] = 1;
              cola[colaFin++] = indice + 1;
            }
            if (y > 0 && !visitado[indice - ancho] && gris[indice - ancho] > umbralActual) {
              visitado[indice - ancho] = 1;
              cola[colaFin++] = indice - ancho;
            }
            if (y + 1 < alto && !visitado[indice + ancho] && gris[indice + ancho] > umbralActual) {
              visitado[indice + ancho] = 1;
              cola[colaFin++] = indice + ancho;
            }
          }
          if (!tocaBorde && (!mayor || colaFin > mayor.area)) {
            mayor = { area: colaFin, puntoMinimoSuma, puntoMaximoSuma, puntoMinimoResta, puntoMaximoResta };
          }
        }

        if (!mayor || mayor.area < total * 0.12) continue;
        const puntos = [
          mayor.puntoMinimoSuma, mayor.puntoMaximoResta,
          mayor.puntoMaximoSuma, mayor.puntoMinimoResta
        ];
        let orientacion = 0;
        let valido = true;
        for (let i = 0; i < puntos.length; i++) {
          const a = puntos[i];
          const b = puntos[(i + 1) % puntos.length];
          const c = puntos[(i + 2) % puntos.length];
          const giro = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
          if (Math.abs(giro) < 1 || (orientacion && Math.sign(giro) !== orientacion)) {
            valido = false;
            break;
          }
          orientacion = Math.sign(giro);
        }
        if (!valido) continue;
        puntos.forEach((punto) => { punto.x /= escala; punto.y /= escala; });
        const area = Math.abs(puntos.reduce((suma, punto, i) => {
          const siguiente = puntos[(i + 1) % puntos.length];
          return suma + punto.x * siguiente.y - siguiente.x * punto.y;
        }, 0)) / 2;
        const proporcionArea = area / (canvas.width * canvas.height);
        if (proporcionArea < 0.1 || proporcionArea > 0.92) continue;
        const anchoHoja = Math.max(
          Math.hypot(puntos[1].x - puntos[0].x, puntos[1].y - puntos[0].y),
          Math.hypot(puntos[2].x - puntos[3].x, puntos[2].y - puntos[3].y)
        );
        const altoHoja = Math.max(
          Math.hypot(puntos[3].x - puntos[0].x, puntos[3].y - puntos[0].y),
          Math.hypot(puntos[2].x - puntos[1].x, puntos[2].y - puntos[1].y)
        );
        const proporcionLados = Math.min(anchoHoja, altoHoja) / Math.max(anchoHoja, altoHoja);
        if (proporcionLados < 0.32 || proporcionLados > 0.98) continue;
        if (!mejorContorno || area > mejorContorno.area) mejorContorno = { area, puntos };
      }
      return mejorContorno?.puntos || null;
    }

    function resolverHomografia(origen, destino) {
      const matriz = [];
      for (let i = 0; i < 4; i++) {
        const { x, y } = destino[i];
        const { x: u, y: v } = origen[i];
        matriz.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
        matriz.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
      }
      for (let columna = 0; columna < 8; columna++) {
        let pivote = columna;
        for (let fila = columna + 1; fila < 8; fila++) {
          if (Math.abs(matriz[fila][columna]) > Math.abs(matriz[pivote][columna])) pivote = fila;
        }
        if (Math.abs(matriz[pivote][columna]) < 1e-10) throw new Error('No se pudo corregir la perspectiva de la foto.');
        [matriz[columna], matriz[pivote]] = [matriz[pivote], matriz[columna]];
        const divisor = matriz[columna][columna];
        for (let j = columna; j <= 8; j++) matriz[columna][j] /= divisor;
        for (let fila = 0; fila < 8; fila++) {
          if (fila === columna) continue;
          const factor = matriz[fila][columna];
          for (let j = columna; j <= 8; j++) matriz[fila][j] -= factor * matriz[columna][j];
        }
      }
      return matriz.map((fila) => fila[8]);
    }

    function crearImagenEscaneada(imagen) {
      const maximo = 1800;
      const escala = Math.min(1, maximo / Math.max(imagen.naturalWidth, imagen.naturalHeight));
      const fuente = document.createElement('canvas');
      fuente.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
      fuente.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
      const contextoFuente = fuente.getContext('2d', { willReadFrequently: true });
      contextoFuente.drawImage(imagen, 0, 0, fuente.width, fuente.height);

      const esquinasDetectadas = detectarEsquinasDocumento(fuente);
      const origen = esquinasDetectadas || [
        { x: 0, y: 0 }, { x: fuente.width, y: 0 },
        { x: fuente.width, y: fuente.height }, { x: 0, y: fuente.height }
      ];
      const ancho = Math.max(
        Math.hypot(origen[1].x - origen[0].x, origen[1].y - origen[0].y),
        Math.hypot(origen[2].x - origen[3].x, origen[2].y - origen[3].y)
      );
      const alto = Math.max(
        Math.hypot(origen[3].x - origen[0].x, origen[3].y - origen[0].y),
        Math.hypot(origen[2].x - origen[1].x, origen[2].y - origen[1].y)
      );
      const salida = document.createElement('canvas');
      salida.width = Math.max(1, Math.round(ancho));
      salida.height = Math.max(1, Math.round(alto));
      const mapa = resolverHomografia(origen, [
        { x: 0, y: 0 }, { x: salida.width, y: 0 },
        { x: salida.width, y: salida.height }, { x: 0, y: salida.height }
      ]);
      const pixelesOrigen = contextoFuente.getImageData(0, 0, fuente.width, fuente.height).data;
      const contextoSalida = salida.getContext('2d', { willReadFrequently: true });
      const imagenSalida = contextoSalida.createImageData(salida.width, salida.height);
      const pixelesSalida = imagenSalida.data;
      for (let y = 0; y < salida.height; y++) {
        for (let x = 0; x < salida.width; x++) {
          const denominador = mapa[6] * x + mapa[7] * y + 1;
          const sx = (mapa[0] * x + mapa[1] * y + mapa[2]) / denominador;
          const sy = (mapa[3] * x + mapa[4] * y + mapa[5]) / denominador;
          const x0 = Math.max(0, Math.min(fuente.width - 1, Math.floor(sx)));
          const y0 = Math.max(0, Math.min(fuente.height - 1, Math.floor(sy)));
          const x1 = Math.min(fuente.width - 1, x0 + 1);
          const y1 = Math.min(fuente.height - 1, y0 + 1);
          const fx = Math.max(0, Math.min(1, sx - x0));
          const fy = Math.max(0, Math.min(1, sy - y0));
          const destino = (y * salida.width + x) * 4;
          for (let canal = 0; canal < 3; canal++) {
            const arriba = pixelesOrigen[(y0 * fuente.width + x0) * 4 + canal] * (1 - fx)
              + pixelesOrigen[(y0 * fuente.width + x1) * 4 + canal] * fx;
            const abajo = pixelesOrigen[(y1 * fuente.width + x0) * 4 + canal] * (1 - fx)
              + pixelesOrigen[(y1 * fuente.width + x1) * 4 + canal] * fx;
            pixelesSalida[destino + canal] = arriba * (1 - fy) + abajo * fy;
          }
          pixelesSalida[destino + 3] = 255;
        }
      }
      contextoSalida.putImageData(imagenSalida, 0, 0);

      const datos = contextoSalida.getImageData(0, 0, salida.width, salida.height);
      const niveles = new Uint32Array(256);
      for (let i = 0; i < datos.data.length; i += 4) {
        const gris = Math.round(datos.data[i] * 0.299 + datos.data[i + 1] * 0.587 + datos.data[i + 2] * 0.114);
        niveles[gris]++;
      }
      const cantidad = salida.width * salida.height;
      const percentil = (objetivo) => {
        let cuenta = 0;
        for (let i = 0; i < 256; i++) {
          cuenta += niveles[i];
          if (cuenta >= objetivo) return i;
        }
        return 255;
      };
      const negro = percentil(cantidad * 0.02);
      const blanco = Math.max(negro + 1, percentil(cantidad * 0.98));
      const rango = blanco - negro;
      for (let i = 0; i < datos.data.length; i += 4) {
        const gris = Math.round(datos.data[i] * 0.299 + datos.data[i + 1] * 0.587 + datos.data[i + 2] * 0.114);
        const valor = Math.max(0, Math.min(255, Math.round((gris - negro) * 255 / rango)));
        datos.data[i] = valor;
        datos.data[i + 1] = valor;
        datos.data[i + 2] = valor;
      }
      contextoSalida.putImageData(datos, 0, 0);
      return { canvas: salida, detectado: Boolean(esquinasDetectadas) };
    }

    async function imprimirImagenDocumento() {
      if (!urlImagenDocumento) {
        mostrarAviso('No hay una imagen disponible para imprimir.');
        return;
      }

      const boton = $('#doc-imprimir');
      boton.disabled = true;
      boton.setAttribute('aria-busy', 'true');
      let urlEscaneada;
      let marco;
      try {
        await new Promise((resolver) => requestAnimationFrame(resolver));
        const escaneo = crearImagenEscaneada($('#doc-imagen'));
        if (!escaneo.detectado) {
          mostrarAviso('No se detectaron los bordes de la hoja; se imprimirá la imagen completa con contraste mejorado.');
        }
        const blob = await new Promise((resolver, rechazar) => {
          escaneo.canvas.toBlob((resultado) => resultado ? resolver(resultado) : rechazar(new Error('No se pudo preparar la imagen para imprimir.')), 'image/jpeg', 0.94);
        });
        urlEscaneada = URL.createObjectURL(blob);
        marco = document.createElement('iframe');
        marco.title = 'Vista de impresión del comprobante escaneado';
        marco.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;bottom:0;border:0;opacity:0;';
        marco.onload = () => {
          const documento = marco.contentDocument;
          if (!documento) {
            URL.revokeObjectURL(urlEscaneada);
            marco.remove();
            mostrarAviso('No se pudo preparar la impresión del comprobante.');
            return;
          }

          const imagen = documento.createElement('img');
          imagen.alt = 'Comprobante escaneado';
          imagen.addEventListener('load', () => {
            const vertical = imagen.naturalHeight >= imagen.naturalWidth;
            const anchoPagina = vertical ? '186mm' : '273mm';
            const altoPagina = vertical ? '273mm' : '186mm';
            const estilo = documento.createElement('style');
            estilo.textContent = `
              @page { size: A4 ${vertical ? 'portrait' : 'landscape'}; margin: 12mm; }
              html, body { width: ${anchoPagina}; height: ${altoPagina}; margin: 0; }
              body { display: grid; place-items: center; }
              img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
            `;
            documento.head.replaceChildren(estilo);
            marco.contentWindow.addEventListener('afterprint', () => {
              URL.revokeObjectURL(urlEscaneada);
              marco.remove();
            }, { once: true });
            marco.contentWindow.focus();
            marco.contentWindow.print();
          }, { once: true });
          imagen.addEventListener('error', () => {
            URL.revokeObjectURL(urlEscaneada);
            marco.remove();
            mostrarAviso('No se pudo cargar la imagen procesada para imprimir.');
          }, { once: true });
          documento.title = `${$('#doc-titulo').textContent} · Trazzo`;
          documento.body.replaceChildren(imagen);
          imagen.src = urlEscaneada;
        };
        marco.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';
        document.body.append(marco);
      } catch (error) {
        if (urlEscaneada) URL.revokeObjectURL(urlEscaneada);
        if (marco) marco.remove();
        mostrarAviso(`No se pudo procesar la imagen para imprimir: ${error.message}`);
      } finally {
        boton.disabled = false;
        boton.removeAttribute('aria-busy');
      }
    }

    async function abrirDocumento(id) {
      try {
        const doc = await api(`/documentos/${id}`);
        let imagen = null;
        archivoDocumentoDisponible = true;
        try {
          imagen = await apiImagenDocumento(`/documentos/${id}/archivo`);
        } catch (error) {
          if (error.status !== 404) throw error;
          archivoDocumentoDisponible = false;
        }
        if (urlImagenDocumento) URL.revokeObjectURL(urlImagenDocumento);
        urlImagenDocumento = imagen ? URL.createObjectURL(imagen) : null;
        $('#doc-titulo').textContent = `${doc.folio || 'Documento'} · ${DOC_TIPOS[doc.tipo] || doc.tipo || 'Sin clasificar'}`;
        $('#doc-subtitulo').textContent = `Subido por ${doc.subio || '—'}`;
        $('#doc-imagen').hidden = !imagen;
        $('#doc-imagen-herramientas').hidden = !imagen;
        $('#doc-imagen-marco').hidden = !imagen;
        $('#doc-foto-no-disponible').hidden = Boolean(imagen);
        restablecerZoomImagen();
        if (imagen) $('#doc-imagen').src = urlImagenDocumento;
        $('#doc-nota').value = doc.nota_revision || '';
        actualizarDetalleDocumento(doc);
        $('#doc-datos').hidden = true;
        $('#doc-datos-lectura').hidden = true;
        $$('#dlg-documento [data-doc-panel-content]').forEach((panel) => { panel.hidden = panel.dataset.docPanelContent !== 'datos'; });
        $$('#dlg-documento [data-doc-panel]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.docPanel === 'datos')));
        $('#dlg-documento').showModal();
        cargarBitacoraDocumento().catch((error) => mostrarAviso(error.message));
      } catch (error) {
        mostrarAviso(error.message);
      }
    }

    async function revisarDocumento(estado, boton) {
      if (!documentoActual) return;
      const nota = $('#doc-nota').value.trim();
      if (estado === 'aprobado' && DOC_TIPOS_COMPARABLES.has(documentoActual.tipo) && documentoActual.coincide_viaje === false && !nota) {
        mostrarAviso('Justifica en una nota por qué apruebas un documento que no coincide con el viaje.');
        $('#doc-nota').focus();
        return;
      }
      if (estado === 'rechazado' && !nota) {
        mostrarAviso('Escribe el motivo del rechazo.');
        $('#doc-nota').focus();
        return;
      }
      boton.disabled = true;
      boton.setAttribute('aria-busy', 'true');
      try {
        const actualizado = await api(`/documentos/${documentoActual.id}/revision`, {
          method: 'PATCH',
          body: { estado, nota }
        });
        actualizarDetalleDocumento(actualizado);
        await cargarDocumentos();
        await cargarBitacoraDocumento();
        mostrarAviso(estado === 'aprobado' ? 'Documento aprobado.' : 'Documento rechazado.');
      } catch (error) {
        mostrarAviso(error.message);
      } finally {
        boton.removeAttribute('aria-busy');
        if (documentoActual) actualizarDetalleDocumento(documentoActual);
      }
    }

    async function optimizarImagen(archivo) {
      if (typeof createImageBitmap !== 'function') {
        throw new Error('Este navegador no puede optimizar la imagen. Actualízalo o toma una foto más pequeña.');
      }
      let imagen;
      try {
        imagen = await createImageBitmap(archivo);
      } catch (error) {
        throw new Error(`No se pudo preparar la imagen: ${error.message}`);
      }
      const escala = Math.min(1, 2400 / Math.max(imagen.width, imagen.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(imagen.width * escala));
      canvas.height = Math.max(1, Math.round(imagen.height * escala));
      const contexto = canvas.getContext('2d', { alpha: false });
      if (!contexto) {
        imagen.close();
        throw new Error('No se pudo preparar la imagen para subirla.');
      }
      contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
      imagen.close();
      const comprimida = await new Promise((resolver) => canvas.toBlob(resolver, 'image/jpeg', 0.92));
      if (!comprimida) throw new Error('El navegador no pudo comprimir la imagen.');
      return new File([comprimida], archivo.name.replace(/\.[^.]+$/, '.jpg'), {
        type: 'image/jpeg',
        lastModified: archivo.lastModified
      });
    }

    async function evaluarCalidadArchivo(archivo) {
      const imagen = await createImageBitmap(archivo);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const contexto = canvas.getContext('2d', { willReadFrequently: true });
        if (!contexto) throw new Error('Este navegador no permite analizar la foto.');
        contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
        const calidad = medirCalidadFotograma(canvas);
        if (!calidad) throw new Error('Este navegador no permite analizar la foto.');
        $('#doc-indicador-luz').textContent = `Iluminación: ${Math.round(calidad.brillo)} · ${calidad.luzBuena ? 'adecuada' : 'ajustar'}`;
        $('#doc-indicador-enfoque').textContent = `Enfoque: ${Math.round(calidad.enfoque)} · ${calidad.enfoqueBueno ? 'adecuado' : 'ajustar'}`;
        return calidad;
      } finally {
        imagen.close();
      }
    }

    async function subirDocumento(viajeId, archivo, boton, exigirCalidad = false) {
      if (!archivo) {
        mostrarAviso('Toma una foto o selecciona una imagen.');
        return;
      }
      boton.disabled = true;
      boton.setAttribute('aria-busy', 'true');
      const textoOriginal = boton.textContent;
      try {
        boton.textContent = 'Optimizando imagen…';
        const imagen = await optimizarImagen(archivo);
        if (imagen.size > 5 * 1024 * 1024) throw new Error('La imagen optimizada pesa más de 5 MB.');
        const calidad = await evaluarCalidadArchivo(imagen);
        const calidadAdecuada = calidad.luzBuena && calidad.enfoqueBueno;
        const observacionCalidad = `Luz ${Math.round(calidad.brillo)} · enfoque ${Math.round(calidad.enfoque)} · ${calidadAdecuada ? 'foto validada.' : 'revisa la legibilidad.'}`;
        $('#doc-calidad').textContent = observacionCalidad;
        if (!calidadAdecuada) {
          const ajustes = [
            !calidad.luzBuena && 'mejor iluminación',
            !calidad.enfoqueBueno && 'más enfoque'
          ].filter(Boolean).join(' y ');
          $('#doc-captura-motivo').textContent = `La foto podría ser difícil de leer; intenta ${ajustes}.`;
          if (exigirCalidad || !window.confirm(`La foto podría ser difícil de leer (${ajustes}). ¿Quieres subirla de todos modos?`)) {
            $('#doc-escaner-estado').textContent = exigirCalidad
              ? `Captura no enviada: ${ajustes}.`
              : 'Foto no enviada. Puedes elegir otra imagen o confirmar de nuevo para continuar.';
            return;
          }
        } else {
          $('#doc-captura-motivo').textContent = 'Foto validada: iluminación y enfoque adecuados.';
        }
        const datos = new FormData();
        datos.set('viaje_id', viajeId);
        datos.set('imagen', imagen, imagen.name);
        const token = sesion.leer()?.token;
        boton.textContent = 'Subiendo archivo…';
        $('#doc-escaner-estado').textContent = 'Enviando foto al servidor…';
        if (urlVistaPreviaDocumento) URL.revokeObjectURL(urlVistaPreviaDocumento);
        urlVistaPreviaDocumento = URL.createObjectURL(imagen);
        $('#doc-preview').src = urlVistaPreviaDocumento;
        $('#doc-preview').hidden = false;
        $('#doc-camara-apagada').hidden = true;
        $('#doc-video').hidden = true;
        const respuesta = await fetch(`${API_URL}/documentos`, {
          method: 'POST',
          headers: { ...(token && { Authorization: ['Bearer', token].join(' ') }) },
          body: datos
        });
        const resultado = await respuesta.json().catch(() => ({}));
        if (respuesta.status === 401 && token) cerrarSesion();
        if (!respuesta.ok) throw new Error(resultado.message || `Error ${respuesta.status}`);
        $('#doc-archivo-viaje').value = '';
        detenerCamaraDocumento();
        $('#doc-escaner-estado').textContent = 'Resultado: comprobante guardado. La lectura OCR está en proceso.';
        mostrarAviso(resultado.aviso_ocr || 'Comprobante guardado. El OCR se está procesando.');
        await refrescarDetalle();
      } catch (error) {
        $('#doc-archivo-viaje').value = '';
        $('#doc-escaner-estado').textContent = `Resultado: no se pudo enviar la foto. ${error.message}`;
        mostrarAviso(error.message);
      } finally {
        boton.textContent = textoOriginal;
        boton.disabled = boton.id === 'doc-capturar' && (!camaraDocumento || fotogramasBuenos < 3);
        boton.removeAttribute('aria-busy');
        $('#doc-archivo-viaje').value = '';
      }
    }

    async function guardarCorreccionDocumento(form, boton) {
      if (!documentoActual) return;
      boton.disabled = true;
      boton.setAttribute('aria-busy', 'true');
      try {
        const datos = Object.fromEntries(new FormData(form));
        datos.fecha = fechaDocumentoApi(String(datos.fecha || '').trim());
        const actualizado = await api(`/documentos/${documentoActual.id}`, {
          method: 'PATCH',
          body: datos
        });
        actualizarDetalleDocumento(actualizado);
        await Promise.all([cargarDocumentos(), cargarBitacoraDocumento()]);
        mostrarAviso('Corrección guardada y registrada en la bitácora.');
      } catch (error) {
        mostrarAviso(error.message);
      } finally {
        boton.removeAttribute('aria-busy');
        actualizarEstadoGuardarCorreccion();
      }
    }

    async function capturarFotogramaDocumento() {
      const video = $('#doc-video');
      if (!camaraDocumento || fotogramasBuenos < 3 || !video.videoWidth) return;
      const canvas = document.createElement('canvas');
      const escala = Math.min(1, 2400 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * escala);
      canvas.height = Math.round(video.videoHeight * escala);
      const contexto = canvas.getContext('2d', { alpha: false });
      contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imagen = await new Promise((resolver) => canvas.toBlob(resolver, 'image/jpeg', 0.92));
      if (!imagen) throw new Error('No se pudo capturar la imagen.');
      const archivo = new File([imagen], `comprobante-${Date.now()}.jpg`, { type: 'image/jpeg' });
      $('#doc-escaner-estado').textContent = 'Vista previa: foto capturada, preparando el envío…';
      await subirDocumento(viajeEscaner.id, archivo, $('#doc-capturar'), true);
    }

    function iniciarEscanerDocumento() {
      const seguro = window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
      $('#doc-abrir-camara').hidden = !seguro;
      $('#doc-calidad').textContent = seguro
        ? 'Asegura buena luz y enfoca el comprobante completo.'
        : 'La cámara en vivo requiere HTTPS o localhost. Puedes elegir una foto de galería.';
      $('#doc-escaner').hidden = false;
      $('#doc-escaner-estado').textContent = 'Cámara apagada. Abre la cámara o elige una foto para comenzar.';
      $('#doc-camara-apagada').hidden = false;
      $('#doc-video').hidden = true;
      $('#doc-preview').hidden = true;
      cargarAvisoPrivacidadOcr().catch((error) => {
        $('#doc-privacidad-escaner').textContent = `No se pudo consultar la configuración OCR: ${error.message}`;
      });
    }

    async function cargarAvisoPrivacidadOcr() {
      const motor = await api('/documentos/ocr-config');
      const aviso = motor.externo
        ? `El OCR usa ${motor.nombre}. La imagen se envía al proveedor externo para procesarse. Las identificaciones no conservan su texto OCR.`
        : `El OCR usa ${motor.nombre}; la imagen se procesa en este servidor. Las identificaciones no conservan su texto OCR.`;
      $('#doc-privacidad-escaner').textContent = aviso;
      $('#doc-aviso-privacidad').textContent = `El motor OCR configurado es ${motor.nombre}. ${motor.externo ? 'Las imágenes se envían a ese proveedor externo.' : 'Las imágenes se procesan localmente.'} En identificaciones no se almacena el texto OCR completo.`;
    }

    async function cargarBitacoraDocumento() {
      if (!documentoActual) return;
      const registros = await api(`/documentos/${documentoActual.id}/bitacora`);
      const agrupados = [];
      for (const registro of registros) {
        const anterior = agrupados[agrupados.length - 1];
        if (registro.accion === 'visto' && anterior?.registro.accion === 'visto'
            && anterior.registro.usuario === registro.usuario) {
          anterior.repeticiones++;
        } else {
          agrupados.push({ registro, repeticiones: 1 });
        }
      }
      const filas = agrupados.map(({ registro, repeticiones }) => {
        const fecha = new Date(registro.creado_en);
        const momento = Number.isNaN(fecha.getTime()) ? '—' : fmtFechaHora.format(fecha);
        return el('li', {},
          el('b', { text: `${registro.accion}${repeticiones > 1 ? ` ×${repeticiones}` : ''} · ${registro.usuario || 'Sistema'}` }),
          el('small', { text: `${momento}${registro.nota ? ` · ${registro.nota}` : ''}` }));
      });
      $('#doc-bitacora').replaceChildren(...(filas.length ? filas
        : [el('li', {}, el('small', { text: 'No hay movimientos registrados.' }))]));
    }

    function iniciarDocumentos() {
      const formFiltro = $('#form-filtro-documentos');
      const tipos = $('#doc-tipo');
      const tipoCorreccion = $('#doc-corr-tipo');
      Object.entries(DOC_TIPOS).forEach(([valor, texto]) => tipos.append(el('option', { value: valor, text: texto })));
      Object.entries(DOC_TIPOS).forEach(([valor, texto]) => tipoCorreccion.append(el('option', { value: valor, text: texto })));

      formFiltro.addEventListener('submit', (e) => {
        e.preventDefault();
        paginaDocumentos = 1;
        archivadosDocumentos = false;
        actualizarTabsDocumentos();
        cargarDocumentos().catch((error) => mostrarAviso(error.message));
      });
      formFiltro.addEventListener('reset', () => setTimeout(() => {
        paginaDocumentos = 1;
        archivadosDocumentos = false;
        actualizarTabsDocumentos();
        cargarDocumentos().catch((error) => mostrarAviso(error.message));
      }));
      $$('#doc-tabs [data-doc-estado]').forEach((boton) => boton.addEventListener('click', () => {
        archivadosDocumentos = boton.dataset.docEstado === 'archivado';
        formFiltro.estado.value = archivadosDocumentos ? '' : boton.dataset.docEstado;
        paginaDocumentos = 1;
        seleccionDocumentos.clear();
        actualizarTabsDocumentos();
        cargarDocumentos().catch((error) => mostrarAviso(error.message));
      }));
      $$('[data-doc-vista]').forEach((boton) => boton.addEventListener('click', () => {
        vistaDocumentos = boton.dataset.docVista;
        $$('[data-doc-vista]').forEach((elemento) => elemento.setAttribute('aria-pressed', String(elemento === boton)));
        cargarDocumentos().catch((error) => mostrarAviso(error.message));
      }));
      $('#doc-lote-archivar').addEventListener('click', () => ejecutarLote('archivar'));
      $('#doc-lote-reintentar').addEventListener('click', () => ejecutarLote('reintentar_ocr'));
      $('#doc-anterior').addEventListener('click', () => {
        paginaDocumentos = Math.max(1, paginaDocumentos - 1);
        cargarDocumentos().catch((error) => mostrarAviso(error.message));
      });
      $('#doc-siguiente').addEventListener('click', () => {
        paginaDocumentos += 1;
        cargarDocumentos().catch((error) => mostrarAviso(error.message));
      });
      $('#form-corregir-documento').addEventListener('submit', (e) => {
        e.preventDefault();
        guardarCorreccionDocumento(e.currentTarget, $('#doc-guardar-correccion'));
      });
      $('#form-corregir-documento').addEventListener('input', actualizarEstadoGuardarCorreccion);
      $('#form-corregir-documento').addEventListener('change', (evento) => {
        if (evento.target.id === 'doc-corr-tipo' && evento.target.value === 'identificacion') {
          $('#doc-corr-texto').value = '';
          $('#doc-corr-texto').closest('.f').hidden = true;
          for (const id of ['doc-corr-fecha', 'doc-corr-receptor', 'doc-corr-monto']) $(`#${id}`).value = '';
        }
        actualizarEstadoGuardarCorreccion();
      });
      $$('#dlg-documento [data-doc-panel]').forEach((boton) => boton.addEventListener('click', () => {
        const panelActivo = boton.dataset.docPanel;
        $$('#dlg-documento [data-doc-panel]').forEach((tab) =>
          tab.setAttribute('aria-selected', String(tab === boton)));
        $$('#dlg-documento [data-doc-panel-content]').forEach((panel) => {
          panel.hidden = panel.dataset.docPanelContent !== panelActivo;
        });
      }));
      $('#doc-copiar-ocr').addEventListener('click', async (e) => {
        try {
          await navigator.clipboard.writeText($('#doc-ocr').textContent);
          mostrarAviso('Texto OCR copiado.');
        } catch (error) {
          mostrarAviso(`No se pudo copiar el texto OCR: ${error.message}`);
        }
      });
      $('#doc-corr-fecha').addEventListener('input', (e) => {
        e.currentTarget.value = e.currentTarget.value.replace(/[^\d/]/g, '').slice(0, 10);
      });
      $('#doc-zoom-alejar').addEventListener('click', () => cambiarZoomImagen(-0.25));
      $('#doc-zoom-acercar').addEventListener('click', () => cambiarZoomImagen(0.25));
      $('#doc-zoom-restablecer').addEventListener('click', restablecerZoomImagen);
      $('#doc-imprimir').addEventListener('click', imprimirImagenDocumento);
      $('#doc-imagen-marco').addEventListener('wheel', (evento) => {
        evento.preventDefault();
        cambiarZoomImagen(evento.deltaY < 0 ? 0.25 : -0.25);
      }, { passive: false });
      $('#doc-imagen-marco').addEventListener('keydown', (evento) => {
        if (evento.key === '+' || evento.key === '=') {
          evento.preventDefault();
          cambiarZoomImagen(0.25);
        } else if (evento.key === '-') {
          evento.preventDefault();
          cambiarZoomImagen(-0.25);
        } else if (evento.key === '0') {
          evento.preventDefault();
          restablecerZoomImagen();
        }
      });
      $('#doc-imagen').addEventListener('pointerdown', (evento) => {
        if (zoomImagenDocumento <= 1 || evento.button !== 0) return;
        arrastreImagenDocumento = {
          x: evento.clientX,
          y: evento.clientY,
          desplazamientoX: desplazamientoImagenDocumento.x,
          desplazamientoY: desplazamientoImagenDocumento.y
        };
        evento.currentTarget.setPointerCapture(evento.pointerId);
      });
      $('#doc-imagen').addEventListener('pointermove', (evento) => {
        if (!arrastreImagenDocumento) return;
        desplazamientoImagenDocumento = {
          x: arrastreImagenDocumento.desplazamientoX + evento.clientX - arrastreImagenDocumento.x,
          y: arrastreImagenDocumento.desplazamientoY + evento.clientY - arrastreImagenDocumento.y
        };
        actualizarZoomImagen();
      });
      $('#doc-imagen').addEventListener('pointerup', () => { arrastreImagenDocumento = null; });
      $('#doc-imagen').addEventListener('pointercancel', () => { arrastreImagenDocumento = null; });
      $('#dv-escanear').addEventListener('click', iniciarEscanerDocumento);
      $('#doc-abrir-camara').addEventListener('click', async (e) => {
        const boton = e.currentTarget;
        boton.setAttribute('aria-busy', 'true');
        try { await abrirCamaraDocumento(); } finally { boton.removeAttribute('aria-busy'); }
      });
      $('#doc-capturar').addEventListener('click', (e) => {
        const boton = e.currentTarget;
        boton.disabled = true;
        capturarFotogramaDocumento()
          .catch((error) => mostrarAviso(error.message))
          .finally(() => { if (camaraDocumento) boton.disabled = fotogramasBuenos < 3; });
      });
      $('#doc-archivo-viaje').addEventListener('change', (e) => {
        const archivo = e.currentTarget.files[0];
        if (archivo && viajeEscaner) subirDocumento(viajeEscaner.id, archivo, $('#dv-escanear'));
      });
      $('#doc-cerrar-camara').addEventListener('click', cerrarEscanerDocumento);
      $('#doc-aprobar').addEventListener('click', (e) => revisarDocumento('aprobado', e.currentTarget));
      $('#doc-rechazar').addEventListener('click', (e) => revisarDocumento('rechazado', e.currentTarget));
      $('#doc-reprocesar').addEventListener('click', async (e) => {
        if (!documentoActual) return;
        const boton = e.currentTarget;
        boton.disabled = true;
        boton.setAttribute('aria-busy', 'true');
        try {
          const actualizado = await api(`/documentos/${documentoActual.id}/reprocesar`, { method: 'POST' });
          actualizarDetalleDocumento(actualizado);
          await cargarDocumentos();
          mostrarAviso('Documento en cola para reprocesar con OCR.');
        } catch (error) {
          mostrarAviso(error.message);
        } finally {
          boton.removeAttribute('aria-busy');
          if (documentoActual) actualizarDetalleDocumento(documentoActual);
        }
      });
      const confirmarCierreDocumento = () => {
        const cambios = JSON.stringify(datosFormularioDocumento()) !== valoresInicialesDocumento;
        if (cambios && !confirm('Hay cambios sin guardar. ¿Cerrar sin guardarlos?')) return;
        $('#dlg-documento').close();
      };
      $('#doc-cerrar').addEventListener('click', confirmarCierreDocumento);
      $('#dlg-documento').addEventListener('cancel', (evento) => {
        const cambios = JSON.stringify(datosFormularioDocumento()) !== valoresInicialesDocumento;
        if (cambios && !confirm('Hay cambios sin guardar. ¿Cerrar sin guardarlos?')) evento.preventDefault();
      });
      $('#doc-cargar-bitacora').addEventListener('click', (e) => {
        const boton = e.currentTarget;
        boton.disabled = true;
        boton.setAttribute('aria-busy', 'true');
        cargarBitacoraDocumento()
          .catch((error) => mostrarAviso(error.message))
          .finally(() => { boton.disabled = false; boton.removeAttribute('aria-busy'); });
      });
      $('#doc-anterior-pendiente').addEventListener('click', () => {
        const indice = documentosVisibles.findIndex((doc) => Number(doc.id) === Number(documentoActual?.id));
        const anterior = documentosVisibles.slice(0, indice).reverse().find((doc) =>
          doc.estado === 'pendiente' && !doc.archivado_en && Number(doc.subido_por) !== Number(usuarioActual()?.id));
        if (anterior) abrirDocumento(anterior.id);
      });
      $('#doc-siguiente-pendiente').addEventListener('click', () => {
        const indice = documentosVisibles.findIndex((doc) => Number(doc.id) === Number(documentoActual?.id));
        const siguiente = documentosVisibles.slice(indice + 1).find((doc) =>
          doc.estado === 'pendiente' && !doc.archivado_en && Number(doc.subido_por) !== Number(usuarioActual()?.id));
        if (siguiente) abrirDocumento(siguiente.id);
      });
      $('#dlg-documento').addEventListener('close', () => {
        if (urlImagenDocumento) URL.revokeObjectURL(urlImagenDocumento);
        urlImagenDocumento = null;
        $('#doc-imagen').removeAttribute('src');
        $('#doc-imagen').hidden = true;
        $('#doc-imagen-herramientas').hidden = true;
        $('#doc-imagen-marco').hidden = true;
        $('#doc-foto-no-disponible').hidden = true;
        restablecerZoomImagen();
        arrastreImagenDocumento = null;
        documentoActual = null;
        valoresInicialesDocumento = '';
        $('#doc-bitacora').replaceChildren(el('li', {}, el('small', { text: 'Selecciona Actualizar para consultar la bitácora.' })));
      });
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
      window.addEventListener('online', () => {
        mostrarAviso('Conexión recuperada. Actualizando datos…');
        cargarSeccion({ silencioso: true });
      });
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
      iniciarMapaUnidades();
      iniciarLogin();
      iniciarFormRuta();
      iniciarAsignacion();
      iniciarPersonal();
      iniciarHistorial();
      iniciarDocumentos();
      iniciarFlota();
      iniciarTrafico();
      iniciarPanico();
      iniciarDetalle();
      iniciarInstalacion();
      iniciarAvisoConexion();
      iniciarCola();
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
  