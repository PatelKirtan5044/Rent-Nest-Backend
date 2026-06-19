const nodemailer = require('nodemailer');

// Helper to determine if we should use actual SMTP
const isEmailConfigured = () => {
  return (
    process.env.EMAIL_USER &&
    process.env.EMAIL_USER !== 'yourapp@gmail.com' &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_PASS !== 'your_gmail_app_password'
  );
};

// Create Nodemailer Transporter
const createTransporter = async () => {
  if (isEmailConfigured()) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // Local / Dev Fallback: Create mock test account
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log('Created Ethereal Email test account for development.');
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (err) {
      console.warn('Failed to create Ethereal mail account. Falling back to console-logging mailer.');
      return {
        sendMail: async (mailOptions) => {
          console.log('\n--- SIMULATED EMAIL SENT ---');
          console.log(`To: ${mailOptions.to}`);
          console.log(`Subject: ${mailOptions.subject}`);
          console.log(`Text: ${mailOptions.text}`);
          if (mailOptions.attachments) {
            console.log(`Attachments: ${mailOptions.attachments.map(a => a.filename).join(', ')}`);
          }
          console.log('-----------------------------\n');
          return { messageId: 'mock-id-' + Date.now() };
        }
      };
    }
  }
};

/**
 * Send General Email
 */
const sendEmail = async ({ to, subject, text, html, attachments }) => {
  try {
    const transporter = await createTransporter();
    const mailOptions = {
      from: `"Property Management" <${process.env.EMAIL_USER || 'no-reply@rentalmanagement.com'}>`,
      to,
      subject,
      text,
      html,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    
    // If using Ethereal, log the preview URL
    if (nodemailer.getTestMessageUrl && nodemailer.getTestMessageUrl(info)) {
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // Do not crash the application if email fails
    return null;
  }
};

/**
 * Send Rent Due Alert
 */
const sendRentDueAlert = async (tenant, payment, daysRemaining) => {
  const formattedAmount = `₹${payment.amount.toLocaleString('en-IN')}`;
  const subject = `Rent Due Alert: Invoice for ${formattedAmount}`;
  const text = `Hi ${tenant.name},\n\nThis is a friendly reminder that your rent payment of ${formattedAmount} is due in ${daysRemaining} days (Due Date: ${new Date(payment.dueDate).toDateString()}).\n\nPlease log in to the portal to make your payment online.\n\nBest regards,\nProperty Management Team`;
  
  const html = `
    <h3>Rent Due Reminder</h3>
    <p>Hi ${tenant.name},</p>
    <p>This is a friendly reminder that your rent payment of <strong>${formattedAmount}</strong> is due in <strong>${daysRemaining}</strong> days on <strong>${new Date(payment.dueDate).toDateString()}</strong>.</p>
    <p>Please log in to the tenant portal to pay online via Razorpay/Stripe.</p>
    <br/>
    <p>Best regards,<br/>Property Management Team</p>
  `;

  return await sendEmail({ to: tenant.email, subject, text, html });
};

/**
 * Send Rent Payment Receipt
 */
const sendRentReceiptEmail = async (tenant, payment, pdfAttachmentPath) => {
  const formattedAmount = `₹${payment.amount.toLocaleString('en-IN')}`;
  const subject = `Rent Payment Receipt: REC-${payment._id.toString().substring(18).toUpperCase()}`;
  const text = `Hi ${tenant.name},\n\nThank you for your rent payment of ${formattedAmount}. Your transaction was completed successfully.\n\nPlease find attached your official payment receipt PDF.\n\nBest regards,\nProperty Management Team`;
  
  const html = `
    <h3>Rent Payment Receipt</h3>
    <p>Hi ${tenant.name},</p>
    <p>Thank you for your rent payment of <strong>${formattedAmount}</strong> on <strong>${new Date(payment.paymentDate).toDateString()}</strong>.</p>
    <p>Your transaction has been processed successfully. Your receipt is attached to this email.</p>
    <br/>
    <p>Best regards,<br/>Property Management Team</p>
  `;

  const attachments = [
    {
      filename: `Receipt-${payment._id.substring(18)}.pdf`,
      path: pdfAttachmentPath
    }
  ];

  return await sendEmail({ to: tenant.email, subject, text, html, attachments });
};

/**
 * Send Lease Agreement for Signature
 */
const sendLeaseAgreementEmail = async (recipient, lease, pdfAttachmentPath) => {
  const subject = `Lease Agreement for Review - Property ID: ${lease.property}`;
  const text = `Hi ${recipient.name},\n\nYour tenancy lease agreement has been generated. Please review the attached PDF document.\n\nLog in to the rental portal to digitally sign and finalize the agreement.\n\nBest regards,\nProperty Rental Team`;

  const html = `
    <h3>Tenancy Lease Agreement</h3>
    <p>Hi ${recipient.name},</p>
    <p>Your tenancy lease agreement has been generated. Please review the attached PDF document.</p>
    <p>To finalize the lease, log in to your dashboard and provide your digital signature.</p>
    <br/>
    <p>Best regards,<br/>Property Rental Team</p>
  `;

  const attachments = [
    {
      filename: `Lease-Agreement-${lease._id.toString().substring(18)}.pdf`,
      path: pdfAttachmentPath
    }
  ];

  return await sendEmail({ to: recipient.email, subject, text, html, attachments });
};

module.exports = {
  sendEmail,
  sendRentDueAlert,
  sendRentReceiptEmail,
  sendLeaseAgreementEmail
};
