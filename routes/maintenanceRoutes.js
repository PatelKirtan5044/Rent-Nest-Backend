const express = require('express');
const maintenanceController = require('../controllers/maintenanceController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', maintenanceController.getRequests);
router.get('/:id', maintenanceController.getRequestById);

// Tenant-only raise requests
router.post('/', restrictTo('tenant'), upload.array('images', 3), maintenanceController.createRequest);

// Landlord-only status changes & assignments
router.patch('/:id', restrictTo('landlord', 'admin'), maintenanceController.updateRequestStatus);

module.exports = router;
