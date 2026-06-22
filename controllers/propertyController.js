const Property = require('../models/Property');
const Application = require('../models/Application');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

/**
 * Create Property listing (Landlord only)
 */
exports.createProperty = async (req, res, next) => {
  try {
    const { title, description, street, city, state, country, zipCode, rentAmount, securityDeposit, bedrooms, bathrooms, amenities } = req.body;

    // Handle uploaded files
    let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (isCloudinaryConfigured()) {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: 'rental_properties'
            });
            images.push(result.secure_url);
          } catch (err) {
            console.error('Cloudinary upload failed, falling back to local file path:', err);
            images.push(`/uploads/${file.filename}`);
          }
        } else {
          images.push(`/uploads/${file.filename}`);
        }
      }
    }

    const parsedAmenities = amenities ? (Array.isArray(amenities) ? amenities : amenities.split(',').map(a => a.trim())) : [];

    const newProperty = await Property.create({
      title,
      description,
      address: { street, city, state, country, zipCode },
      rentAmount,
      securityDeposit,
      bedrooms,
      bathrooms,
      amenities: parsedAmenities,
      images,
      landlord: req.user.id
    });

    new ApiResponse(201, { property: newProperty }, 'Property created successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Update Property listing (Landlord only)
 */
exports.updateProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return next(new ApiError(404, 'Property not found.'));
    }

    // Check ownership
    if (property.landlord.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You do not have permission to update this property.'));
    }

    const { title, description, street, city, state, country, zipCode, rentAmount, securityDeposit, bedrooms, bathrooms, amenities, status } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (rentAmount) updateData.rentAmount = rentAmount;
    if (securityDeposit) updateData.securityDeposit = securityDeposit;
    if (bedrooms) updateData.bedrooms = bedrooms;
    if (bathrooms) updateData.bathrooms = bathrooms;
    if (status) updateData.status = status;

    if (street || city || state || country || zipCode) {
      updateData.address = {
        street: street || property.address.street,
        city: city || property.address.city,
        state: state || property.address.state,
        country: country || property.address.country,
        zipCode: zipCode || property.address.zipCode
      };
    }

    if (amenities) {
      updateData.amenities = Array.isArray(amenities) ? amenities : amenities.split(',').map(a => a.trim());
    }

    // Handle new images
    if (req.files && req.files.length > 0) {
      let newImages = [];
      for (const file of req.files) {
        if (isCloudinaryConfigured()) {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: 'rental_properties'
            });
            newImages.push(result.secure_url);
          } catch (err) {
            newImages.push(`/uploads/${file.filename}`);
          }
        } else {
          newImages.push(`/uploads/${file.filename}`);
        }
      }
      updateData.images = [...(property.images || []), ...newImages];
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    new ApiResponse(200, { property: updatedProperty }, 'Property updated successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Property listing
 */
exports.deleteProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return next(new ApiError(404, 'Property not found.'));
    }

    // Check ownership
    if (property.landlord.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You do not have permission to delete this property.'));
    }

    await Property.findByIdAndDelete(req.params.id);

    new ApiResponse(200, null, 'Property deleted successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Landlord's listed properties
 */
exports.getMyProperties = async (req, res, next) => {
  try {
    const properties = await Property.find({ landlord: req.user.id });
    new ApiResponse(200, { properties }, 'Landlord properties retrieved.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get & Filter properties (Tenants/Public)
 */
exports.getAllProperties = async (req, res, next) => {
  try {
    const { city, minRent, maxRent, bedrooms, bathrooms, search } = req.query;

    const query = {};

    if (city) {
      query['address.city'] = { $regex: city, $options: 'i' };
    }

    if (minRent || maxRent) {
      query.rentAmount = {};
      if (minRent) query.rentAmount.$gte = Number(minRent);
      if (maxRent) query.rentAmount.$lte = Number(maxRent);
    }

    if (bedrooms) {
      query.bedrooms = Number(bedrooms);
    }

    if (bathrooms) {
      query.bathrooms = Number(bathrooms);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'address.street': { $regex: search, $options: 'i' } }
      ];
    }

    const properties = await Property.find(query).populate('landlord', 'name email contactNumber');
    new ApiResponse(200, { properties }, 'Properties retrieved successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Property details by ID
 */
exports.getPropertyById = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).populate('landlord', 'name email contactNumber profilePicture');
    if (!property) {
      return next(new ApiError(404, 'Property not found.'));
    }
    new ApiResponse(200, { property }, 'Property details retrieved.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Tenant submits rental application
 */
exports.applyForProperty = async (req, res, next) => {
  try {
    const { message, incomeDetails, creditScore, leaseTermMonths, moveInDate } = req.body;
    const propertyId = req.params.id;

    // Check if property exists and is available
    const property = await Property.findById(propertyId);
    if (!property) {
      return next(new ApiError(404, 'Property not found.'));
    }
    if (property.status !== 'available') {
      return next(new ApiError(400, 'This property is no longer available for rent.'));
    }

    // Check if tenant already has a pending application
    const existingApp = await Application.findOne({
      tenant: req.user.id,
      property: propertyId,
      status: 'pending'
    });
    if (existingApp) {
      return next(new ApiError(400, 'You already have a pending application for this property.'));
    }

    const newApplication = await Application.create({
      tenant: req.user.id,
      property: propertyId,
      message,
      incomeDetails,
      creditScore,
      leaseTermMonths: leaseTermMonths || 12,
      moveInDate: new Date(moveInDate)
    });

    // Save notification in database
    const notifMessage = `New application received for ${property.title}`;
    const notif = await Notification.create({
      user: property.landlord,
      message: notifMessage,
      type: 'info'
    });

    // Notify landlord via Socket.io if integrated
    if (req.app.get('socketio')) {
      const io = req.app.get('socketio');
      io.to(property.landlord.toString()).emit('new_application', {
        application: newApplication,
        message: notifMessage,
        notification: notif
      });
    }

    new ApiResponse(201, { application: newApplication }, 'Application submitted successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * View applications (Different outputs for Landlord vs Tenant)
 */
exports.getApplications = async (req, res, next) => {
  try {
    let applications;

    if (req.user.role === 'landlord') {
      // Find properties belonging to this landlord
      const properties = await Property.find({ landlord: req.user.id });
      const propertyIds = properties.map(p => p._id);

      // Fetch applications for these properties
      applications = await Application.find({ property: { $in: propertyIds } })
        .populate('tenant', 'name email contactNumber profilePicture')
        .populate('property', 'title address rentAmount');
    } else {
      // Tenant sees their own applications
      applications = await Application.find({ tenant: req.user.id })
        .populate('property', 'title address rentAmount landlord')
        .populate({
          path: 'property',
          populate: { path: 'landlord', select: 'name email' }
        });
    }

    new ApiResponse(200, { applications }, 'Applications retrieved successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Landlord update application status (Approve/Reject)
 */
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const application = await Application.findById(req.params.id).populate('property');

    if (!application) {
      return next(new ApiError(404, 'Application not found.'));
    }

    // Check ownership
    if (application.property.landlord.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You do not have permission to manage this application.'));
    }

    application.status = status;
    await application.save();

    // Save notification in database
    const notifMessage = `Your application for ${application.property.title} was ${status}`;
    const notifType = status === 'approved' ? 'success' : 'danger';
    const notif = await Notification.create({
      user: application.tenant,
      message: notifMessage,
      type: notifType
    });

    // Send real-time Socket.io update to Tenant
    if (req.app.get('socketio')) {
      const io = req.app.get('socketio');
      io.to(application.tenant.toString()).emit('application_status_update', {
        applicationId: application._id,
        status: status,
        message: notifMessage,
        notification: notif
      });
    }

    new ApiResponse(200, { application }, `Application status updated to ${status}.`).send(res);
  } catch (error) {
    next(error);
  }
};
