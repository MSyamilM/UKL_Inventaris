import { Router } from 'express';
import { register, login } from '../controllers/userController';
import { authenticateAndAuthorize } from '../middlewares/authentication';

const router = Router();

router.post('/register', authenticateAndAuthorize(['ADMIN']), register);

router.post('/login', login);

export default router;
