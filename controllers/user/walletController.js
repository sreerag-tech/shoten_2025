const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");
const PaymentService = require("../../services/paymentService");
const Razorpay = require('razorpay');

// Initialize Razorpay with test credentials from PaymentService
let razorpayInstance;
try {
    // Use test credentials from PaymentService
    const key_id = 'rzp_test_Zpv4ywJzGpBcv1';
    const key_secret = 'uvnqgnUDOKybYqB2bRdlRsd9';

    if (!key_id || !key_secret) {
        console.warn('Razorpay test credentials not available. Wallet top-up functionality will be disabled.');
        razorpayInstance = null;
    } else {
        razorpayInstance = new Razorpay({
            key_id: key_id,
            key_secret: key_secret
        });
        console.log('Razorpay initialized successfully with test credentials');
    }
} catch (error) {
    console.error('Error initializing Razorpay:', error);
    razorpayInstance = null;
}

// Helper function to check if Razorpay is available
const isRazorpayAvailable = () => {
    return razorpayInstance !== null;
};

// Load Wallet Page
const loadWallet = async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Get or create wallet for user
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = new Wallet({ user: userId, balance: 0 });
      await wallet.save();
    }

    // Get user details
    const user = await User.findById(userId);

    // Get transaction history with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const totalTransactions = wallet.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);
    
    const transactions = wallet.transactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + limit);

    res.render("wallet", {
      user: user,
      wallet: wallet,
      transactions: transactions,
      currentPage: page,
      totalPages: totalPages,
      totalTransactions: totalTransactions
    });
  } catch (error) {
    res.status(500).render("pageNotFound");
  }
};

// Create Razorpay Order for Wallet Top-up
const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { amount } = req.body;

        // Validate amount
        const addAmount = parseFloat(amount);
        if (!addAmount || addAmount <= 0 || addAmount > 5000000) { // Amount in paise (₹50,000 max)
            return res.status(400).json({ 
                success: false, 
                message: 'Please enter a valid amount between ₹1 and ₹50,000' 
            });
        }

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check if Razorpay is available
        if (!isRazorpayAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Razorpay payment gateway is currently unavailable. Please try again later.'
            });
        }

        try {
            // Create Razorpay order
            const order = await razorpayInstance.orders.create({
                amount: addAmount, // Amount in paise
                currency: 'INR',
                receipt: `WALLET_${Date.now()}`,
                payment_capture: 1
            });

            // Return order details
            res.json({
                success: true,
                key_id: razorpayInstance.key_id,
                amount: order.amount,
                currency: order.currency,
                order_id: order.id,
                user: {
                    name: user.name,
                    email: user.email,
                    phone: user.phone
                }
            });

        } catch (razorpayError) {
            console.error('Razorpay order creation failed:', razorpayError);
            return res.status(500).json({
                success: false,
                message: 'Failed to create payment request. Please try again later.'
            });
        }

    } catch (error) {
        console.error('Error in createRazorpayOrder:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error. Please try again later.' 
        });
    }
};

// Verify Razorpay Payment for Wallet Top-up
const verifyPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // Validate required parameters
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment details'
            });
        }

        // Check if Razorpay is available
        if (!isRazorpayAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Razorpay payment gateway is currently unavailable. Please try again later.'
            });
        }

        try {
            // Verify payment signature
            const isValid = await PaymentService.verifyPaymentSignature({
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            });

            if (!isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment signature'
                });
            }

            // Get payment details
            const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);
            if (payment.status !== 'captured') {
                return res.status(400).json({
                    success: false,
                    message: 'Payment not captured'
                });
            }

            // Get order details
            const order = await razorpayInstance.orders.fetch(razorpay_order_id);
            if (order.status !== 'paid') {
                return res.status(400).json({
                    success: false,
                    message: 'Order not paid'
                });
            }

            // Convert amount from paise to rupees
            const amount = order.amount / 100;

            // Add money to wallet
            let wallet = await Wallet.findOne({ user: userId });
            if (!wallet) {
                wallet = new Wallet({ user: userId, balance: 0 });
                await wallet.save();
            }

            try {
                await wallet.addMoney(
                    amount,
                    `Money added to wallet via Razorpay`,
                    null,
                    razorpay_payment_id
                );

                res.json({
                    success: true,
                    message: `₹${amount.toLocaleString()} added to your wallet successfully`,
                    newBalance: wallet.balance
                });

            } catch (walletError) {
                console.error('Error adding money to wallet:', walletError);
                // Rollback payment if wallet update fails
                try {
                    await razorpayInstance.refunds.create({
                        payment_id: razorpay_payment_id,
                        amount: order.amount // Amount in paise
                    });
                } catch (refundError) {
                    console.error('Error refunding payment:', refundError);
                }
                
                return res.status(500).json({
                    success: false,
                    message: 'Failed to add money to wallet. Payment has been refunded.'
                });
            }

        } catch (razorpayError) {
            console.error('Razorpay verification failed:', razorpayError);
            return res.status(500).json({
                success: false,
                message: 'Payment verification failed. Please contact support.'
            });
        }

    } catch (error) {
        console.error('Error in verifyPayment:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error. Please try again later.' 
        });
    }
};

// Add Money to Wallet (legacy endpoint - keep for backward compatibility)
const addMoney = async (req, res) => {
  try {
    const userId = req.session.user;
    const { amount } = req.body;

    // Validate amount
    const addAmount = parseFloat(amount);
    if (!addAmount || addAmount <= 0 || addAmount > 50000) {
      return res.json({ 
        success: false, 
        message: 'Please enter a valid amount between ₹1 and ₹50,000' 
      });
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = new Wallet({ user: userId, balance: 0 });
    }

    // Add money to wallet
    await wallet.addMoney(
      addAmount, 
      `Money added to wallet`, 
      null, 
      `TXN${Date.now()}`
    );

    res.json({ 
      success: true, 
      message: `₹${addAmount.toLocaleString()} added to your wallet successfully`,
      newBalance: wallet.balance
    });
  } catch (error) {
    res.json({ success: false, message: 'Failed to add money to wallet' });
  }
};

// Get Wallet Balance
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.session.user;
    
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = new Wallet({ user: userId, balance: 0 });
      await wallet.save();
    }

    res.json({ 
      success: true, 
      balance: wallet.balance 
    });
  } catch (error) {
    res.json({ success: false, message: 'Failed to get wallet balance' });
  }
};

// Get Transaction History API
const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.json({ 
        success: true, 
        transactions: [], 
        totalPages: 0, 
        currentPage: page 
      });
    }

    const totalTransactions = wallet.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);
    
    const transactions = wallet.transactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + limit);

    res.json({
      success: true,
      transactions: transactions,
      totalPages: totalPages,
      currentPage: page,
      totalTransactions: totalTransactions
    });
  } catch (error) {
    res.json({ success: false, message: 'Failed to get transaction history' });
  }
};

// Use Wallet for Payment (for checkout)
const useWalletForPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const { amount, orderId, description } = req.body;

        // Validate inputs
        if (!userId || !amount || !orderId) {
            return res.json({ success: false, message: 'Missing required fields' });
        }

        if (isNaN(amount) || amount <= 0) {
            return res.json({ success: false, message: 'Invalid amount' });
        }

        // Fetch wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0 });
            await wallet.save();
        }

        // Use deductMoney method
        try {
            await wallet.deductMoney(amount, description || `Payment for order #${orderId}`, orderId);
        } catch (error) {
            return res.json({ success: false, message: error.message || 'Failed to deduct wallet balance' });
        }

        return res.json({
            success: true,
            message: 'Payment successful',
            newBalance: wallet.balance
        });
    } catch (error) {
        console.error('Error in useWalletForPayment:', error);
        return res.json({ success: false, message: 'Failed to process wallet payment: ' + error.message });
    }
};

module.exports = {
  loadWallet,
  addMoney,
  getWalletBalance,
  getTransactionHistory,
  useWalletForPayment,
  createRazorpayOrder,
  verifyPayment
};
