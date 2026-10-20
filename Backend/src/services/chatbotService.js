import * as viajeModel from '../models/viajeModel.js';
import * as flotaModel from '../models/flotaModel.js';

const ROLES = {
  admin: 'admin',
  capturista: 'capturista',
  operador: 'operador',
  cliente: 'cliente',
};

function extraerFolio(texto = '') {
  const m = texto.match(/\b(TRZ-\d{4})\b/i);
  return m ? m[1].toUpperCase() : null;
}

function normalizar(texto = '') {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function puedeModificar(usuario) {
  return usuario.rol === ROLES.admin || usuario.rol === ROLES.capturista || usuario.rol === ROLES.operador;
}

function formatearDinero(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(v);
}

function estadoTexto(e) {
  const mapa = {
    pendiente: 'Pendiente',
    asignado: 'Asignado',
    en_ruta: 'En ruta',
    retraso: 'Retraso',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };
  return mapa[e] || e || '—';
}

function rolNombre(r) {
  const m = { admin: 'Administrador', capturista: 'Capturista', operador: 'Operador', cliente: 'Cliente' };
  return m[r] || r;
}

async function buscarViajePorFolio(folio) {
  const v = await viajeModel.buscarPorFolio(folio);
  if (v) return v;
  // fallback: buscar en listado activo
  const todos = await viajeModel.listar({});
  return todos.find((x) => x.folio === folio) || null;
}

function lineaViaje(v) {
  return `• ${v.folio}: ${v.origen} → ${v.destino} · ${estadoTexto(v.estado)} · ${v.operador || 'Sin operador'}`;
}

export async function responder({ usuario, mensajes }) {
  const ultimo = mensajes.filter((m) => m.rol === 'usuario').pop()?.texto || '';
  const texto = normalizar(ultimo);
  let respuesta = '';
  let propuestas = [];

  // 1) ¿Qué viajes van con retraso?
  if (texto.includes('retraso') && (texto.includes('viaje') || texto.includes('van') || texto.includes('hay') || texto.includes('que'))) {
    const viajes = await viajeModel.listar({ estados: ['retraso'] });
    if (!viajes.length) {
      respuesta = 'No hay viajes en estado de retraso.';
    } else {
      respuesta = `Viajes con retraso (${viajes.length}):\n${viajes.map(lineaViaje).join('\n')}`;
    }
    return { respuesta, propuestas };
  }

  // 2) Viajes pendientes (por asignar)
  if ((texto.includes('pendiente') && (texto.includes('viaje') || texto.includes('asignar'))) || texto.includes('por asignar')) {
    const viajes = await viajeModel.listar({ estados: ['pendiente'] });
    if (!viajes.length) {
      respuesta = 'No hay viajes pendientes por asignar.';
    } else {
      respuesta = `Viajes pendientes por asignar (${viajes.length}):\n${viajes.map(lineaViaje).join('\n')}`;
    }
    return { respuesta, propuestas };
  }

  // 3) Mis viajes / viaje actual (operador)
  if ((texto.includes('mi viaje') || texto.includes('mis viaje')) && usuario.rol === ROLES.operador) {
    const viajes = await viajeModel.listar({ operadorId: usuario.id });
    const activos = viajes.filter((v) => ['asignado', 'en_ruta', 'retraso'].includes(v.estado));
    if (!activos.length) {
      respuesta = 'No tienes viajes activos ahora.';
      if (viajes.length) respuesta += `\n\nHistorial reciente: ${viajes.slice(0, 5).map((v) => `${v.folio} (${estadoTexto(v.estado)})`).join(', ')}`;
    } else {
      respuesta = `Tu viaje actual${activos.length > 1 ? 'es' : ''}:\n${activos.map(lineaViaje).join('\n')}`;
    }
    return { respuesta, propuestas };
  }

  // 4) Resumen de operación de hoy
  if (texto.includes('resumen') && (texto.includes('hoy') || texto.includes('operacion') || texto.includes('operación'))) {
    const resumen = await viajeModel.resumen();
    respuesta = `Resumen de operación:

• Viajes activos: ${resumen.activos || 0}
• Pendientes por asignar: ${resumen.por_asignar || 0}
• Entregados hoy: ${resumen.entregas_hoy || 0}
• Retrasos: ${resumen.retrasos || 0}
• Flete del mes (MXN): ${formatearDinero(resumen.flete_mes)}`;
    if (resumen.flota) {
      respuesta += `\n\nFlota: ${resumen.flota.disponible || 0} disponibles, ${resumen.flota.en_ruta || 0} en ruta, ${resumen.flota.taller || 0} en taller`;
    }
    return { respuesta, propuestas };
  }

  // 5) Iniciar viaje (en_ruta)
  if ((texto.includes('iniciar') || texto.includes('salir') || texto.includes('poner en ruta')) && puedeModificar(usuario)) {
    const folio = extraerFolio(ultimo);
    if (!folio) {
      respuesta = 'Dime qué viaje quieres iniciar. Escribe el folio, por ejemplo: "Iniciar viaje TRZ-0142".';
      return { respuesta, propuestas };
    }
    const v = await buscarViajePorFolio(folio);
    if (!v) {
      respuesta = `No encontré el viaje ${folio}.`;
      return { respuesta, propuestas };
    }
    if (v.estado === 'en_ruta') {
      respuesta = `${folio} ya está en ruta.`;
      return { respuesta, propuestas };
    }
    if (v.estado !== 'asignado') {
      respuesta = `Solo puedo iniciar viajes asignados. El estado de ${folio} es ${estadoTexto(v.estado)}.`;
      return { respuesta, propuestas };
    }
    propuestas.push({
      tipo: 'estado',
      titulo: `Iniciar viaje ${folio}`,
      detalle: [`Folio: ${folio}`, `Ruta: ${v.origen} → ${v.destino}`, `Nuevo estado: En ruta`],
      datos: { viaje_id: v.id, estado: 'en_ruta', nota: null },
    });
    respuesta = `Voy a marcar ${folio} como **En ruta**. Pulsa Confirmar para aplicarlo.`;
    return { respuesta, propuestas };
  }

  // 6) Entregar viaje
  if ((texto.includes('entregar') || texto.includes('finalizar')) && puedeModificar(usuario)) {
    const folio = extraerFolio(ultimo);
    if (!folio) {
      respuesta = 'Dime qué viaje quieres entregar. Ej.: "Entregar viaje TRZ-0142".';
      return { respuesta, propuestas };
    }
    const v = await buscarViajePorFolio(folio);
    if (!v) {
      respuesta = `No encontré el viaje ${folio}.`;
      return { respuesta, propuestas };
    }
    if (v.estado === 'entregado') {
      respuesta = `${folio} ya está entregado.`;
      return { respuesta, propuestas };
    }
    if (!['en_ruta', 'retraso'].includes(v.estado)) {
      respuesta = `Solo puedo entregar viajes en ruta o con retraso. Estado actual: ${estadoTexto(v.estado)}.`;
      return { respuesta, propuestas };
    }
    propuestas.push({
      tipo: 'estado',
      titulo: `Entregar viaje ${folio}`,
      detalle: [`Folio: ${folio}`, `Ruta: ${v.origen} → ${v.destino}`, `Nuevo estado: Entregado`],
      datos: { viaje_id: v.id, estado: 'entregado', nota: null },
    });
    respuesta = `Voy a marcar ${folio} como **Entregado**. Confírmalo.`;
    return { respuesta, propuestas };
  }

  // 7) Marcar retraso (con nota opcional)
  if (texto.includes('retraso') && (texto.includes('reportar') || texto.includes('marcar')) && puedeModificar(usuario)) {
    const folio = extraerFolio(ultimo);
    const notaMatch = ultimo.match(/por\s+(.+)$/i) || ultimo.match(/motivo[:\s]+(.+)$/i);
    const nota = notaMatch ? notaMatch[1].trim().slice(0, 150) : 'Reportado desde chatbot';
    if (!folio) {
      respuesta = 'Dime en qué viaje quieres reportar un retraso. Ej.: "Reportar retraso en TRZ-0142 por tráfico".';
      return { respuesta, propuestas };
    }
    const v = await buscarViajePorFolio(folio);
    if (!v) {
      respuesta = `No encontré el viaje ${folio}.`;
      return { respuesta, propuestas };
    }
    if (v.estado === 'retraso') {
      respuesta = `${folio} ya está en retraso.`;
      return { respuesta, propuestas };
    }
    if (!['asignado', 'en_ruta'].includes(v.estado)) {
      respuesta = `No puedo marcar retraso desde el estado ${estadoTexto(v.estado)}.`;
      return { respuesta, propuestas };
    }
    propuestas.push({
      tipo: 'estado',
      titulo: `Reportar retraso en ${folio}`,
      detalle: [`Folio: ${folio}`, `Ruta: ${v.origen} → ${v.destino}`, `Nota: ${nota}`, `Nuevo estado: Retraso`],
      datos: { viaje_id: v.id, estado: 'retraso', nota },
    });
    respuesta = `Reportaré retraso en ${folio}. Pulsa Confirmar.`;
    return { respuesta, propuestas };
  }

  // 8) Asignar viaje (pendiente) -> propone elegir operador y unidad libres
  if ((texto.includes('asignar') || texto.includes('asigna')) && (usuario.rol === ROLES.admin || usuario.rol === ROLES.capturista)) {
    const folio = extraerFolio(ultimo);
    if (!folio) {
      respuesta = '¿Qué viaje quieres asignar? Ej.: "Asignar TRZ-0142".';
      return { respuesta, propuestas };
    }
    const v = await buscarViajePorFolio(folio);
    if (!v) {
      respuesta = `No encontré el viaje ${folio}.`;
      return { respuesta, propuestas };
    }
    if (v.estado !== 'pendiente') {
      respuesta = `Solo se asignan viajes pendientes. ${folio} está en ${estadoTexto(v.estado)}.`;
      return { respuesta, propuestas };
    }
    const operadores = await flotaModel.listarOperadores();
    const libres = operadores.filter((o) => !o.viaje_activo);
    const unidades = await flotaModel.listarUnidades();
    const disponibles = unidades.filter((u) => u.estado === 'disponible' && (!v.peso_kg || u.capacidad_kg >= v.peso_kg));
    if (!libres.length) {
      respuesta = 'No hay operadores libres para asignar ahora.';
      return { respuesta, propuestas };
    }
    if (!disponibles.length) {
      respuesta = 'No hay unidades disponibles con capacidad suficiente.';
      return { respuesta, propuestas };
    }
    // Sugiere el primero libre + primera unidad válida
    const op = libres[0];
    const un = disponibles[0];
    propuestas.push({
      tipo: 'asignar',
      titulo: `Asignar ${folio}`,
      detalle: [
        `Folio: ${folio}`,
        `Ruta: ${v.origen} → ${v.destino}`,
        `Operador sugerido: ${op.nombre}`,
        `Unidad sugerida: ${un.placas} · ${un.marca_modelo} · ${un.capacidad_kg} kg`,
      ],
      datos: { viaje_id: v.id, operador_id: op.id, unidad_id: un.id },
    });
    respuesta = `Propongo asignar ${folio} a ${op.nombre} con la unidad ${un.placas}. Pulsa Confirmar para asignarlo.`;
    return { respuesta, propuestas };
  }

  // 9) Ayuda / comandos
  if (texto.includes('ayuda') || texto.includes('comando') || texto.includes('que puedes') || texto.includes('help')) {
    respuesta = `Puedo ayudarte con la gestión de viajes (sin coste).

Comandos útiles:
• "¿Qué viajes van con retraso?"
• "Viajes pendientes por asignar"
• "Mis viajes" (si eres operador)
• "Resumen de operación de hoy"
• "Iniciar viaje TRZ-0142"
• "Entregar viaje TRZ-0142"
• "Reportar retraso en TRZ-0142 por tráfico"
• "Asignar TRZ-0142" (admin/capturista)`;
    return { respuesta, propuestas };
  }

  // 10) Por defecto
  respuesta = `No entendí eso. Escribe "ayuda" para ver comandos disponibles.`;
  return { respuesta, propuestas };
}
