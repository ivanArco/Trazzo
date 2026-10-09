import { Router } from 'express';
import { getUsers, createUser } from '../controllers/userController.js';
import { verificarToken, permitir } from '../middlewares/auth.js';

const router = Router();

// Solo el administrador gestiona el personal (ver tabla de permisos por rol)
router.use(verificarToken, permitir('admin'));

router.get('/', getUsers);     // GET  /api/users
router.post('/', createUser);  // POST /api/users

export default router;
