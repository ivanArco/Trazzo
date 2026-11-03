// Ruta inexistente: va después de todas las rutas y de los archivos estáticos
export const rutaNoEncontrada = (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
};

// Express entrega aquí todo error que lance una ruta. Los HttpError se responden tal cual; lo demás se registra
export const manejarErrores = (error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo de la petición no es JSON válido' });
  }
  if (error.status) return res.status(error.status).json({ message: error.message });

  console.error(error);
  res.status(500).json({ message: 'Error interno del servidor' });
};
