import jwt from 'jsonwebtoken';

// Exige un token válido en el encabezado: Authorization: Bearer <token>
export const verificarToken = (req, res, next) => {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Inicia sesión para continuar' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Tu sesión expiró, vuelve a iniciar sesión' });
  }
};

// Solo deja pasar a los roles indicados, por ejemplo: permitir('admin')
export const permitir = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario?.rol)) {
    return res.status(403).json({ message: 'No tienes permiso para esta acción' });
  }
  next();
};
