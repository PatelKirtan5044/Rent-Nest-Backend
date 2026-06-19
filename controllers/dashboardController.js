const mongoose = require('mongoose');
const Property = require('../models/Property');
const Lease = require('../models/Lease');
const Payment = require('../models/Payment');
const Maintenance = require('../models/Maintenance');
const ApiResponse = require('../utils/apiResponse');

/**
 * Get Landlord Dashboard Analytics
 */
exports.getLandlordDashboard = async (req, res, next) => {
  try {
    const landlordId = req.user.id;

    // 1. Property counts & Occupancy Rates
    const properties = await Property.find({ landlord: landlordId });
    const totalProperties = properties.length;
    const rentedProperties = properties.filter(p => p.status === 'rented').length;
    const availableProperties = properties.filter(p => p.status === 'available').length;
    const occupancyRate = totalProperties > 0 ? Math.round((rentedProperties / totalProperties) * 100) : 0;

    // 2. Revenue collected vs pending (aggregate)
    const revenueStats = await Payment.aggregate([
      { $match: { landlord: new mongoose.Types.ObjectId(landlordId) } },
      {
        $group: {
          _id: '$paymentStatus',
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    let collectedRevenue = 0;
    let pendingRevenue = 0;

    revenueStats.forEach(stat => {
      if (stat._id === 'paid') {
        collectedRevenue = stat.totalAmount;
      } else if (stat._id === 'pending' || stat._id === 'overdue') {
        pendingRevenue += stat.totalAmount;
      }
    });

    // 3. Maintenance Ticket breakdown
    const tickets = await Maintenance.find({ landlord: landlordId });
    const totalTickets = tickets.length;
    const openTickets = tickets.filter(t => ['open', 'assigned', 'in_progress'].includes(t.status)).length;
    const resolvedTickets = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;

    // 4. Monthly income breakdown for chart analytics (aggregate)
    const monthlyIncome = await Payment.aggregate([
      {
        $match: {
          landlord: new mongoose.Types.ObjectId(landlordId),
          paymentStatus: 'paid',
          paymentDate: { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' }
          },
          totalIncome: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 } // last 6 months
    ]);

    const formattedMonthlyIncome = monthlyIncome.map(item => ({
      month: `${item._id.month}/${item._id.year}`,
      income: item.totalIncome
    }));

    // 5. Recent 5 payments
    const recentPayments = await Payment.find({ landlord: landlordId })
      .populate('tenant', 'name email')
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(5);

    // 6. Closest upcoming due payment collection
    const nextCollection = await Payment.findOne({
      landlord: landlordId,
      paymentStatus: { $in: ['pending', 'overdue'] }
    })
      .populate('tenant', 'name email')
      .sort({ dueDate: 1 });

    new ApiResponse(200, {
      properties: {
        total: totalProperties,
        rented: rentedProperties,
        available: availableProperties,
        occupancyRate: `${occupancyRate}%`
      },
      revenue: {
        collected: collectedRevenue,
        pending: pendingRevenue
      },
      maintenance: {
        total: totalTickets,
        open: openTickets,
        resolved: resolvedTickets
      },
      monthlyAnalytics: formattedMonthlyIncome,
      recentPayments,
      nextPayment: nextCollection
    }, 'Landlord analytics dashboard loaded.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Tenant Dashboard summary
 */
exports.getTenantDashboard = async (req, res, next) => {
  try {
    const tenantId = req.user.id;

    // 1. Get active lease
    const activeLease = await Lease.findOne({ tenant: tenantId, status: 'active' })
      .populate('property')
      .populate('landlord', 'name email contactNumber');

    // 2. Closest upcoming due payment
    const nextDuePayment = await Payment.findOne({
      tenant: tenantId,
      paymentStatus: { $in: ['pending', 'overdue'] }
    }).sort({ dueDate: 1 });

    // 3. Maintenance ticket counts
    const tickets = await Maintenance.find({ tenant: tenantId });
    const totalTickets = tickets.length;
    const pendingTickets = tickets.filter(t => ['open', 'assigned', 'in_progress'].includes(t.status)).length;
    
    // 4. Payment History (last 5)
    const recentPayments = await Payment.find({ tenant: tenantId })
      .populate({
        path: 'lease',
        populate: { path: 'property', select: 'title' }
      })
      .sort({ dueDate: -1 })
      .limit(5);

    new ApiResponse(200, {
      lease: activeLease,
      nextPayment: nextDuePayment,
      maintenance: {
        total: totalTickets,
        pending: pendingTickets
      },
      recentPayments
    }, 'Tenant portal dashboard loaded.').send(res);
  } catch (error) {
    next(error);
  }
};
