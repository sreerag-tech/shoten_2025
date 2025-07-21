const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const refundCalculationService = require("../../services/refundCalculationService");

// Cancel Entire Order
const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;
    const { reason } = req.body;

    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate('orderedItems.product');

    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    // Check if order can be cancelled (allow cancellation of Pending, Processing, Shipped orders)
    const canCancel = order.orderedItems.some(item =>
      ['Pending', 'Processing', 'Shipped'].includes(item.status)
    );

    if (!canCancel) {
      return res.json({ success: false, message: 'Order cannot be cancelled' });
    }
    
    // Update order status and restore stock
    for (let item of order.orderedItems) {
      if (['Pending', 'Processing', 'Shipped'].includes(item.status)) {
        // Restore product stock
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { quantity: item.quantity }
        });

        // Update item status
        item.status = 'Cancelled';
        item.cancelReason = reason || 'Cancelled by user';
        item.cancelledAt = new Date();
      }
    }

    // Update main order status
    order.status = 'Cancelled';
    order.cancelReason = reason || 'Cancelled by user';
    order.cancelledAt = new Date();
    
    // Calculate refund amount using proper refund calculation service
    const refundCalculation = refundCalculationService.calculateFullOrderRefund(order);
    const refundAmount = refundCalculation.refundAmount;

    console.log('Order payment method:', order.paymentMethod);
    console.log('Order payment status:', order.paymentStatus);
    console.log('Refund calculation:', refundCalculation);
    console.log('Final refund amount:', refundAmount);

    // Process refund if this is a paid order (not COD) and there's an amount to refund
    const isPaidOrder = order.paymentMethod === 'razorpay' ||
                       order.paymentStatus === 'Completed' ||
                       order.razorpayPaymentId;

    console.log('Is paid order?', isPaidOrder);
    console.log('Refund amount > 0?', refundAmount > 0);

    if (isPaidOrder && refundAmount > 0) {
      try {
        const User = require("../../models/userSchema");
        const Wallet = require("../../models/walletSchema");

        console.log('Processing refund for user:', order.userId);

        // Add refund to user's wallet
        const user = await User.findById(order.userId);
        if (user) {
          console.log('User found, current wallet balance:', user.wallet);
          const oldBalance = user.wallet || 0;
          user.wallet = oldBalance + refundAmount;
          await user.save();
          console.log('User wallet updated from', oldBalance, 'to', user.wallet);

          // Create wallet transaction record
          try {
            const wallet = await Wallet.findOne({ user: order.userId });
            if (wallet) {
              console.log('Wallet found, adding transaction');
              await wallet.addMoney(
                refundAmount,
                `Refund for cancelled order: ${order.orderId}`,
                order._id,
                `CANCEL-${Date.now()}`
              );
              console.log('Wallet transaction added successfully');
              console.log('Wallet balance after transaction:', wallet.balance);
            } else {
              console.log('No wallet found for user, creating one');
              // Create wallet if it doesn't exist
              const newWallet = new Wallet({
                user: order.userId,
                balance: refundAmount,
                transactions: []
              });
              await newWallet.save();
              await newWallet.addMoney(
                refundAmount,
                `Refund for cancelled order: ${order.orderId}`,
                order._id,
                `CANCEL-${Date.now()}`
              );
              console.log('New wallet created and transaction added');
              console.log('New wallet balance:', newWallet.balance);
            }
          } catch (walletError) {
            console.error('Wallet transaction record creation failed:', walletError);
            // Continue even if wallet transaction fails
          }
        } else {
          console.error('User not found for refund processing');
        }

        // Update order with refund information
        order.refundStatus = 'Completed';
        order.refundAmount = refundAmount;
        order.refundDate = new Date();

        console.log('Order refund information updated');

      } catch (refundError) {
        console.error('Error processing refund:', refundError);
        // Continue with cancellation even if refund fails
      }
    }

    // Save order with cancellation reason
    order.cancellation_reason = reason;
    await order.save();

    const message = refundAmount > 0 ?
      `Order cancelled successfully. ₹${refundAmount.toLocaleString()} has been added to your wallet.` :
      'Order cancelled successfully';

    res.json({ success: true, message: message, refundAmount: refundAmount });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.json({ success: false, message: 'Failed to cancel order' });
  }
};

// Cancel Specific Item
const cancelOrderItem = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;
    const itemIndex = parseInt(req.params.itemIndex);
    const { reason } = req.body;
    
    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate('orderedItems.product');
    
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    
    if (itemIndex >= order.orderedItems.length) {
      return res.json({ success: false, message: 'Item not found' });
    }
    
    const item = order.orderedItems[itemIndex];
    
    // Check if item can be cancelled
    if (item.status !== 'Processing' && item.status !== 'Shipped') {
      return res.json({ success: false, message: 'Item cannot be cancelled' });
    }
    
    // Restore product stock
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { quantity: item.quantity }
    });
    
    // Update item status
    order.orderedItems[itemIndex].status = 'Cancelled';
    order.orderedItems[itemIndex].returnReason = reason;

    // Calculate refund amount using proper refund calculation service
    const itemsToRefund = [{
      price: item.price,
      quantity: item.quantity
    }];

    const refundCalculation = refundCalculationService.calculateRefundAmount(order, itemsToRefund);
    const refundAmount = refundCalculation.refundAmount;

    console.log('Item cancellation refund calculation:', refundCalculation);

    // Process refund if this is a paid order
    const isPaidOrder = order.paymentMethod === 'razorpay' ||
                       order.paymentStatus === 'Completed' ||
                       order.razorpayPaymentId;

    console.log('Item cancellation - Is paid order?', isPaidOrder);
    console.log('Item cancellation - Refund amount:', refundAmount);

    if (isPaidOrder && refundAmount > 0) {
      try {
        const User = require("../../models/userSchema");
        const Wallet = require("../../models/walletSchema");

        // Add refund to user's wallet
        const user = await User.findById(order.userId);
        if (user) {
          console.log('Item cancellation - User found, current wallet:', user.wallet);
          const oldBalance = user.wallet || 0;
          user.wallet = oldBalance + refundAmount;
          await user.save();
          console.log('Item cancellation - Wallet updated from', oldBalance, 'to', user.wallet);

          // Create wallet transaction record
          try {
            const wallet = await Wallet.findOne({ user: order.userId });
            if (wallet) {
              await wallet.addMoney(
                refundAmount,
                `Refund for cancelled item: ${item.product.productName} - Order: ${order.orderId}`,
                order._id,
                `CANCEL-ITEM-${Date.now()}`
              );
              console.log('Item cancellation - Wallet transaction added');
            } else {
              console.log('Item cancellation - No wallet found, creating one');
              // Create wallet if it doesn't exist
              const newWallet = new Wallet({
                user: order.userId,
                balance: 0,
                transactions: []
              });
              await newWallet.save();
              await newWallet.addMoney(
                refundAmount,
                `Refund for cancelled item: ${item.product.productName} - Order: ${order.orderId}`,
                order._id,
                `CANCEL-ITEM-${Date.now()}`
              );
              console.log('Item cancellation - New wallet created and transaction added');
            }
          } catch (walletError) {
            console.error('Item cancellation - Wallet transaction record creation failed:', walletError);
            // Continue even if wallet transaction fails
          }
        }

        // Update order with refund information
        order.refundAmount = (order.refundAmount || 0) + refundAmount;
        order.refundStatus = 'Partial';
        order.refundDate = new Date();

      } catch (refundError) {
        console.error('Error processing refund:', refundError);
        // Continue with cancellation even if refund fails
      }
    }

    await order.save();

    const message = refundAmount > 0 ?
      `Item cancelled successfully. ₹${refundAmount.toLocaleString()} has been added to your wallet.` :
      'Item cancelled successfully';

    res.json({ success: true, message: message, refundAmount: refundAmount });
  } catch (error) {
    console.error('Error cancelling item:', error);
    res.json({ success: false, message: 'Failed to cancel item' });
  }
};

// Return Entire Order
const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;
    const { reason, details } = req.body;
    
    const order = await Order.findOne({ _id: orderId, userId: userId });
    
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    
    // Check if order can be returned
    const canReturn = order.orderedItems.some(item => item.status === 'Delivered');

    if (!canReturn) {
      return res.json({ success: false, message: 'Order cannot be returned' });
    }

    // Check return days limit
    const returnDays = order.returnDays || 7; // Default 7 days
    const deliveredDate = order.deliveredAt || order.createdOn;
    const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveredDate).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceDelivery > returnDays) {
      return res.json({
        success: false,
        message: `Return period has expired. Returns are only allowed within ${returnDays} days of delivery.`
      });
    }
    
    // Update order status for delivered items
    for (let item of order.orderedItems) {
      if (item.status === 'Delivered') {
        item.status = 'Return Request';
        item.returnReason = `${reason} - ${details}`;
      }
    }
    
    order.return_reason = `${reason} - ${details}`;
    await order.save();
    
    res.json({ success: true, message: 'Return request submitted successfully' });
  } catch (error) {
    console.error('Error submitting return request:', error);
    res.json({ success: false, message: 'Failed to submit return request' });
  }
};

// Return Specific Item
const returnOrderItem = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;
    const itemIndex = parseInt(req.params.itemIndex);
    const { reason, details } = req.body;
    
    const order = await Order.findOne({ _id: orderId, userId: userId });
    
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    
    if (itemIndex >= order.orderedItems.length) {
      return res.json({ success: false, message: 'Item not found' });
    }
    
    const item = order.orderedItems[itemIndex];
    
    // Check if item can be returned
    if (item.status !== 'Delivered') {
      return res.json({ success: false, message: 'Item cannot be returned' });
    }

    // Check return days limit for individual item
    const returnDays = order.returnDays || 7; // Default 7 days
    const deliveredDate = order.deliveredAt || order.createdOn;
    const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveredDate).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceDelivery > returnDays) {
      return res.json({
        success: false,
        message: `Return period has expired. Returns are only allowed within ${returnDays} days of delivery.`
      });
    }
    
    // Update item status
    order.orderedItems[itemIndex].status = 'Return Request';
    order.orderedItems[itemIndex].returnReason = `${reason} - ${details}`;
    
    await order.save();
    
    res.json({ success: true, message: 'Return request submitted successfully' });
  } catch (error) {
    console.error('Error submitting return request:', error);
    res.json({ success: false, message: 'Failed to submit return request' });
  }
};

module.exports = {
  cancelOrder,
  cancelOrderItem,
  returnOrder,
  returnOrderItem
};
