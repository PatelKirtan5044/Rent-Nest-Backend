const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'A maintenance ticket must reference a property']
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A maintenance ticket must reference a tenant']
    },
    landlord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A maintenance ticket must reference a landlord']
    },
    title: {
      type: String,
      required: [true, 'Please provide a title for the request'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Please describe the maintenance issue']
    },
    category: {
      type: String,
      enum: ['plumbing', 'electrical', 'appliance', 'hvac', 'structural', 'other'],
      required: [true, 'Please select a request category']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'],
      default: 'open'
    },
    assignedTo: {
      name: { type: String, default: '' },
      contact: { type: String, default: '' }
    },
    images: [
      {
        type: String // URL or local path
      }
    ],
    statusHistory: [
      {
        status: { type: String, required: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        comments: { type: String, default: '' },
        date: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
module.exports = Maintenance;
