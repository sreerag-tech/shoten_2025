  const crypto = require('crypto');

  // Try to load Razorpay, fallback if not available
  let Razorpay, razorpay;
  try {
    Razorpay = require('razorpay');

    // Check if credentials are available
    const key_id = 'rzp_test_Zpv4ywJzGpBcv1';
    const key_secret = 'uvnqgnUDOKybYqB2bRdlRsd9';

    if (!key_id || !key_secret) {
      throw new Error('Razorpay credentials not found');
    }

    // Initialize Razorpay instance
    razorpay = new Razorpay({
      key_id: key_id,
      key_secret: key_secret
    });

    console.log('Razorpay initialized successfully with key:', key_id);

  } catch (error) {
    console.error('Razorpay initialization failed:', error.message);
    Razorpay = null;
    razorpay = null;
  }

  class PaymentService {
    
    // Create Razorpay order
    static async createRazorpayOrder(orderData) {
      try {
        // Check if Razorpay is initialized
        if (!razorpay) {
          console.error('Razorpay not initialized');
          return {
            success: false,
            error: 'Payment service not available'
          };
        }

        // Validate required data
        if (!orderData.totalAmount || orderData.totalAmount <= 0) {
          console.error('Invalid total amount:', orderData.totalAmount);
          return {
            success: false,
            error: 'Invalid order amount'
          };
        }

        const options = {
          amount: Math.round(orderData.totalAmount * 100), // Amount in paise
          currency: 'INR',
          receipt: `order_${orderData.orderId}`,
          notes: {
            orderId: orderData.orderId,
            userId: orderData.userId,
            customerName: orderData.customerName || 'Customer',
            customerEmail: orderData.customerEmail || 'customer@example.com'
          }
        };

        console.log('Creating Razorpay order with options:', JSON.stringify(options, null, 2));

        const razorpayOrder = await razorpay.orders.create(options);

        console.log('Razorpay order created successfully:', razorpayOrder.id);

        return {
          success: true,
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt
        };

      } catch (error) {
        console.error('Error creating Razorpay order:', error);
        console.error('Error details:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error
        });

        return {
          success: false,
          error: error.message || 'Failed to create payment order'
        };
      }
    }

    // Verify Razorpay payment signature
    static verifyPaymentSignature(paymentData) {
      try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
        
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac('sha256', 'uvnqgnUDOKybYqB2bRdlRsd9')
          .update(body.toString())
          .digest('hex');

        return expectedSignature === razorpay_signature;
      } catch (error) {
        console.error('Error verifying payment signature:', error);
        return false;
      }
    }

    // Get payment details from Razorpay
    static async getPaymentDetails(paymentId) {
      try {
        const payment = await razorpay.payments.fetch(paymentId);
        return {
          success: true,
          payment: payment
        };
      } catch (error) {
        console.error('Error fetching payment details:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }

    // Create refund
    static async createRefund(paymentId, amount, reason = 'Order cancellation') {
      try {
        const refund = await razorpay.payments.refund(paymentId, {
          amount: Math.round(amount * 100), // Amount in paise
          notes: {
            reason: reason,
            refund_type: 'order_cancellation'
          }
        });

        return {
          success: true,
          refund: refund
        };
      } catch (error) {
        console.error('Error creating refund:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }

    // Process wallet refund (for COD orders or additional refunds)
    static async processWalletRefund(userId, amount, reason, orderId) {
      try {
        const User = require('../models/userSchema');
        
        const user = await User.findById(userId);
        if (!user) {
          return { success: false, error: 'User not found' };
        }

        // Add amount to user's wallet
        user.wallet = (user.wallet || 0) + amount;
        await user.save();

        // Create wallet transaction record (if you have a transaction model)
        // This is optional - you can implement a transaction history model

        return {
          success: true,
          newWalletBalance: user.wallet,
          refundAmount: amount
        };

      } catch (error) {
        console.error('Error processing wallet refund:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }

    // Generate payment options for frontend
    static generatePaymentOptions(orderData, razorpayOrderId) {
      return {
        key: 'rzp_test_Zpv4ywJzGpBcv1',
        amount: Math.round (orderData.totalAmount * 100),
        currency: 'INR',
        name: 'Shoten',
        description: `Order #${orderData.orderId}`,
        image: '/images/logo.png', // Add your logo path
        order_id: razorpayOrderId,
        handler: function(response) {
          // This will be handled by frontend JavaScript
        },
        prefill: {
          name: orderData.customerName,
          email: orderData.customerEmail,
          contact: orderData.customerPhone || ''
        },
        notes: {
          orderId: orderData.orderId,
          userId: orderData.userId
        },
        theme: {
          color: '#667eea'
        },
        modal: {
          ondismiss: function() {
            // Handle payment modal dismissal
          }
        }
      };
    }

    // Validate payment amount
    static validatePaymentAmount(orderAmount, paidAmount) {
      const orderAmountPaise = Math.round(orderAmount * 100);
      return orderAmountPaise === paidAmount;
    }

    // Get payment method from Razorpay payment
    static getPaymentMethod(paymentDetails) {
      if (!paymentDetails || !paymentDetails.method) {
        return 'Unknown';
      }

      const methodMap = {
        'card': 'Credit/Debit Card',
        'netbanking': 'Net Banking',
        'wallet': 'Wallet',
        'upi': 'UPI',
        'emi': 'EMI',
        'paylater': 'Pay Later'
      };

      return methodMap[paymentDetails.method] || paymentDetails.method;
    }

    // Check if refund is possible
    static canRefund(paymentDetails, orderDate) {
      try {
        // Check if payment was successful
        if (!paymentDetails || paymentDetails.status !== 'captured') {
          return { canRefund: false, reason: 'Payment not captured' };
        }

        // Check refund time limit (usually 180 days for Razorpay)
        const refundTimeLimit = 180 * 24 * 60 * 60 * 1000; // 180 days in milliseconds
        const timeSinceOrder = Date.now() - new Date(orderDate).getTime();

        if (timeSinceOrder > refundTimeLimit) {
          return { canRefund: false, reason: 'Refund time limit exceeded' };
        }

        return { canRefund: true };

      } catch (error) {
        console.error('Error checking refund eligibility:', error);
        return { canRefund: false, reason: 'Error checking refund eligibility' };
      }
    }
  }

  module.exports = PaymentService;
