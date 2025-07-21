const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const offerService = require("../../services/offerService");
const refundCalculationService = require("../../services/refundCalculationService");

// Helper function to calculate order status based on item statuses
const calculateOrderStatus = (order) => {
  if (!order.orderedItems || order.orderedItems.length === 0) {
    return order.status;
  }

  const itemStatuses = order.orderedItems.map(item => item.status);
  const uniqueStatuses = [...new Set(itemStatuses)];

  // If all items are cancelled, order is cancelled
  if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'Cancelled') {
    return 'Cancelled';
  }

  // If all items are delivered, order is delivered
  if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'Delivered') {
    return 'Delivered';
  }

  // If all items are returned, keep order as delivered (since returns happen after delivery)
  if (uniqueStatuses.length === 1 && uniqueStatuses[0] === 'Returned') {
    return 'Delivered';
  }

  // If mix of statuses, return the main order status
  return order.status;
};

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

    // Ensure latest orders are shown first by default
    const defaultSort = { createdOn: -1, _id: -1 }; // Add _id as secondary sort for consistency

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

    // Sort object - use custom sort if specified, otherwise use default (latest first)
    let sortObj;
    if (req.query.sortBy || req.query.sortOrder) {
      // Custom sort specified
      sortObj = {};
      sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;
      // Add secondary sort for consistency
      if (sortBy !== 'createdOn') {
        sortObj.createdOn = -1;
      }
      if (sortBy !== '_id') {
        sortObj._id = -1;
      }
    } else {
      // Use default sort (latest first)
      sortObj = defaultSort;
    }

    // Get orders with pagination
    const ordersRaw = await Order.find(query)
      .populate('userId', 'name email phone')
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage regularPrice salePrice category',
        populate: {
          path: 'category',
          model: 'Category',
          select: 'name'
        }
      })
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    // Use original order data (prices already include offers applied at order time)
    const orders = ordersRaw.map(order => {
      const orderedItemsWithDetails = order.orderedItems.map(item => {
        return {
          ...item.toObject(),
          finalPrice: item.price, // This already includes any offers that were applied
          itemTotal: item.price * item.quantity
        };
      });

      // Use the original stored totals from when the order was placed
      const subtotal = order.totalPrice; // Original subtotal
      const shippingCharge = order.shippingCharge || 0;
      const discount = order.discount || 0;

      // Calculate correct final total: subtotal + shipping - discount
      const finalTotal = subtotal + shippingCharge - discount;

      return {
        ...order.toObject(),
        orderedItems: orderedItemsWithDetails,
        subtotal: subtotal,
        shippingCharge: shippingCharge,
        discount: discount,
        finalTotal: finalTotal
      };
    });

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    // Get order statistics using original order amounts
    const allOrdersForStats = await Order.find();

    const orderStatsByStatus = {};

    for (const order of allOrdersForStats) {
      // Use original stored totals: subtotal + shipping - discount
      const orderTotal = (order.totalPrice || 0) + (order.shippingCharge || 0) - (order.discount || 0);

      // Group by status
      if (!orderStatsByStatus[order.status]) {
        orderStatsByStatus[order.status] = {
          _id: order.status,
          count: 0,
          totalAmount: 0
        };
      }

      orderStatsByStatus[order.status].count += 1;
      orderStatsByStatus[order.status].totalAmount += orderTotal;
    }

    const orderStats = Object.values(orderStatsByStatus);

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
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage regularPrice salePrice category',
        populate: {
          path: 'category',
          model: 'Category',
          select: 'name'
        }
      });

    if (!order) {
      return res.redirect("/admin/orders?error=Order not found");
    }

    // Use original order data (prices already include offers applied at order time)
    const orderedItemsWithDetails = order.orderedItems.map(item => {
      return {
        ...item.toObject(),
        finalPrice: item.price, // This already includes any offers that were applied
        itemTotal: item.price * item.quantity
      };
    });

    // Use the original stored totals from when the order was placed
    const subtotal = order.totalPrice; // Original subtotal
    const shippingCharge = order.shippingCharge || 0;
    const discount = order.discount || 0;

    // Calculate correct final total: subtotal + shipping - discount
    const finalTotal = subtotal + shippingCharge - discount;

    // Create order object with correct calculations
    const orderWithCorrectTotals = {
      ...order.toObject(),
      orderedItems: orderedItemsWithDetails,
      subtotal: subtotal,
      shippingCharge: shippingCharge,
      discount: discount,
      finalTotal: finalTotal
    };

    res.render("admin-order-detail", {
      order: orderWithCorrectTotals,
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

    const validStatuses = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Payment Failed'];

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
    const statusOrder = ['Payment Failed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const newIndex = statusOrder.indexOf(status);

    // Allow cancellation from any status except delivered
    if (status === 'Cancelled') {
      // Allow cancellation
    } else if (status === 'Processing' && currentStatus === 'Payment Failed') {
      // Allow moving from Payment Failed to Processing (after retry payment)
    } else if (newIndex < currentIndex && status !== 'Processing') {
      return res.json({ success: false, message: 'Cannot move order backwards in status' });
    }

    // Update order status
    order.status = status;

    // Set delivered date when status is changed to Delivered
    if (status === 'Delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    // Update all items status if order status is changed
    if (status === 'Cancelled') {
      // If cancelling order, cancel all non-returned items and process refunds
      let totalRefundAmount = 0;

      order.orderedItems.forEach(item => {
        if (item.status !== 'Returned' && item.status !== 'Cancelled') {
          item.status = 'Cancelled';
          item.cancelReason = 'Cancelled by admin';
          item.cancelledAt = new Date();
          totalRefundAmount += item.price * item.quantity;
        }
      });

      // Process wallet refund if payment was completed
      if (order.paymentStatus === 'Completed' && totalRefundAmount > 0) {
        try {
          const User = require("../../models/userSchema");
          const Wallet = require("../../models/walletSchema");

          // Add refund to user's wallet
          const user = await User.findById(order.userId);
          if (user) {
            user.wallet = (user.wallet || 0) + totalRefundAmount;
            await user.save();

            // Create wallet transaction record
            try {
              const wallet = await Wallet.findOne({ userId: order.userId });
              if (wallet) {
                await wallet.addMoney(
                  totalRefundAmount,
                  `Admin cancelled order refund: ${order.orderId}`,
                  order._id,
                  `ADMIN-CANCEL-${Date.now()}`
                );
              }
            } catch (walletError) {
              console.log('Wallet transaction record creation failed:', walletError);
            }
          }

          // Update order with refund information
          order.refundStatus = 'Completed';
          order.refundAmount = totalRefundAmount;
          order.refundDate = new Date();

        } catch (refundError) {
          console.error('Error processing admin cancellation refund:', refundError);
        }
      }

      order.cancelReason = 'Cancelled by admin';
      order.cancelledAt = new Date();

    } else {
      // For other status updates, only update items that aren't cancelled or returned
      order.orderedItems.forEach(item => {
        if (item.status !== 'Cancelled' && item.status !== 'Returned' && item.status !== 'Return Request') {
          item.status = status;
        }
      });
    }

    await order.save();

    // Recalculate and update order status based on item statuses
    const calculatedStatus = calculateOrderStatus(order);
    if (calculatedStatus !== order.status) {
      order.status = calculatedStatus;
      await order.save();
    }

    const message = order.refundAmount > 0 ?
      `Order status updated successfully. ₹${order.refundAmount.toLocaleString()} refunded to user's wallet.` :
      'Order status updated successfully';

    res.json({ success: true, message: message });
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

    const validStatuses = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Payment Failed'];

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

    // Set delivered date when item status is changed to Delivered
    if (status === 'Delivered' && !order.deliveredAt) {
      // Check if all items are delivered
      const allItemsDelivered = order.orderedItems.every(item =>
        item.status === 'Delivered' || item.status === 'Cancelled' || item.status === 'Returned'
      );

      if (allItemsDelivered) {
        order.deliveredAt = new Date();
      }
    }

    // If cancelling item, process refund
    if (status === 'Cancelled' && order.paymentStatus === 'Completed') {
      const refundAmount = item.price * item.quantity;

      try {
        const User = require("../../models/userSchema");
        const Wallet = require("../../models/walletSchema");

        // Add refund to user's wallet
        const user = await User.findById(order.userId);
        if (user) {
          user.wallet = (user.wallet || 0) + refundAmount;
          await user.save();

          // Create wallet transaction record
          try {
            const wallet = await Wallet.findOne({ userId: order.userId });
            if (wallet) {
              await wallet.addMoney(
                refundAmount,
                `Admin cancelled item refund: ${item.product?.productName || 'Product'} - Order: ${order.orderId}`,
                order._id,
                `ADMIN-CANCEL-ITEM-${Date.now()}`
              );
            }
          } catch (walletError) {
            console.log('Wallet transaction record creation failed:', walletError);
          }
        }

        // Update order with refund information
        order.refundAmount = (order.refundAmount || 0) + refundAmount;
        order.refundStatus = 'Partial';
        order.refundDate = new Date();

        item.cancelReason = 'Cancelled by admin';
        item.cancelledAt = new Date();

      } catch (refundError) {
        console.error('Error processing item cancellation refund:', refundError);
      }
    }

    await order.save();

    // Recalculate and update order status based on item statuses
    const calculatedStatus = calculateOrderStatus(order);
    if (calculatedStatus !== order.status) {
      order.status = calculatedStatus;
      await order.save();
    }

    const message = status === 'Cancelled' && order.paymentStatus === 'Completed' ?
      `Item cancelled successfully. ₹${(item.price * item.quantity).toLocaleString()} refunded to user's wallet.` :
      'Item status updated successfully';

    res.json({ success: true, message: message });
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

      // Calculate refund using proper refund calculation service
      const itemsToRefund = [{
        price: item.price,
        quantity: item.quantity
      }];

      const refundCalculation = refundCalculationService.calculateRefundAmount(order, itemsToRefund);
      const refundAmount = refundCalculation.refundAmount;

      console.log('Admin return approval - Refund calculation:', refundCalculation);

      console.log('=== REFUND CALCULATION ===');
      console.log('Order ID:', order.orderId);
      console.log('Refund calculation details:', refundCalculation);
      console.log('Final refund amount:', refundAmount);
      console.log('=== END ===');

      // Get the product for stock restoration
      const Product = require("../../models/productSchema");
      const product = await Product.findById(item.product);

      // Restore product stock
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }

      // Get or create wallet for user
      let wallet = await Wallet.findOne({ user: order.userId._id });
      if (!wallet) {
        wallet = new Wallet({ user: order.userId._id, balance: 0 });
      }

      // Add refund to wallet with transaction log
      const refundDescription = `Refund for returned item: ${item.product?.productName || 'Product'} - Order: ${order.orderId}`;

      await wallet.addMoney(
        refundAmount,
        refundDescription,
        order._id,
        `REFUND-${Date.now()}`
      );

      // Also update user.wallet for backward compatibility
      const user = await User.findById(order.userId._id);
      user.wallet = (user.wallet || 0) + refundAmount;
      await user.save();

      // Save order with updated item status
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
    .populate({
      path: 'orderedItems.product',
      select: 'productName productImage regularPrice salePrice category',
      populate: {
        path: 'category',
        model: 'Category',
        select: 'name'
      }
    })
    .sort({ createdOn: -1 })
    .skip(skip)
    .limit(limit);

    // Filter items to show only return requests with offer calculations
    const returnRequests = [];
    for (const order of orders) {
      for (let index = 0; index < order.orderedItems.length; index++) {
        const item = order.orderedItems[index];
        if (item.status === 'Return Request') {
          // Calculate the actual refund amount using proper refund calculation service
          const itemsToRefund = [{
            price: item.price,
            quantity: item.quantity
          }];

          const refundCalculation = refundCalculationService.calculateRefundAmount(order, itemsToRefund);
          const actualRefundAmount = refundCalculation.refundAmount;

          returnRequests.push({
            order: order,
            item: {
              ...item.toObject(),
              finalPrice: item.price,
              originalPrice: item.price,
              actualRefundAmount: actualRefundAmount
            },
            itemIndex: index
          });
        }
      }
    }

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
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage regularPrice salePrice category',
        populate: {
          path: 'category',
          model: 'Category',
          select: 'name'
        }
      });

    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    // Use original order data (prices already include offers applied at order time)
    const orderedItemsWithDetails = order.orderedItems.map(item => {
      return {
        ...item.toObject(),
        finalPrice: item.price, // This already includes any offers that were applied
        itemTotal: item.price * item.quantity
      };
    });

    // Use the original stored totals from when the order was placed
    const subtotal = order.totalPrice; // Original subtotal
    const shippingCharge = order.shippingCharge || 0;
    const discount = order.discount || 0;

    // Calculate correct final total: subtotal + shipping - discount
    const finalTotal = subtotal + shippingCharge - discount;

    // Create order object with correct calculations
    const orderWithCorrectTotals = {
      ...order.toObject(),
      orderedItems: orderedItemsWithDetails,
      subtotal: subtotal,
      shippingCharge: shippingCharge,
      discount: discount,
      finalTotal: finalTotal
    };

    res.json({ success: true, order: orderWithCorrectTotals });
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
