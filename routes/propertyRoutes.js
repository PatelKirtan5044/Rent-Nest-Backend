const express = require('express');
const propertyController = require('../controllers/propertyController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Public / Tenant accessible routes
router.get('/', propertyController.getAllProperties);
router.get('/my-listings', protect, restrictTo('landlord'), propertyController.getMyProperties);
router.get('/applications', protect, propertyController.getApplications);
router.get('/:id', propertyController.getPropertyById);

// Landlord property listings CRUD
router.post(
  '/',
  protect,
  restrictTo('landlord', 'admin'),
  upload.array('images', 5),
  propertyController.createProperty
);

router.patch(
  '/:id',
  protect,
  restrictTo('landlord', 'admin'),
  upload.array('images', 5),
  propertyController.updateProperty
);

router.delete(
  '/:id',
  protect,
  restrictTo('landlord', 'admin'),
  propertyController.deleteProperty
);

// Tenant Applications
router.post('/:id/apply', protect, restrictTo('tenant'), propertyController.applyForProperty);
router.patch('/applications/:id', protect, restrictTo('landlord', 'admin'), propertyController.updateApplicationStatus);

module.exports = router;
