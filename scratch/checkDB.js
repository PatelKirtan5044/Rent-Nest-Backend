const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Lease = require('../models/Lease');
const Property = require('../models/Property');
const Application = require('../models/Application');
const User = require('../models/User');

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('DB Connected.');

    const users = await User.find({}, 'name email role');
    console.log('\n--- USERS ---');
    console.log(users);

    const properties = await Property.find({}, 'title status landlord');
    console.log('\n--- PROPERTIES ---');
    console.log(properties);

    const applications = await Application.find({})
      .populate('tenant', 'name')
      .populate('property', 'title');
    console.log('\n--- APPLICATIONS ---');
    console.log(applications.map(a => ({
      _id: a._id,
      tenant: a.tenant?.name,
      property: a.property?.title,
      status: a.status
    })));

    const leases = await Lease.find({})
      .populate('property', 'title')
      .populate('landlord', 'name')
      .populate('tenant', 'name');
    console.log('\n--- AGREEMENTS (LEASES) ---');
    console.log(leases.map(l => ({
      _id: l._id,
      property: l.property?.title,
      landlord: l.landlord?.name,
      tenant: l.tenant?.name,
      status: l.status,
      agreementPdfUrl: l.agreementPdfUrl
    })));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
};

check();
