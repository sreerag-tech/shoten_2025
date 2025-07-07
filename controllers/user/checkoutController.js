const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const offerService = require("../../services/offerService");
const couponService = require("../../services/couponService");

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
    
    // Calculate order totals with offers
    let subtotal = 0;
    let totalItems = 0;

    // Calculate offers for each cart item
    const cartItemsWithOffers = await Promise.all(validCartItems.map(async (item) => {
      const offerResult = await offerService.calculateBestOfferForProduct(item.productId._id, userId);

      let finalPrice = item.productId.salePrice;
      let discount = 0;
      let hasOffer = false;
      let offerInfo = null;

      if (offerResult) {
        finalPrice = offerResult.finalPrice;
        discount = offerResult.discountPercentage;
        hasOffer = true;
        offerInfo = {
          type: offerResult.offer.offerType,
          name: offerResult.offer.offerName,
          discountAmount: offerResult.discount
        };
      }

      const itemTotal = finalPrice * item.quantity;
      subtotal += itemTotal;
      totalItems += item.quantity;

      return {
        ...item.toObject(),
        finalPrice: finalPrice,
        originalPrice: item.productId.salePrice,
        discount: discount,
        hasOffer: hasOffer,
        offerInfo: offerInfo,
        itemTotal: itemTotal
      };
    }));
    
    // Calculate shipping (free for orders above ₹500)
    const shippingThreshold = 500;
    const shippingCharge = subtotal >= shippingThreshold ? 0 : 50;
    
    // Calculate discount from applied coupon
    let discount = 0;
    let appliedCoupon = null;

    if (req.session.appliedCoupon) {
      // Use coupon service to validate and calculate discount
      const couponResult = await couponService.validateCoupon(req.session.appliedCoupon.code, userId, subtotal);

      if (couponResult.isValid) {
        discount = couponResult.discount;
        appliedCoupon = {
          code: couponResult.coupon.code,
          discount: discount,
          minimumPrice: couponResult.coupon.minimumPrice
        };
      } else {
        // Remove invalid coupon from session
        req.session.appliedCoupon = null;
      }
    }

    // Calculate final total
    const finalTotal = subtotal + shippingCharge - discount;
    
    // Get available coupons for user using coupon service
    const userAvailableCoupons = await couponService.getAvailableCoupons(userId, subtotal);

    // Get checkout message from session
    const checkoutMessage = req.session.checkoutMessage || null;
    req.session.checkoutMessage = null;
    
    res.render("checkout", {
      user: userData,
      cartItems: cartItemsWithOffers,
      addresses: addresses,
      subtotal: subtotal,
      totalItems: totalItems,
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

    // if (!order) {
    //   req.session.checkoutMessage = { type: 'error', text: 'Order not found' };
    //   return res.redirect('/orders');
    // }

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

    res.render("order-success", {
      user: userData,
      order: orderWithCorrectTotals
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

    // Calculate cart subtotal with offers
    const cartItems = await Cart.find({ userId: userId })
      .populate('productId');

    let subtotal = 0;
    for (const item of cartItems) {
      if (item.productId && !item.productId.isBlocked && !item.productId.isDeleted) {
        // Calculate offer for the product
        const offerResult = await offerService.calculateBestOfferForProduct(item.productId._id, userId);

        let finalPrice = item.productId.salePrice;
        if (offerResult) {
          finalPrice = offerResult.finalPrice;
        }

        subtotal += finalPrice * item.quantity;
      }
    }

    // Use coupon service to validate and apply coupon
    const couponResult = await couponService.applyCoupon(couponCode, userId, subtotal);

    if (!couponResult.isValid) {
      return res.json({
        success: false,
        message: couponResult.message
      });
    }

    // Apply coupon to session
    req.session.appliedCoupon = {
      code: couponResult.coupon.code,
      discount: couponResult.discount,
      couponId: couponResult.coupon._id,
      name: couponResult.coupon.name || couponResult.coupon.code
    };

    // Calculate new totals
    const shippingCharge = subtotal >= 500 ? 0 : 50;
    const discount = couponResult.discount;
    const finalTotal = subtotal + shippingCharge - discount;

    res.json({
      success: true,
      message: `Coupon applied successfully! You saved ₹${discount}`,
      coupon: {
        code: couponResult.coupon.code,
        name: couponResult.coupon.name || couponResult.coupon.code,
        discount: discount
      },
      totals: {
        subtotal: subtotal,
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
    for (const item of cartItems) {
      if (item.productId && !item.productId.isBlocked && !item.productId.isDeleted) {
        // Calculate offer for the product
        const offerResult = await offerService.calculateBestOfferForProduct(item.productId._id, userId);

        let finalPrice = item.productId.salePrice;
        if (offerResult) {
          finalPrice = offerResult.finalPrice;
        }

        subtotal += finalPrice * item.quantity;
      }
    }

    const shippingCharge = subtotal >= 500 ? 0 : 50;
    const discount = 0;
    const finalTotal = subtotal + shippingCharge - discount;

    res.json({
      success: true,
      message: 'Coupon removed successfully',
      totals: {
        subtotal: subtotal,
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
