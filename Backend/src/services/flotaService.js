import * as flotaModel from '../models/flotaModel.js';
import { HttpError } from '../utils/httpError.js';

const PLACAS_VALIDAS = /^[A-Z0-9]{2,4}-[A-Z0-9]{2,4}(-[A-Z0-9]{1,4})?$/; // PUE-45-8K, ABC-1234
const COLUMNAS = ['placas', 'marca_modelo', 'anio', 'capacidad_kg', 'poliza'];

// Valida y normaliza; con parcial = true solo revisa los campos que vienen (para editar)
function validar(datos = {}, parcial = false) {
  const limpio = {};
  const viene = (campo) => !parcial || datos[campo] !== undefined;

  if (viene('placas')) {
    limpio.placas = String(datos.placas ?? '').trim().toUpperCase().replace(/\s+/g, '-');
    if (!PLACAS_VALIDAS.test(limpio.placas)) throw new HttpError(400, 'Placas no válidas. Ejemplo: PUE-45-8K');
  }
  if (viene('marca_modelo')) {
    limpio.marca_modelo = String(datos.marca_modelo ?? '').trim();
    if (limpio.marca_modelo.length < 2) throw new HttpError(400, 'Escribe la marca y el modelo');
  }
  if (viene('anio')) {
    limpio.anio = Number(datos.anio);
    const maximo = new Date().getFullYear() + 1;
    if (!Number.isInteger(limpio.anio) || limpio.anio < 1980 || limpio.anio > maximo) {
      throw new HttpError(400, `El año debe estar entre 1980 y ${maximo}`);
    }
  }
  if (viene('capacidad_kg')) {
    limpio.capacidad_kg = Number(datos.capacidad_kg);
    if (!Number.isInteger(limpio.capacidad_kg) || limpio.capacidad_kg < 500 || limpio.capacidad_kg > 80000) {
      throw new HttpError(400, 'La capacidad debe estar entre 500 y 80,000 kg');
    }
  }
  if (viene('poliza')) limpio.poliza = String(datos.poliza ?? '').trim().toUpperCase() || null;
  return limpio;
}

const traducirDuplicado = (error) => {
  if (error.code === 'ER_DUP_ENTRY') return new HttpError(409, 'Ya existe una unidad con esas placas');
  return error;
};

export const listar = () => flotaModel.listarUnidades();

export async function crear(datos) {
  try {
    const id = await flotaModel.crearUnidad(validar(datos));
    return await flotaModel.buscarUnidad(id);
  } catch (error) {
    throw traducirDuplicado(error);
  }
}

export async function actualizar(id, datos = {}) {
  const unidad = await flotaModel.buscarUnidad(id);
  if (!unidad) throw new HttpError(404, 'La unidad no existe');

  const campos = validar(Object.fromEntries(COLUMNAS.filter((c) => c in datos).map((c) => [c, datos[c]])), true);

  // El estado "en_ruta" lo manejan los viajes; a mano solo se alterna entre disponible y taller
  if (datos.estado !== undefined) {
    if (!['disponible', 'taller'].includes(datos.estado)) throw new HttpError(400, 'El estado solo puede ser disponible o taller');
    if (unidad.viaje_activo) {
      throw new HttpError(409, `La unidad está ocupada en el viaje ${unidad.viaje_activo}; espera a que termine o reasígnalo`);
    }
    campos.estado = datos.estado;
  }

  try {
    await flotaModel.actualizarUnidad(id, campos);
  } catch (error) {
    throw traducirDuplicado(error);
  }
  return await flotaModel.buscarUnidad(id);
}
