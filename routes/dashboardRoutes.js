const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/landlord', restrictTo('landlord', 'admin'), dashboardController.getLandlordDashboard);
router.get('/tenant', restrictTo('tenant'), dashboardController.getTenantDashboard);

module.exports = router;
