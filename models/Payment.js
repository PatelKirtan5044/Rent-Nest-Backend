const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    lease: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lease',
      required: [true, 'Payment must belong to a lease']
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Payment must belong to a tenant']
    },
    landlord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Payment must belong to a landlord']
    },
    amount: {
      type: Number,
      required: [true, 'Payment must have an amount']
    },
    dueDate: {
      type: Date,
      required: [true, 'Payment must have a due date']
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending'
    },
    paymentDate: {
      type: Date
    },
    transactionId: {
      type: String,
      trim: true
    },
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'stripe', 'cash', 'bank_transfer', 'mock'],
      default: 'mock'
    },
    receiptPdfUrl: {
      type: String,
      default: ''
    },
    paymentGatewayDetails: {
      type: Map,
      of: String
    }
  },
  {
    timestamps: true
  }
);

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
