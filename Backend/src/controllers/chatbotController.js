import { responder } from '../services/chatbotService.js';

export async function chat(req, res, next) {
  try {
    const { mensajes } = req.body;
    if (!Array.isArray(mensajes)) {
      return res.status(400).json({ message: 'mensajes debe ser an array' });
    }
    const resultado = await responder({ usuario: req.usuario, mensajes });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
}
