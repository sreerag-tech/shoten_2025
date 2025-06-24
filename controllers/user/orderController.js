const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

// Load Orders List Page
const loadOrders = async (req, res) => {
  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get search and filter parameters
    const search = req.query.search || '';
    const status = req.query.status || '';
    const dateFilter = req.query.dateFilter || '';

    // Build query
    let query = { userId: userId };

    // Add search filter
    if (search) {
      query.orderId = { $regex: search, $options: 'i' };
    }

    // Add status filter
    if (status) {
      query['orderedItems.status'] = status;
    }

    // Add date filter
    if (dateFilter) {
      const days = parseInt(dateFilter);
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - days);
      query.createdOn = { $gte: dateLimit };
    }

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate({
        path: 'orderedItems.product',
        populate: {
          path: 'category',
          model: 'Category'
        }
      })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    // Use original order data (prices already include offers applied at order time)
    const ordersWithCorrectTotals = orders.map(order => {
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

    // Get user data for header
    const userData = await User.findById(userId);

    // Get order message from session
    const orderMessage = req.session.orderMessage || null;
    req.session.orderMessage = null;

    res.render("orders", {
      user: userData,
      orders: ordersWithCorrectTotals,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      orderMessage: orderMessage,
      search: search,
      status: status,
      dateFilter: dateFilter
    });
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
};

// Load Order Detail Page
const loadOrderDetail = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate({
        path: 'orderedItems.product',
        populate: {
          path: 'category',
          model: 'Category'
        }
      });

    if (!order) {
      req.session.orderMessage = { type: 'error', text: 'Order not found' };
      return res.redirect('/orders');
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

    // Get user data for header
    const userData = await User.findById(userId);

    res.render("order-detail", {
      user: userData,
      order: orderWithCorrectTotals
    });
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
};

// Get Order Details API (for modal)
const getOrderDetailsAPI = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, userId: userId })
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
  getOrderDetailsAPI
};
