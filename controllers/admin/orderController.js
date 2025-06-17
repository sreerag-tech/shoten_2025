const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");

// Load Orders Page with Search, Sort, Filter, and Pagination
const loadOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    // Search parameters
    const search = req.query.search || "";
    const status = req.query.status || "";
    const sortBy = req.query.sortBy || "createdOn";
    const sortOrder = req.query.sortOrder || "desc";
    const dateFrom = req.query.dateFrom || "";
    const dateTo = req.query.dateTo || "";

    // Build query object
    let query = {};

    // Search by order ID or user name/email
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      }).select('_id');
      
      const userIds = users.map(user => user._id);
      
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { userId: { $in: userIds } }
      ];
    }

    // Filter by status
    if (status) {
      if (status === 'Returned') {
        // Special handling for returned items - filter by item status
        query['orderedItems.status'] = 'Returned';
      } else {
        // Regular order status filter
        query.status = status;
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdOn = {};
      if (dateFrom) {
        query.createdOn.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdOn.$lte = endDate;
      }
    }

    // Sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate('userId', 'name email phone')
      .populate('orderedItems.product', 'productName productImage')
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalPrice" }
        }
      }
    ]);

    res.render("admin-orders", {
      orders: orders,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      search: search,
      status: status,
      sortBy: sortBy,
      sortOrder: sortOrder,
      dateFrom: dateFrom,
      dateTo: dateTo,
      orderStats: orderStats,
      activePage: 'orders'
    });
  } catch (error) {
    console.error('Error loading orders:', error);
    res.redirect("/admin/pageerror");
  }
};

// Load Order Detail Page
const loadOrderDetail = async (req, res) => {
  try {
    const orderId = req.params.id;
    
    const order = await Order.findById(orderId)
      .populate('userId', 'name email phone profileImage')
      .populate('orderedItems.product', 'productName productImage regularPrice salePrice');

    if (!order) {
      return res.redirect("/admin/orders?error=Order not found");
    }

    res.render("admin-order-detail", {
      order: order,
      activePage: 'orders'
    });
  } catch (error) {
    console.error('Error loading order detail:', error);
    res.redirect("/admin/orders?error=Failed to load order details");
  }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

    if (!validStatuses.includes(status)) {
      return res.json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    // Validate status transitions
    const currentStatus = order.status;

    // Cannot change status if order is already delivered or cancelled
    if (currentStatus === 'Delivered') {
      return res.json({ success: false, message: 'Cannot change status of delivered order' });
    }

    if (currentStatus === 'Cancelled') {
      return res.json({ success: false, message: 'Cannot change status of cancelled order' });
    }

    // Validate logical status progression
    const statusOrder = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const newIndex = statusOrder.indexOf(status);

    // Allow cancellation from any status except delivered
    if (status === 'Cancelled') {
      // Allow cancellation
    } else if (newIndex < currentIndex && status !== 'Processing') {
      return res.json({ success: false, message: 'Cannot move order backwards in status' });
    }

    // Update order status
    order.status = status;

    // Update all items status if order status is changed
    order.orderedItems.forEach(item => {
      if (item.status !== 'Cancelled' && item.status !== 'Returned' && item.status !== 'Return Request') {
        item.status = status;
      }
    });

    await order.save();

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.json({ success: false, message: 'Failed to update order status' });
  }
};

// Update Individual Item Status
const updateItemStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const itemIndex = parseInt(req.params.itemIndex);
    const { status } = req.body;

    const validStatuses = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

    if (!validStatuses.includes(status)) {
      return res.json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findById(orderId);
    if (!order || !order.orderedItems[itemIndex]) {
      return res.json({ success: false, message: 'Order or item not found' });
    }

    const item = order.orderedItems[itemIndex];
    const currentStatus = item.status;

    // Validate status transitions for individual items
    if (currentStatus === 'Delivered') {
      return res.json({ success: false, message: 'Cannot change status of delivered item' });
    }

    if (currentStatus === 'Cancelled') {
      return res.json({ success: false, message: 'Cannot change status of cancelled item' });
    }

    if (currentStatus === 'Returned') {
      return res.json({ success: false, message: 'Cannot change status of returned item' });
    }

    // Update item status
    order.orderedItems[itemIndex].status = status;

    // Update overall order status based on items
    const itemStatuses = order.orderedItems.map(item => item.status);
    if (itemStatuses.every(s => s === 'Delivered')) {
      order.status = 'Delivered';
    } else if (itemStatuses.every(s => s === 'Cancelled')) {
      order.status = 'Cancelled';
    } else if (itemStatuses.some(s => s === 'Shipped' || s === 'Out for Delivery')) {
      order.status = 'Shipped';
    } else if (itemStatuses.some(s => s === 'Processing')) {
      order.status = 'Processing';
    }

    await order.save();

    res.json({ success: true, message: 'Item status updated successfully' });
  } catch (error) {
    console.error('Error updating item status:', error);
    res.json({ success: false, message: 'Failed to update item status' });
  }
};

// Handle Return Request Verification
const handleReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;
    const itemIndex = parseInt(req.params.itemIndex);
    const { action, adminResponse } = req.body; // action: 'approve' or 'reject'

    const order = await Order.findById(orderId).populate('userId');
    if (!order || !order.orderedItems[itemIndex]) {
      return res.json({ success: false, message: 'Order or item not found' });
    }

    const item = order.orderedItems[itemIndex];

    if (item.status !== 'Return Request') {
      return res.json({ success: false, message: 'No return request found for this item' });
    }

    if (action === 'approve') {
      // Approve return request
      item.status = 'Returned';
      item.adminResponse = adminResponse || 'Return request approved';

      // Add refund amount to user's wallet using proper Wallet schema
      const refundAmount = item.price * item.quantity;

      // Get or create wallet for user
      let wallet = await Wallet.findOne({ user: order.userId._id });
      if (!wallet) {
        wallet = new Wallet({ user: order.userId._id, balance: 0 });
      }

      // Add refund to wallet with transaction log
      await wallet.addMoney(
        refundAmount,
        `Refund for returned item: ${item.product?.productName || 'Product'} (Order: ${order.orderId})`,
        order._id,
        `REFUND-${Date.now()}`
      );

      // Also update user.wallet for backward compatibility
      const user = await User.findById(order.userId._id);
      user.wallet = (user.wallet || 0) + refundAmount;
      await user.save();

      // Restore product stock
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }

      await order.save();

      res.json({
        success: true,
        message: `Return approved. ₹${refundAmount.toLocaleString()} added to user's wallet.`,
        refundAmount: refundAmount
      });
    } else if (action === 'reject') {
      // Reject return request - revert to delivered status
      item.status = 'Delivered';
      item.adminResponse = adminResponse || 'Return request rejected';

      await order.save();

      res.json({
        success: true,
        message: 'Return request rejected successfully'
      });
    } else {
      res.json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error handling return request:', error);
    res.json({ success: false, message: 'Failed to process return request' });
  }
};

// Get Return Requests
const getReturnRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Find orders with return requests
    const orders = await Order.find({
      'orderedItems.status': 'Return Request'
    })
    .populate('userId', 'name email phone')
    .populate('orderedItems.product', 'productName productImage')
    .sort({ createdOn: -1 })
    .skip(skip)
    .limit(limit);

    // Filter items to show only return requests
    const returnRequests = [];
    orders.forEach(order => {
      order.orderedItems.forEach((item, index) => {
        if (item.status === 'Return Request') {
          returnRequests.push({
            order: order,
            item: item,
            itemIndex: index
          });
        }
      });
    });

    const totalRequests = await Order.aggregate([
      { $unwind: '$orderedItems' },
      { $match: { 'orderedItems.status': 'Return Request' } },
      { $count: 'total' }
    ]);

    const totalPages = Math.ceil((totalRequests[0]?.total || 0) / limit);

    res.render("return-requests", {
      returnRequests: returnRequests,
      currentPage: page,
      totalPages: totalPages,
      activePage: 'orders'
    });
  } catch (error) {
    console.error('Error loading return requests:', error);
    res.redirect("/admin/pageerror");
  }
};

// Get Order Details API (for modal)
const getOrderDetailsAPI = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate('userId', 'name email phone')
      .populate('orderedItems.product', 'productName productImage regularPrice salePrice');

    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order: order });
  } catch (error) {
    res.json({ success: false, message: 'Failed to fetch order details' });
  }
};

module.exports = {
  loadOrders,
  loadOrderDetail,
  updateOrderStatus,
  updateItemStatus,
  handleReturnRequest,
  getReturnRequests,
  getOrderDetailsAPI
};
