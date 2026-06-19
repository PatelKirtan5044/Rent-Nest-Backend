const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const leasesDir = path.join(__dirname, '../public/leases');
const receiptsDir = path.join(__dirname, '../public/receipts');

// Ensure directories exist
if (!fs.existsSync(leasesDir)) fs.mkdirSync(leasesDir, { recursive: true });
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

/**
 * Generate PDF Tenancy Agreement
 */
const generateLeasePDF = (lease, property, landlord, tenant) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filename = `lease-${lease._id}.pdf`;
      const filePath = path.join(leasesDir, filename);
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // Title
      doc.fillColor('#2C3E50').fontSize(22).text('RESIDENTIAL LEASE AGREEMENT', { align: 'center' });
      doc.moveDown(1.5);

      // Divider
      doc.strokeColor('#BDC3C7').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1.5);

      // Summary Info
      doc.fillColor('#34495E').fontSize(12).text(`Lease ID: ${lease._id}`, { align: 'right' });
      doc.text(`Date Created: ${new Date(lease.createdAt || Date.now()).toDateString()}`, { align: 'right' });
      doc.moveDown(1.5);

      // Party Details
      doc.fontSize(14).fillColor('#2C3E50').text('1. PARTIES', { underline: true });
      doc.fontSize(12).fillColor('#34495E').moveDown(0.5);
      doc.text(`LANDLORD: ${landlord.name} (${landlord.email})`);
      doc.text(`TENANT: ${tenant.name} (${tenant.email})`);
      doc.moveDown(1.5);

      // Property Details
      doc.fontSize(14).fillColor('#2C3E50').text('2. PROPERTY DETAILS', { underline: true });
      doc.fontSize(12).fillColor('#34495E').moveDown(0.5);
      doc.text(`Title: ${property.title}`);
      doc.text(`Address: ${property.address.street}, ${property.address.city}, ${property.address.state}, ${property.address.country} - ${property.address.zipCode}`);
      doc.moveDown(1.5);

      // Terms
      doc.fontSize(14).fillColor('#2C3E50').text('3. LEASE TERMS & PAYMENTS', { underline: true });
      doc.fontSize(12).fillColor('#34495E').moveDown(0.5);
      doc.text(`Start Date: ${new Date(lease.startDate).toDateString()}`);
      doc.text(`End Date: ${new Date(lease.endDate).toDateString()}`);
      doc.text(`Monthly Rent: INR ${lease.rentAmount.toLocaleString('en-IN')}`);
      doc.text(`Security Deposit: INR ${lease.securityDeposit.toLocaleString('en-IN')}`);
      doc.moveDown(2);

      // Signatures Title
      doc.fontSize(14).fillColor('#2C3E50').text('4. DIGITAL SIGNATURES', { underline: true });
      doc.moveDown(1);

      // Landlord Signature Block
      const currentY = doc.y;
      doc.fontSize(12).fillColor('#34495E');
      doc.text('Landlord Signature:', 50, currentY);
      if (lease.landlordSignature) {
        if (lease.landlordSignature.startsWith('data:image')) {
          // If signature is base64 image representation
          try {
            const base64Data = lease.landlordSignature.replace(/^data:image\/\w+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, 50, currentY + 15, { width: 150, height: 50 });
          } catch (err) {
            doc.text('[Signed Digitally via Canvas]', 50, currentY + 20);
          }
        } else {
          doc.font('Courier-Oblique').text(lease.landlordSignature, 50, currentY + 20);
          doc.font('Helvetica');
        }
        doc.fontSize(9).text(`Signed At: ${new Date(lease.landlordSignedAt).toLocaleString()}`, 50, currentY + 70);
      } else {
        doc.fillColor('#E74C3C').text('PENDING SIGNATURE', 50, currentY + 20);
      }

      // Tenant Signature Block
      doc.fillColor('#34495E');
      doc.text('Tenant Signature:', 350, currentY);
      if (lease.tenantSignature) {
        if (lease.tenantSignature.startsWith('data:image')) {
          try {
            const base64Data = lease.tenantSignature.replace(/^data:image\/\w+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, 350, currentY + 15, { width: 150, height: 50 });
          } catch (err) {
            doc.text('[Signed Digitally via Canvas]', 350, currentY + 20);
          }
        } else {
          doc.font('Courier-Oblique').text(lease.tenantSignature, 350, currentY + 20);
          doc.font('Helvetica');
        }
        doc.fontSize(9).text(`Signed At: ${new Date(lease.tenantSignedAt).toLocaleString()}`, 350, currentY + 70);
      } else {
        doc.fillColor('#E74C3C').text('PENDING SIGNATURE', 350, currentY + 20);
      }

      doc.end();

      writeStream.on('finish', () => {
        resolve({
          filePath,
          filename,
          url: `/leases/${filename}`
        });
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate PDF Rent Receipt
 */
const generateReceiptPDF = (payment, lease, tenant, landlord) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filename = `receipt-${payment._id}.pdf`;
      const filePath = path.join(receiptsDir, filename);
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // Header Section
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(20).text('RENTNEST', 50, 40);
      doc.fontSize(10).font('Helvetica').fillColor('#64748B').text('Premium Living Redefined', 50, 62);
      
      // Right-aligned Receipt Header Label
      doc.fillColor('#0F766E').font('Helvetica-Bold').fontSize(24).text('RENT RECEIPT', 350, 38, { align: 'right', width: 212 });

      // Horizontal line separator
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 85).lineTo(562, 85).stroke();

      // Metadata section (Y = 105)
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569').text('Receipt Number:', 50, 105);
      doc.font('Helvetica').fontSize(10).fillColor('#0F172A').text(`REC-${payment._id.toString().substring(18).toUpperCase()}`, 155, 105);
      
      doc.font('Helvetica-Bold').fillColor('#475569').text('Payment Date:', 50, 122);
      doc.font('Helvetica').fillColor('#0F172A').text(new Date(payment.paymentDate || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'medium' }), 155, 122);
      
      doc.font('Helvetica-Bold').fillColor('#475569').text('Payment Method:', 50, 139);
      doc.font('Helvetica').fillColor('#0F172A').text(payment.paymentMethod.toUpperCase(), 155, 139);
      
      doc.font('Helvetica-Bold').fillColor('#475569').text('Transaction ID:', 50, 156);
      doc.font('Helvetica').fillColor('#0F172A').text(payment.transactionId || 'N/A', 155, 156);

      // Property Information Section (Right Side)
      const property = lease?.property || {};
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569').text('Property Details:', 330, 105);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text(property.title || 'Rental Property Listing', 330, 122, { width: 232 });
      doc.font('Helvetica').fontSize(9).fillColor('#475569').text(
        `${property.address?.street || ''}, ${property.address?.city || ''}, ${property.address?.state || ''}, ${property.address?.country || ''} - ${property.address?.zipCode || ''}`,
        330,
        139,
        { width: 232, lineGap: 2 }
      );

      // Divider line at Y = 190
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 190).lineTo(562, 190).stroke();

      // Parties Details Section (Y = 205)
      // Left side: Paid By
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F766E').text('PAID BY (TENANT)', 50, 205);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A').text(tenant.name, 50, 222);
      doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Email: ${tenant.email}`, 50, 239);
      doc.font('Helvetica').text(`Phone: ${tenant.contactNumber || 'N/A'}`, 50, 254);

      // Right side: Received By
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F766E').text('RECEIVED BY (LANDLORD)', 330, 205);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A').text(landlord.name, 330, 222);
      doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Email: ${landlord.email}`, 330, 239);
      doc.font('Helvetica').text(`Phone: ${landlord.contactNumber || 'N/A'}`, 330, 254);

      // Divider line at Y = 285
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 285).lineTo(562, 285).stroke();

      // Itemized Table Section (Y = 305)
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#475569').text('PAYMENT BREAKDOWN', 50, 305);
      
      // Draw Table Header Background
      doc.rect(50, 325, 512, 22).fill('#F1F5F9');
      
      // Table Header Text
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text('Item Description', 60, 332);
      doc.text('Rent Due Date', 340, 332);
      doc.text('Amount Paid', 460, 332, { width: 92, align: 'right' });

      // Table Row Data (Y = 357)
      doc.font('Helvetica').fontSize(10).fillColor('#0F172A').text(
        `Rent payment for lease ID: ${lease._id.toString().substring(18).toUpperCase()}`,
        60,
        357,
        { width: 260 }
      );
      doc.text(new Date(payment.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' }), 340, 357);
      doc.font('Helvetica-Bold').text(`INR ${payment.amount.toLocaleString('en-IN')}`, 460, 357, { width: 92, align: 'right' });

      // Draw Table Bottom Border
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 385).lineTo(562, 385).stroke();

      // Total Paid Accent Card (Y = 405)
      doc.rect(262, 405, 300, 75).fill('#ECFDF5');
      doc.strokeColor('#10B981').lineWidth(1.5).rect(262, 405, 300, 75).stroke();
      
      doc.fillColor('#065F46').font('Helvetica-Bold').fontSize(10).text('GRAND TOTAL PAID', 282, 417);
      doc.fontSize(16).text(`INR ${payment.amount.toLocaleString('en-IN')}`, 282, 437);
      doc.fillColor('#047857').fontSize(10).text('STATUS: SUCCESS / PAID', 410, 437, { width: 140, align: 'right' });

      // Receipt Stamp Badge (Y = 405, Left side)
      doc.rect(50, 405, 180, 75).fill('#F0F9FF');
      doc.strokeColor('#0EA5E9').lineWidth(1.5).rect(50, 405, 180, 75).stroke();
      
      doc.fillColor('#0369A1').font('Helvetica-Bold').fontSize(9).text('SECURE TRANSACTION', 60, 417);
      doc.fontSize(13).text('VERIFIED & SIGNED', 60, 434);
      doc.fontSize(8).font('Helvetica').text('SYSTEM GENERATED RECORD', 60, 455);

      // Divider line at Y = 505
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 505).lineTo(562, 505).stroke();

      // Terms & Conditions Footer (Y = 525)
      doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(
        'Thank you for your payment! This is an official digital payment receipt generated on our secure property rental management network. For any billing questions or support inquiries, please contact your landlord directly.',
        50,
        525,
        { align: 'center', width: 512, lineGap: 3 }
      );

      doc.end();

      writeStream.on('finish', () => {
        resolve({
          filePath,
          filename,
          url: `/receipts/${filename}`
        });
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateLeasePDF,
  generateReceiptPDF
};
