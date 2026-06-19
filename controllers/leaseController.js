const Lease = require('../models/Lease');
const Property = require('../models/Property');
const User = require('../models/User');
const Payment = require('../models/Payment');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateLeasePDF } = require('../services/pdfService');
const { sendLeaseAgreementEmail } = require('../services/emailService');

/**
 * Create Lease Draft (Landlord only)
 */
exports.createLease = async (req, res, next) => {
  try {
    const { propertyId, tenantId, startDate, endDate, rentAmount, securityDeposit } = req.body;

    // Verify property exists and belongs to this landlord
    const property = await Property.findById(propertyId);
    if (!property) {
      return next(new ApiError(404, 'Property not found.'));
    }
    if (property.landlord.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You do not have permission to lease this property.'));
    }

    // Verify tenant exists
    const tenant = await User.findById(tenantId);
    if (!tenant || tenant.role !== 'tenant') {
      return next(new ApiError(400, 'Invalid tenant specified.'));
    }

    const lease = await Lease.create({
      property: propertyId,
      landlord: req.user.id,
      tenant: tenantId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      rentAmount,
      securityDeposit,
      status: 'pending_signatures'
    });

    // Generate initial PDF draft
    const landlord = req.user;
    const pdfData = await generateLeasePDF(lease, property, landlord, tenant);
    
    lease.agreementPdfUrl = pdfData.url;
    await lease.save();

    // Send email notification with PDF draft to tenant
    await sendLeaseAgreementEmail(tenant, lease, pdfData.filePath);

    // Notify tenant via Socket.io
    if (req.app.get('socketio')) {
      const io = req.app.get('socketio');
      io.to(tenantId.toString()).emit('new_lease_agreement', {
        leaseId: lease._id,
        message: `New residential lease agreement draft generated for ${property.title}. Please review and sign.`
      });
    }

    new ApiResponse(201, { lease }, 'Lease draft created and sent to tenant.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Sign Lease (Tenant or Landlord)
 */
exports.signLease = async (req, res, next) => {
  try {
    const { signature } = req.body; // Can be base64 drawing data URL or text
    if (!signature) {
      return next(new ApiError(400, 'Please provide your digital signature.'));
    }

    const lease = await Lease.findById(req.params.id)
      .populate('property')
      .populate('landlord')
      .populate('tenant');

    if (!lease) {
      return next(new ApiError(404, 'Lease not found.'));
    }

    const userId = req.user.id;
    const today = new Date();

    let signerRole = '';
    let otherPartyId = '';

    if (lease.landlord._id.toString() === userId) {
      lease.landlordSignature = signature;
      lease.landlordSignedAt = today;
      signerRole = 'landlord';
      otherPartyId = lease.tenant._id.toString();
    } else if (lease.tenant._id.toString() === userId) {
      lease.tenantSignature = signature;
      lease.tenantSignedAt = today;
      signerRole = 'tenant';
      otherPartyId = lease.landlord._id.toString();
    } else {
      return next(new ApiError(403, 'You are not a party to this lease agreement.'));
    }

    // Send sign notification via Socket.io
    if (req.app.get('socketio') && signerRole && otherPartyId) {
      const io = req.app.get('socketio');
      const signerName = signerRole === 'landlord' ? lease.landlord.name : lease.tenant.name;
      io.to(otherPartyId).emit('lease_signed', {
        leaseId: lease._id,
        signerRole,
        message: `${signerRole.charAt(0).toUpperCase() + signerRole.slice(1)} ${signerName} has signed the lease agreement for ${lease.property.title}.`
      });
    }

    // Check if both parties have signed
    if (lease.landlordSignature && lease.tenantSignature) {
      lease.status = 'active';

      // Update property status to rented
      await Property.findByIdAndUpdate(lease.property._id, { status: 'rented' });

      // Generate first rent invoice automatically
      await Payment.create({
        lease: lease._id,
        tenant: lease.tenant._id,
        landlord: lease.landlord._id,
        amount: lease.rentAmount,
        dueDate: lease.startDate, // Due immediately on start date
        paymentStatus: 'pending'
      });

      // Send active status notifications to both parties
      if (req.app.get('socketio')) {
        const io = req.app.get('socketio');
        const activeMessage = `Lease agreement for ${lease.property.title} is now ACTIVE! Both parties signed.`;
        io.to(lease.landlord._id.toString()).emit('lease_active', {
          leaseId: lease._id,
          message: activeMessage
        });
        io.to(lease.tenant._id.toString()).emit('lease_active', {
          leaseId: lease._id,
          message: activeMessage
        });
      }
    }

    // Regenerate PDF with updated signatures
    const pdfData = await generateLeasePDF(lease, lease.property, lease.landlord, lease.tenant);
    lease.agreementPdfUrl = pdfData.url;
    await lease.save();

    // If active, email final copy to both parties
    if (lease.status === 'active') {
      await sendLeaseAgreementEmail(lease.landlord, lease, pdfData.filePath);
      await sendLeaseAgreementEmail(lease.tenant, lease, pdfData.filePath);
    }

    new ApiResponse(200, { lease }, 'Signed agreement successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Leases (For logged-in Tenant or Landlord)
 */
exports.getMyLeases = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'landlord') {
      query.landlord = req.user.id;
    } else if (req.user.role === 'tenant') {
      query.tenant = req.user.id;
    }

    const leases = await Lease.find(query)
      .populate('property')
      .populate('landlord', 'name email contactNumber')
      .populate('tenant', 'name email contactNumber');

    new ApiResponse(200, { leases }, 'Leases retrieved successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Lease details by ID
 */
exports.getLeaseById = async (req, res, next) => {
  try {
    const lease = await Lease.findById(req.params.id)
      .populate('property')
      .populate('landlord', 'name email contactNumber profilePicture')
      .populate('tenant', 'name email contactNumber profilePicture');

    if (!lease) {
      return next(new ApiError(404, 'Lease not found.'));
    }

    // Verify authorization to view
    if (
      lease.landlord._id.toString() !== req.user.id &&
      lease.tenant._id.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(new ApiError(403, 'You do not have permission to view this lease.'));
    }

    new ApiResponse(200, { lease }, 'Lease details retrieved.').send(res);
  } catch (error) {
    next(error);
  }
};
