const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a property title'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Please provide a property description']
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      zipCode: { type: String, required: true }
    },
    rentAmount: {
      type: Number,
      required: [true, 'Please provide a monthly rent amount'],
      min: [0, 'Rent amount cannot be negative']
    },
    securityDeposit: {
      type: Number,
      required: [true, 'Please provide a security deposit amount'],
      min: [0, 'Security deposit cannot be negative']
    },
    bedrooms: {
      type: Number,
      required: [true, 'Please provide the number of bedrooms'],
      min: [0, 'Number of bedrooms cannot be negative']
    },
    bathrooms: {
      type: Number,
      required: [true, 'Please provide the number of bathrooms'],
      min: [0, 'Number of bathrooms cannot be negative']
    },
    amenities: [
      {
        type: String,
        trim: true
      }
    ],
    images: [
      {
        type: String // URL or local path
      }
    ],
    landlord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A property must belong to a landlord']
    },
    status: {
      type: String,
      enum: ['available', 'rented'],
      default: 'available'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for searching/filtering
propertySchema.index({ 'address.city': 1, rentAmount: 1, bedrooms: 1, status: 1 });

const Property = mongoose.model('Property', propertySchema);
module.exports = Property;
