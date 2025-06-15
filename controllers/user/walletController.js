const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");

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

// Add Money to Wallet
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

    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return res.json({ success: false, message: 'Invalid payment amount' });
    }

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet || wallet.balance < paymentAmount) {
      return res.json({ 
        success: false, 
        message: 'Insufficient wallet balance' 
      });
    }

    // Deduct money from wallet
    await wallet.deductMoney(
      paymentAmount, 
      description || `Payment for order #${orderId}`, 
      orderId
    );

    res.json({ 
      success: true, 
      message: 'Payment successful',
      newBalance: wallet.balance
    });
  } catch (error) {
    res.json({ success: false, message: error.message || 'Payment failed' });
  }
};

module.exports = {
  loadWallet,
  addMoney,
  getWalletBalance,
  getTransactionHistory,
  useWalletForPayment
};
