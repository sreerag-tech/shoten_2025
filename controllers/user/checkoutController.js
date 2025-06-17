const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");

// Load Checkout Page
const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Get user data for header
    const userData = await User.findById(userId);
    
    // Get cart items with populated product and category data
    const cartItems = await Cart.find({ userId: userId })
      .populate({
        path: 'productId',
        populate: {
          path: 'category',
          model: 'Category'
        }
      })
      .sort({ createdAt: -1 });
    
    // Filter out items with blocked/unlisted products or categories
    const validCartItems = cartItems.filter(item => {
      if (!item.productId) return false;
      if (item.productId.isBlocked || item.productId.isDeleted || item.productId.status !== 'Available') return false;
      if (!item.productId.category) return false;
      if (item.productId.category.isListed === false) return false;
      if (item.productId.quantity <= 0) return false; // Out of stock
      return true;
    });
    
    // Check if cart is empty or has invalid items
    if (validCartItems.length === 0) {
      req.session.checkoutMessage = { 
        type: 'error', 
        text: 'Your cart is empty or contains unavailable items. Please add valid products to proceed.' 
      };
      return res.redirect('/cart');
    }
    
    // Remove invalid items from cart
    const invalidItems = cartItems.filter(item => !validCartItems.includes(item));
    if (invalidItems.length > 0) {
      await Cart.deleteMany({ 
        _id: { $in: invalidItems.map(item => item._id) } 
      });
    }
    
    // Get user addresses
    const addresses = await Address.find({ userId: userId }).sort({ isDefault: -1, createdAt: -1 });
    
    // Calculate order totals
    let subtotal = 0;
    let totalItems = 0;
    
    validCartItems.forEach(item => {
      const itemTotal = item.productId.salePrice * item.quantity;
      subtotal += itemTotal;
      totalItems += item.quantity;
    });
    
    // Calculate taxes (18% GST)
    const taxRate = 0.18;
    const taxAmount = Math.round(subtotal * taxRate);
    
    // Calculate shipping (free for orders above ₹500)
    const shippingThreshold = 500;
    const shippingCharge = subtotal >= shippingThreshold ? 0 : 50;
    
    // Calculate discount (can be enhanced with coupon system)
    const discount = 0;
    
    // Calculate final total
    const finalTotal = subtotal + taxAmount + shippingCharge - discount;
    
    // Get checkout message from session
    const checkoutMessage = req.session.checkoutMessage || null;
    req.session.checkoutMessage = null;
    
    res.render("checkout", {
      user: userData,
      cartItems: validCartItems,
      addresses: addresses,
      subtotal: subtotal,
      totalItems: totalItems,
      taxAmount: taxAmount,
      taxRate: taxRate,
      shippingCharge: shippingCharge,
      shippingThreshold: shippingThreshold,
      discount: discount,
      finalTotal: finalTotal,
      checkoutMessage: checkoutMessage
    });
  } catch (error) {
    console.error('Error loading checkout:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Load Order Success Page
const loadOrderSuccess = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.orderId;
    
    // Get user data for header
    const userData = await User.findById(userId);
    
    // Get order details
    const order = await Order.findOne({ _id: orderId, userId: userId })
      .populate('orderedItems.product');
    
    if (!order) {
      req.session.checkoutMessage = { type: 'error', text: 'Order not found' };
      return res.redirect('/orders');
    }
    
    res.render("order-success", {
      user: userData,
      order: order
    });
  } catch (error) {
    console.error('Error loading order success:', error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  loadCheckout,
  loadOrderSuccess
};
