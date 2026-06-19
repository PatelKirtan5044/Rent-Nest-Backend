const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'An application must belong to a tenant']
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'An application must reference a property']
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    message: {
      type: String,
      trim: true
    },
    incomeDetails: {
      type: Number,
      required: [true, 'Please provide your monthly income details']
    },
    creditScore: {
      type: Number,
      min: 300,
      max: 850
    },
    leaseTermMonths: {
      type: Number,
      default: 12
    },
    moveInDate: {
      type: Date,
      required: [true, 'Please specify a preferred move-in date']
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate pending applications for the same property by the same tenant
applicationSchema.index({ tenant: 1, property: 1, status: 1 }, { unique: false });

const Application = mongoose.model('Application', applicationSchema);
module.exports = Application;
