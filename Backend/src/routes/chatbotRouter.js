import { Router } from 'express';
import { verificarToken } from '../middlewares/auth.js';
import { chat } from '../controllers/chatbotController.js';

const router = Router();

router.use(verificarToken);
router.post('/', chat);

export default router;
