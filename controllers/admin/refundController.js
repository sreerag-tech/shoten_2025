const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");

// Load refund history page
const loadRefundHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const dateFrom = req.query.dateFrom || '';
    const dateTo = req.query.dateTo || '';

    // Build query for refunds
    let query = {
      $or: [
        { refundAmount: { $gt: 0 } },
        { refundStatus: { $ne: 'None' } }
      ]
    };

    // Add search filter
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { orderId: { $regex: search, $options: 'i' } },
          { 'userId.name': { $regex: search, $options: 'i' } },
          { 'userId.email': { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Add status filter
    if (status) {
      query.refundStatus = status;
    }

    // Add date range filter
    if (dateFrom || dateTo) {
      query.refundDate = {};
      if (dateFrom) {
        query.refundDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.refundDate.$lte = endDate;
      }
    }

    // Get refund data with pagination
    const totalRefunds = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalRefunds / limit);
    const skip = (page - 1) * limit;

    const refunds = await Order.find(query)
      .populate('userId', 'name email phone')
      .populate('orderedItems.product', 'productName')
      .sort({ refundDate: -1, createdOn: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate refund statistics
    const stats = await getRefundStatistics();

    res.render("admin-refund-history", {
      refunds,
      currentPage: page,
      totalPages,
      totalRefunds,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      stats,
      search,
      status,
      dateFrom,
      dateTo,
      activePage: 'refund-history'
    });

  } catch (error) {
    console.error('Error loading refund history:', error);
    res.redirect("/admin/pageerror");
  }
};

// Get refund statistics
const getRefundStatistics = async () => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Total refunds
    const totalRefunds = await Order.countDocuments({
      refundAmount: { $gt: 0 }
    });

    // Total refund amount
    const totalRefundAmountResult = await Order.aggregate([
      { $match: { refundAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$refundAmount" } } }
    ]);
    const totalRefundAmount = totalRefundAmountResult[0]?.total || 0;

    // Monthly refunds
    const monthlyRefunds = await Order.countDocuments({
      refundAmount: { $gt: 0 },
      refundDate: { $gte: startOfMonth }
    });

    // Monthly refund amount
    const monthlyRefundAmountResult = await Order.aggregate([
      { 
        $match: { 
          refundAmount: { $gt: 0 },
          refundDate: { $gte: startOfMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: "$refundAmount" } } }
    ]);
    const monthlyRefundAmount = monthlyRefundAmountResult[0]?.total || 0;

    // Refund status breakdown
    const statusBreakdown = await Order.aggregate([
      { $match: { refundAmount: { $gt: 0 } } },
      { $group: { _id: "$refundStatus", count: { $sum: 1 } } }
    ]);

    // Recent refunds (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentRefunds = await Order.countDocuments({
      refundAmount: { $gt: 0 },
      refundDate: { $gte: sevenDaysAgo }
    });

    return {
      totalRefunds,
      totalRefundAmount,
      monthlyRefunds,
      monthlyRefundAmount,
      recentRefunds,
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };

  } catch (error) {
    console.error('Error getting refund statistics:', error);
    return {
      totalRefunds: 0,
      totalRefundAmount: 0,
      monthlyRefunds: 0,
      monthlyRefundAmount: 0,
      recentRefunds: 0,
      statusBreakdown: {}
    };
  }
};

// Get refund details
const getRefundDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('userId', 'name email phone')
      .populate('orderedItems.product', 'productName productImage');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Get wallet transactions related to this order
    const wallet = await Wallet.findOne({ user: order.userId._id });
    const relatedTransactions = wallet ? 
      wallet.transactions.filter(t => t.orderId && t.orderId.toString() === orderId) : [];

    res.json({
      success: true,
      data: {
        order,
        walletTransactions: relatedTransactions
      }
    });

  } catch (error) {
    console.error('Error getting refund details:', error);
    res.status(500).json({ success: false, message: 'Error getting refund details' });
  }
};

// Export refund data
const exportRefundData = async (req, res) => {
  try {
    const { format, dateFrom, dateTo, status } = req.query;

    // Build query
    let query = {
      refundAmount: { $gt: 0 }
    };

    if (status) {
      query.refundStatus = status;
    }

    if (dateFrom || dateTo) {
      query.refundDate = {};
      if (dateFrom) {
        query.refundDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.refundDate.$lte = endDate;
      }
    }

    const refunds = await Order.find(query)
      .populate('userId', 'name email phone')
      .populate('orderedItems.product', 'productName')
      .sort({ refundDate: -1 });

    if (format === 'excel') {
      // Excel export logic would go here
      res.json({ success: true, message: 'Excel export functionality to be implemented' });
    } else {
      // CSV export
      const csvData = refunds.map(order => ({
        'Order ID': order.orderId,
        'Customer Name': order.userId?.name || 'N/A',
        'Customer Email': order.userId?.email || 'N/A',
        'Refund Amount': order.refundAmount,
        'Refund Status': order.refundStatus,
        'Refund Date': order.refundDate ? order.refundDate.toLocaleDateString() : 'N/A',
        'Order Date': order.createdOn.toLocaleDateString(),
        'Payment Method': order.paymentMethod
      }));

      res.json({ success: true, data: csvData });
    }

  } catch (error) {
    console.error('Error exporting refund data:', error);
    res.status(500).json({ success: false, message: 'Error exporting refund data' });
  }
};

module.exports = {
  loadRefundHistory,
  getRefundDetails,
  exportRefundData
};
