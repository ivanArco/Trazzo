import { $ } from './modules/dom.js';

// Aquí va toda la lógica de inicialización que estaba al final de index.html
// Por ahora solo marcamos que cargó; la lógica completa sigue funcionando
// si el resto del JS se carga desde el HTML original? No.
// Mejor importar y llamar las funciones que ya están definidas globalmente
// ya que gran parte sigue inline en el HTML original? 

console.log('Trazzo modular cargado');

// El JS original sigue estando en memoria si se carga? 
// En nuestro shell NO cargamos el <script> gigante.
// Necesitamos pasar TODO ese JS inline al archivo init.js o módulos.

export function init() {
  // Por ahora, recargamos el comportamiento delegando
  // Lo ideal es migrar poco a poco
}
