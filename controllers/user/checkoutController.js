const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");

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
    
    // Calculate discount from applied coupon
    let discount = 0;
    let appliedCoupon = null;

    if (req.session.appliedCoupon) {
      // Verify coupon is still valid
      const coupon = await Coupon.findOne({
        code: req.session.appliedCoupon.code,
        isListed: true,
        isDeleted: false,
        startOn: { $lte: new Date() },
        expireOn: { $gte: new Date() }
      });

      if (coupon && subtotal >= coupon.minimumPrice) {
        discount = coupon.offerPrice;
        appliedCoupon = {
          code: coupon.code,
          discount: discount,
          minimumPrice: coupon.minimumPrice
        };
      } else {
        // Remove invalid coupon from session
        req.session.appliedCoupon = null;
      }
    }

    // Calculate final total
    const finalTotal = subtotal + taxAmount + shippingCharge - discount;
    
    // Get available coupons for user
    const availableCoupons = await Coupon.find({
      isListed: true,
      isDeleted: false,
      startOn: { $lte: new Date() },
      expireOn: { $gte: new Date() },
      minimumPrice: { $lte: subtotal }
    }).select('code offerPrice minimumPrice description').limit(5);

    // Filter coupons user hasn't used
    const userAvailableCoupons = availableCoupons.filter(coupon => {
      const userUsage = coupon.userUses.find(usage => usage.userId.toString() === userId.toString());
      return !userUsage || userUsage.count === 0;
    });

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
      appliedCoupon: appliedCoupon,
      availableCoupons: userAvailableCoupons,
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

// Apply Coupon
const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const { couponCode } = req.body;

    if (!couponCode || couponCode.trim() === '') {
      return res.json({ success: false, message: 'Please enter a coupon code' });
    }

    // Check if coupon is already applied
    if (req.session.appliedCoupon && req.session.appliedCoupon.code === couponCode.toUpperCase()) {
      return res.json({ success: false, message: 'This coupon is already applied' });
    }

    // Find the coupon
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isListed: true,
      isDeleted: false
    });

    if (!coupon) {
      return res.json({ success: false, message: 'Invalid coupon code' });
    }

    // Check if coupon is active
    const currentDate = new Date();
    if (currentDate < coupon.startOn) {
      return res.json({ success: false, message: 'This coupon is not yet active' });
    }

    if (currentDate > coupon.expireOn) {
      return res.json({ success: false, message: 'This coupon has expired' });
    }

    // Check if coupon has reached maximum uses
    if (coupon.usesCount >= coupon.maxUses) {
      return res.json({ success: false, message: 'This coupon has reached its usage limit' });
    }

    // Check if user has already used this coupon
    const userUsage = coupon.userUses.find(usage => usage.userId.toString() === userId.toString());
    if (userUsage && userUsage.count > 0) {
      return res.json({ success: false, message: 'You have already used this coupon' });
    }

    // Calculate cart subtotal
    const cartItems = await Cart.find({ userId: userId })
      .populate('productId');

    let subtotal = 0;
    cartItems.forEach(item => {
      if (item.productId && !item.productId.isBlocked && !item.productId.isDeleted) {
        subtotal += item.productId.salePrice * item.quantity;
      }
    });

    // Check minimum order value
    if (subtotal < coupon.minimumPrice) {
      return res.json({
        success: false,
        message: `Minimum order value of ₹${coupon.minimumPrice} required to use this coupon`
      });
    }

    // Apply coupon to session
    req.session.appliedCoupon = {
      code: coupon.code,
      discount: coupon.offerPrice,
      minimumPrice: coupon.minimumPrice
    };

    // Calculate new totals
    const taxRate = 0.18;
    const taxAmount = Math.round(subtotal * taxRate);
    const shippingCharge = subtotal >= 500 ? 0 : 50;
    const discount = coupon.offerPrice;
    const finalTotal = subtotal + taxAmount + shippingCharge - discount;

    res.json({
      success: true,
      message: `Coupon applied successfully! You saved ₹${discount}`,
      coupon: {
        code: coupon.code,
        discount: discount
      },
      totals: {
        subtotal: subtotal,
        taxAmount: taxAmount,
        shippingCharge: shippingCharge,
        discount: discount,
        finalTotal: finalTotal
      }
    });

  } catch (error) {
    console.error('Error applying coupon:', error);
    res.json({ success: false, message: 'Failed to apply coupon. Please try again.' });
  }
};

// Remove Coupon
const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!req.session.appliedCoupon) {
      return res.json({ success: false, message: 'No coupon is currently applied' });
    }

    // Remove coupon from session
    req.session.appliedCoupon = null;

    // Recalculate totals without coupon
    const cartItems = await Cart.find({ userId: userId })
      .populate('productId');

    let subtotal = 0;
    cartItems.forEach(item => {
      if (item.productId && !item.productId.isBlocked && !item.productId.isDeleted) {
        subtotal += item.productId.salePrice * item.quantity;
      }
    });

    const taxRate = 0.18;
    const taxAmount = Math.round(subtotal * taxRate);
    const shippingCharge = subtotal >= 500 ? 0 : 50;
    const discount = 0;
    const finalTotal = subtotal + taxAmount + shippingCharge - discount;

    res.json({
      success: true,
      message: 'Coupon removed successfully',
      totals: {
        subtotal: subtotal,
        taxAmount: taxAmount,
        shippingCharge: shippingCharge,
        discount: discount,
        finalTotal: finalTotal
      }
    });

  } catch (error) {
    console.error('Error removing coupon:', error);
    res.json({ success: false, message: 'Failed to remove coupon. Please try again.' });
  }
};

module.exports = {
  loadCheckout,
  loadOrderSuccess,
  applyCoupon,
  removeCoupon
};
