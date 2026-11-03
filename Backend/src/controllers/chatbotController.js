import { responder } from '../services/ia/chatbotService.js';

export const chat = async (req, res) => {
  const { mensajes } = req.body;
  if (!Array.isArray(mensajes)) {
    return res.status(400).json({ message: 'mensajes debe ser an array' });
  }
  res.json(await responder({ usuario: req.usuario, mensajes }));
};
