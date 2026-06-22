const express = require('express');
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All notifications routes are protected
router.use(protect);

router.route('/')
  .get(notificationController.getNotifications)
  .delete(notificationController.clearNotifications);

router.patch('/read', notificationController.markAllAsRead);

module.exports = router;
