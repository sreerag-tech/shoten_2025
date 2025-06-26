const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Coupon = require("../../models/couponSchema");
const FailedOrder = require("../../models/failedOrderSchema");
const PaymentService = require("../../services/paymentService");

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

// Create order with payment integration
const createOrderWithPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const {
      addressId,
      paymentMethod,
      couponCode,
      totalAmount,
      subtotal,
      shippingCharge,
      discount
    } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login first' });
    }

    // Get user and cart
    const user = await User.findById(userId).populate('cart');
    if (!user || !user.cart || user.cart.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Get cart details
    const cart = await Cart.findById(user.cart[0]).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Validate stock availability
    for (const item of cart.items) {
      if (item.productId.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.productId.productName}`
        });
      }
    }

    // Create order
    const orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

    const orderData = {
      orderId: orderId,
      userId: userId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
        status: 'Pending'
      })),
      totalPrice: totalAmount,
      address: user.address.find(addr => addr._id.toString() === addressId),
      paymentMethod: paymentMethod === 'COD' ? 'cod' : 'razorpay',
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Pending',
      status: 'Pending',
      createdOn: new Date(),
      couponApplied: couponCode || null,
      discount: discount || 0
    };

    if (paymentMethod === 'Online') {
      // Create Razorpay order
      const razorpayResult = await PaymentService.createRazorpayOrder({
        orderId: orderId,
        totalAmount: totalAmount,
        userId: userId,
        customerName: user.name,
        customerEmail: user.email
      });

      if (!razorpayResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create payment order'
        });
      }

      // Save order with pending payment
      const order = new Order(orderData);
      order.razorpayOrderId = razorpayResult.razorpayOrderId;
      await order.save();

      // Generate payment options
      const paymentOptions = PaymentService.generatePaymentOptions(
        {
          orderId: orderId,
          totalAmount: totalAmount,
          customerName: user.name,
          customerEmail: user.email,
          customerPhone: user.phone
        },
        razorpayResult.razorpayOrderId
      );

      return res.json({
        success: true,
        paymentRequired: true,
        orderId: order._id,
        razorpayOrderId: razorpayResult.razorpayOrderId,
        paymentOptions: paymentOptions
      });

    } else {
      // COD Order - Process immediately
      const order = new Order(orderData);
      await order.save();

      // Update stock and clear cart
      await updateStockAndClearCart(cart, userId);

      // Use coupon if provided
      if (couponCode) {
        await useCoupon(couponCode, userId);
      }

      return res.json({
        success: true,
        paymentRequired: false,
        orderId: order._id,
        message: 'Order placed successfully'
      });
    }

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Error creating order' });
  }
};

// Verify payment and complete order
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    // Verify payment signature
    const isValidSignature = PaymentService.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Get payment details
    const paymentDetails = await PaymentService.getPaymentDetails(razorpay_payment_id);

    if (!paymentDetails.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to verify payment'
      });
    }

    // Check if this is a retry payment from order history
    if (req.session.retryOrderData) {
      const retryData = req.session.retryOrderData;

      // Update the original order status to Processing (like COD orders)
      await Order.findByIdAndUpdate(retryData.actualOrderId, {
        status: 'Processing',
        paymentStatus: 'Completed',
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        paymentDetails: {
          method: PaymentService.getPaymentMethod(paymentDetails.payment),
          transactionId: razorpay_payment_id,
          paidAmount: paymentDetails.payment.amount / 100,
          paidAt: new Date()
        },
        'orderedItems.$[].status': 'Processing'
      });

      // Clear retry data from session
      req.session.retryOrderData = null;

      return res.json({
        success: true,
        message: 'Payment completed successfully. Order is now being processed.',
        orderId: retryData.orderId,
        isRetry: true
      });
    }

    // Get pending order data from session (for new orders)
    const pendingOrder = req.session.pendingOrder;
    if (!pendingOrder) {
      return res.status(404).json({
        success: false,
        message: 'No pending order found. Please try placing the order again.'
      });
    }

    // Create the order now that payment is successful
    const orderData = pendingOrder.orderData;
    orderData.paymentStatus = 'Completed';
    orderData.razorpayPaymentId = razorpay_payment_id;
    orderData.razorpayOrderId = razorpay_order_id;
    orderData.paymentDetails = {
      method: PaymentService.getPaymentMethod(paymentDetails.payment),
      transactionId: razorpay_payment_id,
      paidAmount: paymentDetails.payment.amount / 100,
      paidAt: new Date()
    };

    const order = new Order(orderData);
    await order.save();

    // Update product stock now that payment is confirmed
    for (const item of pendingOrder.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.quantity }
      });
    }

    // Clear cart
    await Cart.deleteMany({ userId: pendingOrder.userId });
    await User.findByIdAndUpdate(pendingOrder.userId, { $unset: { cart: 1 } });

    // Use coupon if provided
    if (pendingOrder.couponApplied && pendingOrder.couponCode) {
      await useCoupon(pendingOrder.couponCode, pendingOrder.userId);
    }

    // If this was a retry payment, mark the failed order as completed
    if (pendingOrder.failedOrderId) {
      await FailedOrder.findByIdAndUpdate(pendingOrder.failedOrderId, {
        status: 'Completed'
      });
    }



    // Clear pending order from session
    req.session.pendingOrder = null;

    res.json({
      success: true,
      message: 'Payment verified successfully',
      orderId: order._id
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Error verifying payment' });
  }
};

// Handle payment failure
const handlePaymentFailure = async (req, res) => {
  try {
    const { orderId, error } = req.body;
    const userId = req.session.user;

    // Log the payment failure for debugging
    console.log(`Payment failed for order ${orderId}: ${error}`);

    // Create actual order with "Payment Failed" status and clear cart
    if (req.session.pendingOrder) {
      const pendingOrder = req.session.pendingOrder;
      const Order = require("../../models/orderSchema");
      const Cart = require("../../models/cartSchema");

      // Debug logging
      console.log('Pending order data:', JSON.stringify(pendingOrder, null, 2));

      // Create the order with Payment Failed status
      const currentDate = new Date();
      const deliveryDate = new Date(currentDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now

      const newOrder = new Order({
        orderId: pendingOrder.orderData.orderId,
        userId: userId,
        orderedItems: pendingOrder.orderedItems.map(item => ({
          ...item,
          status: 'Payment Failed'
        })),
        totalPrice: pendingOrder.orderData.totalPrice,
        discount: pendingOrder.orderData.discount || 0,
        finalAmount: pendingOrder.orderData.finalAmount,
        shippingAddress: {
          fullName: pendingOrder.orderData.address?.name ||
                   pendingOrder.orderData.address?.fullName ||
                   'Customer',
          addressType: pendingOrder.orderData.address?.addressType || 'Home',
          landmark: pendingOrder.orderData.address?.landmark || '',
          city: pendingOrder.orderData.address?.city || 'Unknown',
          state: pendingOrder.orderData.address?.state || 'Unknown',
          pincode: pendingOrder.orderData.address?.pincode ||
                  pendingOrder.orderData.address?.zipCode ||
                  '000000',
          phone: pendingOrder.orderData.address?.phone ||
                pendingOrder.orderData.address?.phoneNumber ||
                1234567890
        },
        orderDate: currentDate,
        deliveryDate: deliveryDate,
        invoiceDate: currentDate,
        status: 'Payment Failed',
        paymentMethod: 'razorpay',
        razorpayOrderId: pendingOrder.razorpayOrderId,
        couponApplied: pendingOrder.couponApplied || false,
        couponCode: pendingOrder.couponCode || null
      });

      await newOrder.save();

      // Clear the user's cart since order was attempted
      await Cart.deleteOne({ userId: userId });

      // Also save to FailedOrder for retry functionality
      const tempOrderId = orderId || pendingOrder.orderData?.orderId || `temp_${Date.now()}`;
      const razorpayOrderId = pendingOrder.razorpayOrderId || orderId || tempOrderId;

      // Check if failed order already exists
      let failedOrder = await FailedOrder.findOne({ tempOrderId: tempOrderId });

      if (failedOrder) {
        // Update existing failed order
        failedOrder.attemptCount += 1;
        failedOrder.lastAttempt = new Date();
        failedOrder.failureReason = error;
        failedOrder.actualOrderId = newOrder._id; // Link to actual order
        await failedOrder.save();
      } else {
        // Create new failed order
        failedOrder = new FailedOrder({
          userId: userId,
          tempOrderId: tempOrderId,
          razorpayOrderId: razorpayOrderId,
          orderData: pendingOrder.orderData,
          orderedItems: pendingOrder.orderedItems,
          totalAmount: pendingOrder.orderData.finalAmount || 0,
          failureReason: error,
          attemptCount: 1,
          actualOrderId: newOrder._id // Link to actual order
        });
        await failedOrder.save();
      }

      // Clear pending order from session
      req.session.pendingOrder = null;

      console.log(`Order created with Payment Failed status: ${newOrder.orderId}`);

      res.json({
        success: true,
        message: 'Order created with payment failed status. Items removed from cart. You can retry payment from your orders.',
        orderId: newOrder.orderId,
        showInOrders: true
      });

    } else {
      console.log('No pending order found in session, payment failure not saved');
      res.json({
        success: true,
        message: 'Payment failed. Please try placing the order again.'
      });
    }

  } catch (error) {
    console.error('Error handling payment failure:', error);

    // Clear pending order from session even if there's an error
    if (req.session.pendingOrder) {
      req.session.pendingOrder = null;
    }

    res.json({
      success: true,
      message: 'Payment failed. Please try placing the order again.'
    });
  }
};

// Cancel order or specific items
const cancelOrder = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;
    const userId = req.session.user;

    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (itemId) {
      // Cancel specific item
      const item = order.orderedItems.find(item => item._id.toString() === itemId);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }

      if (item.status === 'Cancelled') {
        return res.status(400).json({ success: false, message: 'Item already cancelled' });
      }

      // Update item status
      item.status = 'Cancelled';
      item.cancelReason = reason || 'No reason provided';
      item.cancelledAt = new Date();

      // Restore stock
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { quantity: item.quantity } }
      );

    } else {
      // Cancel entire order
      if (order.status === 'Cancelled') {
        return res.status(400).json({ success: false, message: 'Order already cancelled' });
      }

      // Update order status
      order.status = 'Cancelled';
      order.cancelReason = reason || 'No reason provided';
      order.cancelledAt = new Date();

      // Update all items status and restore stock
      for (const item of order.orderedItems) {
        if (item.status !== 'Cancelled') {
          item.status = 'Cancelled';
          item.cancelReason = reason || 'No reason provided';
          item.cancelledAt = new Date();

          // Restore stock
          await Product.findByIdAndUpdate(
            item.product._id,
            { $inc: { quantity: item.quantity } }
          );
        }
      }
    }

    await order.save();

    // Process refund if payment was made
    if (order.paymentStatus === 'Completed' && order.razorpayPaymentId) {
      const refundAmount = itemId ?
        order.orderedItems.find(item => item._id.toString() === itemId).price *
        order.orderedItems.find(item => item._id.toString() === itemId).quantity :
        order.totalPrice;

      const refundResult = await PaymentService.createRefund(
        order.razorpayPaymentId,
        refundAmount,
        reason || 'Order cancellation'
      );

      if (refundResult.success) {
        order.refundStatus = 'Processed';
        order.refundAmount = refundAmount;
        await order.save();
      }
    }

    res.json({
      success: true,
      message: itemId ? 'Item cancelled successfully' : 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Error cancelling order' });
  }
};

// Return order
const returnOrder = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;
    const userId = req.session.user;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Return reason is required' });
    }

    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (itemId) {
      // Return specific item
      const item = order.orderedItems.find(item => item._id.toString() === itemId);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
      }

      if (item.status !== 'Delivered') {
        return res.status(400).json({ success: false, message: 'Only delivered items can be returned' });
      }

      // Update item status
      item.status = 'Return Requested';
      item.returnReason = reason;
      item.returnRequestedAt = new Date();

    } else {
      // Return entire order
      if (order.status !== 'Delivered') {
        return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
      }

      // Update order status
      order.status = 'Return Requested';
      order.returnReason = reason;
      order.returnRequestedAt = new Date();

      // Update all delivered items
      for (const item of order.orderedItems) {
        if (item.status === 'Delivered') {
          item.status = 'Return Requested';
          item.returnReason = reason;
          item.returnRequestedAt = new Date();
        }
      }
    }

    await order.save();

    res.json({
      success: true,
      message: itemId ? 'Return request submitted for item' : 'Return request submitted for order'
    });

  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({ success: false, message: 'Error processing return request' });
  }
};

// Helper function to update stock and clear cart
async function updateStockAndClearCart(cart, userId) {
  // Check if cart exists and has items
  if (cart && cart.items && cart.items.length > 0) {
    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: -item.quantity } }
      );
    }
  }

  // Clear cart (if it exists)
  if (cart && cart._id) {
    await Cart.findByIdAndDelete(cart._id);
  }

  // Clear cart reference from user
  await Cart.deleteMany({ userId: userId });
  await User.findByIdAndUpdate(userId, { $unset: { cart: 1 } });
}

// Helper function to use coupon
async function useCoupon(couponCode, userId) {
  // Safety check: ensure couponCode is a string
  if (!couponCode || typeof couponCode !== 'string') {
    return;
  }

  const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
  if (coupon && coupon.canUserUseCoupon(userId)) {
    await coupon.useCoupon(userId);
  }
}

// Load failed orders page
const loadFailedOrders = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);

    // Get failed orders for the user
    const failedOrders = await FailedOrder.find({
      userId: userId,
      status: { $in: ['Failed', 'Retrying'] }
    })
    .populate('orderedItems.product')
    .sort({ createdAt: -1 });

    res.render("failed-orders", {
      user: userData,
      failedOrders: failedOrders
    });

  } catch (error) {
    console.error('Error loading failed orders:', error);
    res.redirect("/pageNotFound");
  }
};

// Retry payment for failed order
const retryPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const { failedOrderId } = req.params;

    const failedOrder = await FailedOrder.findOne({
      _id: failedOrderId,
      userId: userId,
      status: { $in: ['Failed', 'Retrying'] }
    });

    if (!failedOrder) {
      return res.status(404).json({
        success: false,
        message: 'Failed order not found or expired'
      });
    }

    // Create new Razorpay order for retry
    const user = await User.findById(userId);
    // Generate shorter receipt ID (max 40 chars)
    const shortReceiptId = `retry_${Date.now().toString().slice(-8)}`;
    const razorpayResult = await PaymentService.createRazorpayOrder({
      orderId: shortReceiptId,
      totalAmount: failedOrder.totalAmount,
      userId: userId,
      customerName: user.name,
      customerEmail: user.email
    });

    if (!razorpayResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order for retry'
      });
    }

    // Update failed order status and store new Razorpay order ID
    failedOrder.status = 'Retrying';
    failedOrder.razorpayOrderId = razorpayResult.razorpayOrderId;
    failedOrder.attemptCount += 1;
    failedOrder.lastAttempt = new Date();
    await failedOrder.save();

    // Store in session for payment verification
    req.session.pendingOrder = {
      orderData: failedOrder.orderData,
      orderedItems: failedOrder.orderedItems,
      userId: userId,
      couponCode: failedOrder.orderData.couponCode,
      couponApplied: failedOrder.orderData.couponApplied,
      failedOrderId: failedOrder._id
    };

    // Generate payment options
    const paymentOptions = PaymentService.generatePaymentOptions(
      {
        orderId: failedOrder.tempOrderId,
        totalAmount: failedOrder.totalAmount,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone
      },
      razorpayResult.razorpayOrderId
    );

    res.json({
      success: true,
      paymentRequired: true,
      tempOrderId: failedOrder.tempOrderId,
      razorpayOrderId: razorpayResult.razorpayOrderId,
      paymentOptions: paymentOptions
    });

  } catch (error) {
    console.error('Error retrying payment:', error);
    res.status(500).json({ success: false, message: 'Error retrying payment' });
  }
};

// Retry payment from order history (for Payment Failed orders)
const retryPaymentFromOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { orderId } = req.params; // This is the actual order ID

    // Find the order with Payment Failed status
    const Order = require("../../models/orderSchema");
    const failedOrder = await Order.findOne({
      orderId: orderId,
      userId: userId,
      status: 'Payment Failed'
    });

    if (!failedOrder) {
      return res.status(404).json({
        success: false,
        message: 'Failed order not found'
      });
    }

    // Create new Razorpay order for retry
    const user = await User.findById(userId);
    // Generate shorter receipt ID (max 40 chars)
    const shortReceiptId = `retry_${Date.now().toString().slice(-8)}`;
    const razorpayResult = await PaymentService.createRazorpayOrder({
      orderId: shortReceiptId,
      totalAmount: failedOrder.finalAmount,
      userId: userId,
      customerName: user.name,
      customerEmail: user.email
    });

    if (!razorpayResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment order for retry'
      });
    }

    // Store retry data in session
    req.session.retryOrderData = {
      actualOrderId: failedOrder._id,
      orderId: failedOrder.orderId,
      razorpayOrderId: razorpayResult.razorpayOrderId,
      totalAmount: failedOrder.finalAmount
    };

    // Generate payment options
    const paymentOptions = PaymentService.generatePaymentOptions(
      {
        orderId: failedOrder.orderId,
        totalAmount: failedOrder.finalAmount,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone
      },
      razorpayResult.razorpayOrderId
    );

    res.json({
      success: true,
      paymentRequired: true,
      tempOrderId: failedOrder.orderId,
      razorpayOrderId: razorpayResult.razorpayOrderId,
      paymentOptions: paymentOptions,
      message: 'Payment retry initiated'
    });

  } catch (error) {
    console.error('Error retrying payment from order:', error);
    res.status(500).json({ success: false, message: 'Error retrying payment' });
  }
};

// Delete failed order
const deleteFailedOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { failedOrderId } = req.params;

    await FailedOrder.findOneAndDelete({
      _id: failedOrderId,
      userId: userId
    });

    res.json({
      success: true,
      message: 'Failed order removed successfully'
    });

  } catch (error) {
    console.error('Error deleting failed order:', error);
    res.status(500).json({ success: false, message: 'Error deleting failed order' });
  }
};

module.exports = {
  loadOrders,
  loadOrderDetail,
  getOrderDetailsAPI,
  createOrderWithPayment,
  verifyPayment,
  handlePaymentFailure,
  cancelOrder,
  returnOrder,
  loadFailedOrders,
  retryPayment,
  retryPaymentFromOrder,
  deleteFailedOrder
};
