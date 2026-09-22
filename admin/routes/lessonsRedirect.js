import { Router } from 'express';
import { requireAdminAuth } from './authGuard.js';

const router = Router();

router.get('/lessons', requireAdminAuth, (req, res) => {
  res.redirect('/courses');
});

export default router;
