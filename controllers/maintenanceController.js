const Maintenance = require('../models/Maintenance');
const Property = require('../models/Property');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

/**
 * Raise maintenance request (Tenant only)
 */
exports.createRequest = async (req, res, next) => {
  try {
    const { propertyId, title, description, category, priority } = req.body;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return next(new ApiError(404, 'Property not found.'));
    }

    // Handle images
    let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (isCloudinaryConfigured()) {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: 'maintenance_requests'
            });
            images.push(result.secure_url);
          } catch (err) {
            images.push(`/uploads/${file.filename}`);
          }
        } else {
          images.push(`/uploads/${file.filename}`);
        }
      }
    }

    const newTicket = await Maintenance.create({
      property: propertyId,
      tenant: req.user.id,
      landlord: property.landlord,
      title,
      description,
      category,
      priority: priority || 'medium',
      images
    });

    // Notify landlord real-time via Socket.io
    if (req.app.get('socketio')) {
      const io = req.app.get('socketio');
      io.to(property.landlord.toString()).emit('new_maintenance_ticket', {
        ticket: newTicket,
        message: `New maintenance ticket raised for ${property.title}`
      });
    }

    new ApiResponse(201, { ticket: newTicket }, 'Maintenance ticket raised successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get maintenance requests (Landlord gets their properties' tickets, Tenant gets their raised tickets)
 */
exports.getRequests = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'tenant') {
      query.tenant = req.user.id;
    } else if (req.user.role === 'landlord') {
      query.landlord = req.user.id;
    }

    const tickets = await Maintenance.find(query)
      .populate('property', 'title address')
      .populate('tenant', 'name email contactNumber')
      .sort({ createdAt: -1 });

    new ApiResponse(200, { tickets }, 'Maintenance requests retrieved.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get ticket details by ID
 */
exports.getRequestById = async (req, res, next) => {
  try {
    const ticket = await Maintenance.findById(req.params.id)
      .populate('property', 'title address landlord')
      .populate('tenant', 'name email contactNumber profilePicture')
      .populate('statusHistory.updatedBy', 'name role');

    if (!ticket) {
      return next(new ApiError(404, 'Ticket not found.'));
    }

    // Auth check
    if (
      ticket.tenant._id.toString() !== req.user.id &&
      ticket.landlord.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(new ApiError(403, 'You do not have permission to view this ticket.'));
    }

    new ApiResponse(200, { ticket }, 'Ticket details retrieved.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Update request status (Landlord or Admin only)
 */
exports.updateRequestStatus = async (req, res, next) => {
  try {
    const { status, comments, assigneeName, assigneeContact } = req.body;
    
    const ticket = await Maintenance.findById(req.params.id);
    if (!ticket) {
      return next(new ApiError(404, 'Ticket not found.'));
    }

    // Ownership verification
    if (ticket.landlord.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You do not have permission to modify this ticket.'));
    }

    if (status) ticket.status = status;
    
    if (assigneeName || assigneeContact) {
      ticket.assignedTo = {
        name: assigneeName || ticket.assignedTo.name,
        contact: assigneeContact || ticket.assignedTo.contact
      };
    }

    // Push entry to statusHistory log
    ticket.statusHistory.push({
      status: status || ticket.status,
      updatedBy: req.user.id,
      comments: comments || ''
    });

    await ticket.save();

    // Trigger real-time alert to Tenant via socket
    if (req.app.get('socketio')) {
      const io = req.app.get('socketio');
      io.to(ticket.tenant.toString()).emit('maintenance_status_update', {
        ticketId: ticket._id,
        status: ticket.status,
        message: `Maintenance ticket "${ticket.title}" was updated to: ${ticket.status}`
      });
    }

    new ApiResponse(200, { ticket }, 'Ticket updated and status history logged.').send(res);
  } catch (error) {
    next(error);
  }
};
