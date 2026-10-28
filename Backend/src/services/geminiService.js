// Conexión con Google Gemini (SDK oficial @google/genai). La usan el asistente del chat y la IA del rastreo
// cuando IA_PROVEEDOR=gemini (o cuando solo hay GEMINI_API_KEY). Las herramientas, instrucciones y
// propuestas son las mismas que con Claude: aquí solo se traduce al formato de Gemini.
// Plan gratuito: Google puede usar lo que se envía para mejorar sus productos; no mandes datos sensibles.
import { GoogleGenAI, ApiError } from '@google/genai';
import { HttpError } from '../utils/httpError.js';

// gemini-3.5-flash-lite: rápido (≈1 s), con plan gratis y llamadas a funciones. Se cambia con GEMINI_MODEL.
export const MODELO_GEMINI = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
// En el plan gratis Gemini puede tardar 10-20 s o responder «saturado» (503): se reintenta hasta 3 veces
// y, si aun así tarda más de 45 s, se responde con el chatbot sin coste
const ESPERA_MAXIMA_MS = 45000;
const REINTENTOS = { attempts: 3, initialDelay: 1, maxDelay: 4 };

let cliente = null;
// Permite inyectar un cliente simulado en las pruebas
export const usarClienteGemini = (otro) => { cliente = otro; };
export const geminiDisponible = () => Boolean(cliente || process.env.GEMINI_API_KEY?.trim());

function obtenerCliente() {
  if (cliente) return cliente;
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new HttpError(503, 'Gemini no está configurado: agrega GEMINI_API_KEY en Backend/.env y reinicia el servidor.');
  }
  cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim(), httpOptions: { timeout: ESPERA_MAXIMA_MS, retryOptions: REINTENTOS } });
  return cliente;
}

// 503 = la IA no está disponible: el chat de la app pasa solo al chatbot sin coste
export function traducirErrorGemini(error) {
  if (error instanceof HttpError) return error;
  // ApiError del SDK (también si llega de su otra versión, CommonJS/ES, donde instanceof no coincide)
  if (error instanceof ApiError || typeof error?.status === 'number') {
    console.error('Gemini · error:', error.status, error.message);
    if (error.status === 429) return new HttpError(503, 'Se alcanzó el límite gratuito de Gemini (por minuto o por día).');
    if ([400, 401, 403].includes(error.status) && /api[ _-]?key/i.test(error.message)) {
      return new HttpError(503, 'La clave GEMINI_API_KEY no es válida. Revísala en Backend/.env.');
    }
    if (error.status === 404) return new HttpError(503, `El modelo ${MODELO_GEMINI} no está disponible para tu clave. Cambia GEMINI_MODEL en Backend/.env.`);
    if (error.status >= 500) return new HttpError(503, 'El servicio de Gemini no responde. Intenta en un momento.');
    return new HttpError(502, `Gemini respondió con un error (${error.status}).`);
  }
  if (['AbortError', 'TimeoutError'].includes(error?.name)) {
    console.error(`Gemini · ${MODELO_GEMINI} no respondió en ${ESPERA_MAXIMA_MS / 1000} s`);
    return new HttpError(503, `Gemini (${MODELO_GEMINI}) tardó demasiado en responder.`);
  }
  if (error instanceof TypeError) return new HttpError(503, 'No hay conexión con Gemini.');
  return error;
}

// historial: [{ role: 'user' | 'assistant', content: texto }] (el mismo formato que usa Claude)
const aContenidos = (historial) => historial.map((m) => ({
  role: m.role === 'assistant' ? 'model' : 'user',
  parts: [{ text: m.content }]
}));

async function generar(contents, config) {
  try {
    return await obtenerCliente().models.generateContent({ model: MODELO_GEMINI, contents, config });
  } catch (error) {
    throw traducirErrorGemini(error);
  }
}

// Conversación con herramientas: Gemini pide funciones, el backend las ejecuta (ejecutar) y le devuelve los
// resultados, hasta que responde con texto. Devuelve { texto } o { bloqueado } / { agotado }.
export async function conversarConHerramientas({ system, historial, herramientas, ejecutar, maxVueltas }) {
  const contents = aContenidos(historial);
  const config = {
    systemInstruction: system,
    tools: [{
      functionDeclarations: herramientas.map((h) => ({
        name: h.name,
        description: h.description,
        parametersJsonSchema: h.input_schema
      }))
    }]
  };

  for (let vuelta = 0; vuelta < maxVueltas; vuelta++) {
    const respuesta = await generar(contents, config);
    const contenido = respuesta.candidates?.[0]?.content;
    if (!contenido?.parts?.length) return { bloqueado: true }; // filtros de seguridad o respuesta vacía

    // El turno del modelo se reenvía tal cual: conserva las firmas de razonamiento (thoughtSignature)
    contents.push(contenido);
    const llamadas = respuesta.functionCalls ?? [];
    if (!llamadas.length) return { texto: respuesta.text?.trim() || '' };

    // Todas las funciones de esta vuelta se responden juntas en un solo mensaje
    const partes = await Promise.all(llamadas.map(async (llamada) => {
      let response;
      try {
        response = { result: await ejecutar(llamada.name, llamada.args ?? {}) };
      } catch (error) {
        response = { error: error.message };
      }
      return { functionResponse: { id: llamada.id, name: llamada.name, response } };
    }));
    contents.push({ role: 'user', parts: partes });
  }
  return { agotado: true };
}

// Una sola respuesta de texto, sin herramientas (IA de la página de rastreo)
export async function responderTexto({ system, historial, maxTokens = 2048 }) {
  const respuesta = await generar(aContenidos(historial), { systemInstruction: system, maxOutputTokens: maxTokens });
  if (!respuesta.candidates?.[0]?.content?.parts?.length) return { bloqueado: true };
  return { texto: respuesta.text?.trim() || '' };
}
