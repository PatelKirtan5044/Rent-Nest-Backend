const Payment = require('../models/Payment');
const Lease = require('../models/Lease');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const paymentService = require('../services/paymentService');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');

/**
 * Get Rent Payment History / Invoices
 */
exports.getPayments = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'tenant') {
      query.tenant = req.user.id;
    } else if (req.user.role === 'landlord') {
      query.landlord = req.user.id;
    }

    const payments = await Payment.find(query)
      .populate('lease')
      .populate('tenant', 'name email contactNumber')
      .populate('landlord', 'name email contactNumber')
      .sort({ dueDate: -1 });

    new ApiResponse(200, { payments }, 'Payments retrieved successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Initiate Payment order/intent (Tenant only)
 */
exports.initiatePayment = async (req, res, next) => {
  try {
    const { paymentId, gateway } = req.body; // gateway: 'razorpay' or 'stripe'
    
    if (!['razorpay', 'stripe'].includes(gateway)) {
      return next(new ApiError(400, 'Invalid payment gateway requested.'));
    }

    const payment = await Payment.findById(paymentId).populate('tenant');
    if (!payment) {
      return next(new ApiError(404, 'Rent invoice not found.'));
    }

    if (payment.tenant._id.toString() !== req.user.id) {
      return next(new ApiError(403, 'You are not authorized to pay this invoice.'));
    }

    if (payment.paymentStatus === 'paid') {
      return next(new ApiError(400, 'This invoice has already been paid.'));
    }

    let gatewayData = {};

    if (gateway === 'razorpay') {
      gatewayData = await paymentService.createRazorpayOrder(payment._id, payment.amount);
    } else if (gateway === 'stripe') {
      gatewayData = await paymentService.createStripePaymentIntent(payment._id, payment.amount, payment.tenant.email);
    }

    new ApiResponse(200, { gatewayData }, 'Payment gateway intent initialized.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Payment (Tenant only)
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    const { paymentId, gateway, razorpay_order_id, razorpay_payment_id, razorpay_signature, stripe_payment_intent_id } = req.body;

    const payment = await Payment.findById(paymentId)
      .populate({
        path: 'lease',
        populate: { path: 'property' }
      })
      .populate('tenant')
      .populate('landlord');

    if (!payment) {
      return next(new ApiError(404, 'Invoice not found.'));
    }

    if (payment.paymentStatus === 'paid') {
      return next(new ApiError(400, 'This invoice has already been paid.'));
    }

    let isVerified = false;
    let transactionId = '';
    const gatewayDetails = {};

    if (gateway === 'razorpay') {
      isVerified = paymentService.verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );
      transactionId = razorpay_payment_id;
      gatewayDetails.razorpay_order_id = razorpay_order_id;
      gatewayDetails.razorpay_signature = razorpay_signature;
    } else if (gateway === 'stripe') {
      // In stripe mock, we assume it's verified. In production we would check paymentIntent status
      isVerified = true;
      transactionId = stripe_payment_intent_id || `ch_mock_${Math.random().toString(36).substring(2, 12)}`;
      gatewayDetails.stripe_payment_intent_id = stripe_payment_intent_id;
    }

    if (!isVerified) {
      return next(new ApiError(400, 'Payment verification failed. Invalid signatures.'));
    }

    // Update Payment status to paid
    payment.paymentStatus = 'paid';
    payment.paymentDate = new Date();
    payment.transactionId = transactionId;
    payment.paymentMethod = gateway;
    payment.paymentGatewayDetails = gatewayDetails;

    // Generate receipt PDF
    const pdfData = await pdfService.generateReceiptPDF(
      payment,
      payment.lease,
      payment.tenant,
      payment.landlord
    );

    payment.receiptPdfUrl = pdfData.url;
    await payment.save();

    // Save notification in database
    const notifMessage = `Rent payment of ₹${payment.amount.toLocaleString('en-IN')} received from ${payment.tenant.name} for ${payment.lease.property?.title || 'property'}.`;
    const notif = await Notification.create({
      user: payment.landlord._id,
      message: notifMessage,
      type: 'success'
    });

    // Send real-time notification to Landlord
    if (req.app.get('socketio')) {
      const io = req.app.get('socketio');
      io.to(payment.landlord._id.toString()).emit('payment_completed', {
        paymentId: payment._id,
        message: notifMessage,
        notification: notif
      });
    }

    // Send payment receipt email
    await emailService.sendRentReceiptEmail(payment.tenant, payment, pdfData.filePath);

    new ApiResponse(200, { payment }, 'Payment completed and verified successfully. Receipt emailed.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Manually record rent payment (Landlord only, e.g. Cash, Bank Transfer)
 */
exports.manualRecordPayment = async (req, res, next) => {
  try {
    const { paymentId, paymentMethod, transactionId } = req.body;
    
    if (!['cash', 'bank_transfer'].includes(paymentMethod)) {
      return next(new ApiError(400, 'Invalid manual payment method. Choose cash or bank_transfer.'));
    }

    const payment = await Payment.findById(paymentId)
      .populate({
        path: 'lease',
        populate: { path: 'property' }
      })
      .populate('tenant')
      .populate('landlord');

    if (!payment) {
      return next(new ApiError(404, 'Invoice not found.'));
    }

    // Verify landlord ownership
    if (payment.landlord._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You are not authorized to manage payments for this lease.'));
    }

    if (payment.paymentStatus === 'paid') {
      return next(new ApiError(400, 'This invoice is already paid.'));
    }

    payment.paymentStatus = 'paid';
    payment.paymentDate = new Date();
    payment.paymentMethod = paymentMethod;
    payment.transactionId = transactionId || `manual_${Date.now()}`;

    // Generate receipt PDF
    const pdfData = await pdfService.generateReceiptPDF(
      payment,
      payment.lease,
      payment.tenant,
      payment.landlord
    );

    payment.receiptPdfUrl = pdfData.url;
    await payment.save();

    // Save notification in database
    const notifMessage = `Your landlord manually recorded a rent payment of ₹${payment.amount.toLocaleString('en-IN')} via ${paymentMethod.replace('_', ' ')}.`;
    const notif = await Notification.create({
      user: payment.tenant._id,
      message: notifMessage,
      type: 'success'
    });

    // Send real-time notification to Tenant
    if (req.app.get('socketio')) {
      const io = req.app.get('socketio');
      io.to(payment.tenant._id.toString()).emit('payment_completed', {
        paymentId: payment._id,
        message: notifMessage,
        notification: notif
      });
    }

    // Send receipt email
    await emailService.sendRentReceiptEmail(payment.tenant, payment, pdfData.filePath);

    new ApiResponse(200, { payment }, 'Payment recorded manually. Receipt emailed.').send(res);
  } catch (error) {
    next(error);
  }
};
