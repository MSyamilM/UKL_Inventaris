import { Router } from 'express';
import { addItem, updateItem, getItem, borrowAnalysis, usageReport } from '../controllers/itemController';
import { authenticateAndAuthorize } from '../middlewares/authentication';
import { borrowItem, returnItem } from '../controllers/borrowController';

const router = Router();

router.post('/', authenticateAndAuthorize(['ADMIN', 'TEACHER']), addItem);
router.put('/:id', authenticateAndAuthorize(['ADMIN', 'TEACHER']), updateItem);

router.get('/:id', authenticateAndAuthorize(['ADMIN', 'TEACHER', 'STUDENT']), getItem);

router.post('/borrow', authenticateAndAuthorize(['ADMIN','TEACHER', 'STUDENT']), borrowItem);

router.post('/return', authenticateAndAuthorize(['ADMIN', 'TEACHER', 'STUDENT']), returnItem);

router.post('/usage-report', authenticateAndAuthorize(['ADMIN']), usageReport);

router.post('/borrow-analysis', authenticateAndAuthorize(['ADMIN']), borrowAnalysis);

export default router;
