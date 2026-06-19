const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', paymentController.getPayments);

// Tenant-only payments trigger & verification
router.post('/initiate', restrictTo('tenant'), paymentController.initiatePayment);
router.post('/verify', restrictTo('tenant'), paymentController.verifyPayment);

// Landlord manual recording
router.post('/manual-record', restrictTo('landlord', 'admin'), paymentController.manualRecordPayment);

module.exports = router;
