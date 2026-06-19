const Razorpay = require('razorpay');
const stripeLib = require('stripe');

// Initialize Razorpay Client
let razorpayClient = null;
const isRazorpayConfigured = () => {
  return (
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_ID !== 'rzp_test_yourkeyid' &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_KEY_SECRET !== 'your_razorpay_secret'
  );
};

if (isRazorpayConfigured()) {
  razorpayClient = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
  console.log('Razorpay Client initialized.');
} else {
  console.warn('Razorpay credentials missing or placeholder. Running in Mock Razorpay Mode.');
}

// Initialize Stripe Client
let stripeClient = null;
const isStripeConfigured = () => {
  return (
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_SECRET_KEY !== 'sk_test_yourstripekey'
  );
};

if (isStripeConfigured()) {
  stripeClient = stripeLib(process.env.STRIPE_SECRET_KEY);
  console.log('Stripe Client initialized.');
} else {
  console.warn('Stripe credentials missing or placeholder. Running in Mock Stripe Mode.');
}

/**
 * Razorpay: Create Order
 */
const createRazorpayOrder = async (paymentId, amount) => {
  if (razorpayClient) {
    try {
      const options = {
        amount: Math.round(amount * 100), // Razorpay amount in paise
        currency: 'USD',
        receipt: paymentId.toString(),
        payment_capture: 1
      };
      const order = await razorpayClient.orders.create(options);
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        gateway: 'razorpay'
      };
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      throw error;
    }
  } else {
    // Return mock order details
    return {
      id: `order_mock_${Math.random().toString(36).substring(2, 12)}`,
      amount: Math.round(amount * 100),
      currency: 'USD',
      receipt: paymentId.toString(),
      gateway: 'razorpay',
      mock: true
    };
  }
};

/**
 * Razorpay: Verify Signature
 */
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  if (razorpayClient) {
    const crypto = require('crypto');
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + '|' + paymentId)
      .digest('hex');
    
    return generated_signature === signature;
  } else {
    // If running in mock, check if signature has 'mock_sig' or is non-empty
    return signature !== '';
  }
};

/**
 * Stripe: Create Payment Intent
 */
const createStripePaymentIntent = async (paymentId, amount, customerEmail) => {
  if (stripeClient) {
    try {
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe in cents
        currency: 'usd',
        receipt_email: customerEmail,
        metadata: { paymentId: paymentId.toString() }
      });
      return {
        clientSecret: paymentIntent.client_secret,
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        gateway: 'stripe'
      };
    } catch (error) {
      console.error('Stripe payment intent creation failed:', error);
      throw error;
    }
  } else {
    return {
      clientSecret: `pi_mock_secret_${Math.random().toString(36).substring(2, 12)}`,
      id: `pi_mock_${Math.random().toString(36).substring(2, 12)}`,
      amount: Math.round(amount * 100),
      gateway: 'stripe',
      mock: true
    };
  }
};

/**
 * Stripe: Verify Webhook Event
 */
const verifyStripeWebhook = (rawBody, sigHeader) => {
  if (stripeClient && process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      const event = stripeClient.webhooks.constructEvent(
        rawBody,
        sigHeader,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (error) {
      console.error('Stripe webhook verification failed:', error.message);
      return null;
    }
  }
  // Mock mode
  return null;
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpaySignature,
  createStripePaymentIntent,
  verifyStripeWebhook,
  isRazorpayConfigured,
  isStripeConfigured
};
