const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const offerService = require("../../services/offerService");

// Load Cart Page
const loadCart = async (req, res) => {
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
      return true;
    });
    
    // Remove invalid items from cart
    const invalidItems = cartItems.filter(item => !validCartItems.includes(item));
    if (invalidItems.length > 0) {
      await Cart.deleteMany({ 
        _id: { $in: invalidItems.map(item => item._id) } 
      });
    }
    
    // Calculate cart totals with offers
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
    
    // Get cart message from session
    const cartMessage = req.session.cartMessage || null;
    req.session.cartMessage = null;
    
    res.render("cart", {
      user: userData,
      cartItems: cartItemsWithOffers,
      subtotal: subtotal,
      totalItems: totalItems,
      cartMessage: cartMessage
    });
  } catch (error) {
    console.error('Error loading cart:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Get Cart Count (for header)
const getCartCount = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.json({ count: 0 });
    }
    
    // Get cart items with valid products only
    const cartItems = await Cart.find({ userId: userId })
      .populate({
        path: 'productId',
        populate: {
          path: 'category',
          model: 'Category'
        }
      });
    
    // Count only valid items
    const validItems = cartItems.filter(item => {
      if (!item.productId) return false;
      if (item.productId.isBlocked || item.productId.isDeleted || item.productId.status !== 'Available') return false;
      if (!item.productId.category) return false;
      if (item.productId.category.isListed === false) return false;
      return true;
    });
    
    const totalCount = validItems.reduce((sum, item) => sum + item.quantity, 0);
    
    res.json({ count: totalCount });
  } catch (error) {
    console.error('Error getting cart count:', error);
    res.json({ count: 0 });
  }
};

module.exports = {
  loadCart,
  getCartCount
};
