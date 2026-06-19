const express = require('express');
const leaseController = require('../controllers/leaseController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', leaseController.getMyLeases);
router.get('/:id', leaseController.getLeaseById);

// Landlord-only: Create lease agreements
router.post('/', restrictTo('landlord', 'admin'), leaseController.createLease);

// Tenant or Landlord: Digital signatures
router.post('/:id/sign', leaseController.signLease);

module.exports = router;
