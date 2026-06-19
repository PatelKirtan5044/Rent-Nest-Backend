const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

// Protected routes
router.get('/me', protect, authController.getMe);
router.patch('/profile', protect, upload.single('profilePicture'), authController.updateProfile);

module.exports = router;
