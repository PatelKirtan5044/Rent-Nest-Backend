const cron = require('node-cron');
const Lease = require('../models/Lease');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { sendRentDueAlert } = require('./emailService');

/**
 * Automatically generate monthly invoices for active leases
 */
const generateMonthlyInvoices = async () => {
  console.log('Running cron task: Generating Monthly Rent Invoices...');
  try {
    const activeLeases = await Lease.find({ status: 'active' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const lease of activeLeases) {
      const startDate = new Date(lease.startDate);
      startDate.setHours(0, 0, 0, 0);

      let monthsPassed = 0;
      let keepChecking = true;

      while (keepChecking) {
        const year = startDate.getFullYear();
        const month = startDate.getMonth() + monthsPassed;
        const leaseStartDay = startDate.getDate();
        
        const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
        const targetDay = Math.min(leaseStartDay, lastDayOfTargetMonth);
        const calculatedDueDate = new Date(year, month, targetDay, 0, 0, 0, 0);

        if (calculatedDueDate > today || calculatedDueDate > new Date(lease.endDate)) {
          keepChecking = false;
          break;
        }

        // Check if invoice already exists for this lease and due date range (month-wide check)
        const startOfMonth = new Date(calculatedDueDate.getFullYear(), calculatedDueDate.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(calculatedDueDate.getFullYear(), calculatedDueDate.getMonth() + 1, 0, 23, 59, 59, 999);

        const existingInvoice = await Payment.findOne({
          lease: lease._id,
          dueDate: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (!existingInvoice) {
          await Payment.create({
            lease: lease._id,
            tenant: lease.tenant,
            landlord: lease.landlord,
            amount: lease.rentAmount,
            dueDate: calculatedDueDate,
            paymentStatus: 'pending'
          });
          console.log(`Generated missed rent invoice for Lease ID: ${lease._id}, Due Date: ${calculatedDueDate.toLocaleDateString()}`);
        }

        monthsPassed++;
      }
    }
  } catch (error) {
    console.error('Error generating monthly invoices:', error);
  }
};

/**
 * Scan pending payments and send alerts for upcoming dues
 */
const sendRentDueAlerts = async () => {
  console.log('Running cron task: Sending Rent Due Alerts...');
  try {
    const pendingPayments = await Payment.find({ paymentStatus: 'pending' }).populate('tenant');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const payment of pendingPayments) {
      if (!payment.tenant) continue;

      const dueDate = new Date(payment.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Trigger email warnings at 3 days before, 1 day before, and due date (0)
      if ([3, 1, 0].includes(diffDays)) {
        await sendRentDueAlert(payment.tenant, payment, diffDays);
        console.log(`Sent due alert email to ${payment.tenant.email} for payment ID: ${payment._id} (due in ${diffDays} days)`);
      }
    }
  } catch (error) {
    console.error('Error sending due date alerts:', error);
  }
};

/**
 * Automatically mark past-due invoices as overdue
 */
const markPaymentsOverdue = async () => {
  console.log('Running cron task: Checking and marking Overdue Payments...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Payment.updateMany(
      {
        paymentStatus: 'pending',
        dueDate: { $lt: today }
      },
      {
        $set: { paymentStatus: 'overdue' }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`Marked ${result.modifiedCount} invoice(s) as overdue.`);
    }
  } catch (error) {
    console.error('Error marking overdue payments:', error);
  }
};

// Start all background cron schedules
const initCrons = () => {
  // Run every day at midnight (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    await generateMonthlyInvoices();
    await sendRentDueAlerts();
    await markPaymentsOverdue();
  });

  // Run a catch-up sweep on startup to generate any missed invoices or mark overdue payments immediately
  setTimeout(async () => {
    console.log('Running startup billing sweep...');
    await generateMonthlyInvoices();
    await markPaymentsOverdue();
  }, 5000); // Wait 5 seconds after boot to make sure DB is fully connected

  console.log('Cron scheduler service initialized.');
};

module.exports = {
  initCrons,
  generateMonthlyInvoices,
  sendRentDueAlerts,
  markPaymentsOverdue
};
