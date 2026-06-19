const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'A lease must be associated with a property']
    },
    landlord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A lease must be associated with a landlord']
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A lease must be associated with a tenant']
    },
    startDate: {
      type: Date,
      required: [true, 'A lease must have a start date']
    },
    endDate: {
      type: Date,
      required: [true, 'A lease must have an end date']
    },
    rentAmount: {
      type: Number,
      required: [true, 'A lease must have a rent amount']
    },
    securityDeposit: {
      type: Number,
      required: [true, 'A lease must have a security deposit']
    },
    status: {
      type: String,
      enum: ['pending_signatures', 'active', 'terminated'],
      default: 'pending_signatures'
    },
    landlordSignature: {
      type: String, // Store base64 data URL or digital confirmation string
      default: ''
    },
    landlordSignedAt: {
      type: Date
    },
    tenantSignature: {
      type: String, // Store base64 data URL or digital confirmation string
      default: ''
    },
    tenantSignedAt: {
      type: Date
    },
    agreementPdfUrl: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

const Lease = mongoose.model('Lease', leaseSchema);
module.exports = Lease;
