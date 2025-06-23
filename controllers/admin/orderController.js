const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const offerService = require("../../services/offerService");

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

    // Calculate offer-adjusted totals for each order
    const orders = await Promise.all(ordersRaw.map(async (order) => {
      let newSubtotal = 0;

      // Calculate offers for each order item
      const orderedItemsWithOffers = await Promise.all(order.orderedItems.map(async (item) => {
        if (!item.product) return item;

        const offerResult = await offerService.calculateBestOfferForProduct(item.product._id);

        let finalPrice = item.price;
        let hasOffer = false;
        let offerInfo = null;

        if (offerResult) {
          finalPrice = offerResult.finalPrice;
          hasOffer = true;
          offerInfo = {
            type: offerResult.offer.offerType,
            name: offerResult.offer.offerName,
            discountAmount: offerResult.discount,
            discountPercentage: offerResult.discountPercentage
          };
        }

        newSubtotal += finalPrice * item.quantity;

        return {
          ...item.toObject(),
          finalPrice: finalPrice,
          originalPrice: item.price,
          hasOffer: hasOffer,
          offerInfo: offerInfo
        };
      }));

      // Calculate new total (keeping original shipping and discount logic)
      const shippingCharge = order.shippingCharge || 0;
      const originalDiscount = order.discount || 0;
      const newTotal = newSubtotal + shippingCharge - originalDiscount;

      return {
        ...order.toObject(),
        orderedItems: orderedItemsWithOffers,
        subtotalWithOffers: newSubtotal,
        totalPriceWithOffers: newTotal,
        offerSavings: order.totalPrice - shippingCharge + originalDiscount - newSubtotal
      };
    }));

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    // Get order statistics with offer-adjusted amounts
    const allOrdersForStats = await Order.find()
      .populate('orderedItems.product');

    const orderStatsByStatus = {};

    for (const order of allOrdersForStats) {
      let orderTotal = 0;

      // Calculate offer-adjusted total for this order
      for (const item of order.orderedItems) {
        if (item.product) {
          const offerResult = await offerService.calculateBestOfferForProduct(item.product._id);

          let finalPrice = item.price;
          if (offerResult) {
            finalPrice = offerResult.finalPrice;
          }

          orderTotal += finalPrice * item.quantity;
        } else {
          orderTotal += item.price * item.quantity;
        }
      }

      // Add shipping and subtract discounts
      orderTotal += (order.shippingCharge || 0) - (order.discount || 0);

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

    // Calculate offers for ordered items (for admin reference)
    const orderedItemsWithOffers = await Promise.all(order.orderedItems.map(async (item) => {
      if (!item.product) return item;

      const offerResult = await offerService.calculateBestOfferForProduct(item.product._id);

      let finalPrice = item.price;
      let hasOffer = false;
      let offerInfo = null;

      if (offerResult) {
        finalPrice = offerResult.finalPrice;
        hasOffer = true;
        offerInfo = {
          type: offerResult.offer.offerType,
          name: offerResult.offer.offerName,
          discountAmount: offerResult.discount,
          discountPercentage: offerResult.discountPercentage
        };
      }

      return {
        ...item.toObject(),
        finalPrice: finalPrice,
        originalPrice: item.price,
        hasOffer: hasOffer,
        offerInfo: offerInfo
      };
    }));

    // Calculate new totals based on offer prices
    let newSubtotal = 0;
    orderedItemsWithOffers.forEach(item => {
      const itemPrice = item.hasOffer && item.finalPrice ? item.finalPrice : item.price;
      newSubtotal += itemPrice * item.quantity;
    });

    // Calculate new total (keeping original shipping and discount logic)
    const shippingCharge = order.shippingCharge || 0;
    const originalDiscount = order.discount || 0;
    const newTotal = newSubtotal + shippingCharge - originalDiscount;

    // Update order object with offer information and recalculated totals
    const orderWithOffers = {
      ...order.toObject(),
      orderedItems: orderedItemsWithOffers,
      subtotalWithOffers: newSubtotal,
      totalPriceWithOffers: newTotal,
      offerSavings: order.totalPrice - shippingCharge + originalDiscount - newSubtotal
    };

    res.render("admin-order-detail", {
      order: orderWithOffers,
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

      // Calculate offer-adjusted refund amount
      let refundAmount = item.price * item.quantity;

      // Get the product to calculate current offer price
      const Product = require("../../models/productSchema");
      const product = await Product.findById(item.product);

      if (product) {
        const offerResult = await offerService.calculateBestOfferForProduct(item.product);

        if (offerResult) {
          // Use offer-adjusted price for refund
          refundAmount = offerResult.finalPrice * item.quantity;
        }
      }

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
          // Calculate offer for return request item
          let finalPrice = item.price;
          let hasOffer = false;
          let offerInfo = null;

          if (item.product) {
            const offerResult = await offerService.calculateBestOfferForProduct(item.product._id);

            if (offerResult) {
              finalPrice = offerResult.finalPrice;
              hasOffer = true;
              offerInfo = {
                type: offerResult.offer.offerType,
                name: offerResult.offer.offerName,
                discountAmount: offerResult.discount,
                discountPercentage: offerResult.discountPercentage
              };
            }
          }

          returnRequests.push({
            order: order,
            item: {
              ...item.toObject(),
              finalPrice: finalPrice,
              originalPrice: item.price,
              hasOffer: hasOffer,
              offerInfo: offerInfo
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

    // Calculate offers for ordered items
    const orderedItemsWithOffers = await Promise.all(order.orderedItems.map(async (item) => {
      if (!item.product) return item;

      const offerResult = await offerService.calculateBestOfferForProduct(item.product._id);

      let finalPrice = item.price;
      let hasOffer = false;
      let offerInfo = null;

      if (offerResult) {
        finalPrice = offerResult.finalPrice;
        hasOffer = true;
        offerInfo = {
          type: offerResult.offer.offerType,
          name: offerResult.offer.offerName,
          discountAmount: offerResult.discount,
          discountPercentage: offerResult.discountPercentage
        };
      }

      return {
        ...item.toObject(),
        finalPrice: finalPrice,
        originalPrice: item.price,
        hasOffer: hasOffer,
        offerInfo: offerInfo
      };
    }));

    // Calculate new totals based on offer prices
    let newSubtotal = 0;
    orderedItemsWithOffers.forEach(item => {
      const itemPrice = item.hasOffer && item.finalPrice ? item.finalPrice : item.price;
      newSubtotal += itemPrice * item.quantity;
    });

    // Calculate new total (keeping original shipping and discount logic)
    const shippingCharge = order.shippingCharge || 0;
    const originalDiscount = order.discount || 0;
    const newTotal = newSubtotal + shippingCharge - originalDiscount;

    // Update order object with offer information and recalculated totals
    const orderWithOffers = {
      ...order.toObject(),
      orderedItems: orderedItemsWithOffers,
      subtotalWithOffers: newSubtotal,
      totalPriceWithOffers: newTotal,
      offerSavings: order.totalPrice - shippingCharge + originalDiscount - newSubtotal
    };

    res.json({ success: true, order: orderWithOffers });
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
