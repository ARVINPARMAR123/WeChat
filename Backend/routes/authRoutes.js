import express from 'express';
import { register, login, logout, getCurrentUser, getUsers, updateCurrentUser } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getCurrentUser);
router.get('/users', authMiddleware, getUsers);
router.put('/profile', authMiddleware, updateCurrentUser);

export default router;