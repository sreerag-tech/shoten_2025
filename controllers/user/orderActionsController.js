const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");

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
    
    // Check if order can be cancelled
    const canCancel = order.orderedItems.some(item => 
      item.status === 'Processing' || item.status === 'Shipped'
    );
    
    if (!canCancel) {
      return res.json({ success: false, message: 'Order cannot be cancelled' });
    }
    
    // Update order status and restore stock
    for (let item of order.orderedItems) {
      if (item.status === 'Processing' || item.status === 'Shipped') {
        // Restore product stock
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { quantity: item.quantity }
        });
        
        // Update item status
        item.status = 'Cancelled';
      }
    }
    
    // Save order with cancellation reason
    order.cancellation_reason = reason;
    await order.save();
    
    res.json({ success: true, message: 'Order cancelled successfully' });
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
    
    await order.save();
    
    res.json({ success: true, message: 'Item cancelled successfully' });
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
