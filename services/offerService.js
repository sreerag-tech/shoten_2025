const Offer = require("../models/offerSchema");
const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");

/**
 * Calculate the best offer for a product
 * Handles cases where both category and product offers are available
 * Returns the largest discount
 */
const calculateBestOfferForProduct = async (productId, userId = null) => {
  try {
    const product = await Product.findById(productId).populate('category');
    if (!product) return null;
    
    const currentDate = new Date();
    
    // Find active product offers
    const productOffers = await Offer.find({
      offerType: 'product',
      applicableProducts: productId,
      isActive: true,
      isDeleted: false,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    });
    
    // Find active category offers (only if product has a category)
    let categoryOffers = [];
    if (product.category && product.category._id) {
      categoryOffers = await Offer.find({
        offerType: 'category',
        applicableCategories: product.category._id,
        isActive: true,
        isDeleted: false,
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate }
      });
    }
    
    // Combine all applicable offers
    const allOffers = [...productOffers, ...categoryOffers];
    
    if (allOffers.length === 0) return null;
    
    // Filter offers based on user usage if userId provided
    let validOffers = allOffers;
    if (userId) {
      validOffers = allOffers.filter(offer => offer.canUserUse(userId));
    }
    
    if (validOffers.length === 0) return null;
    
    // Calculate discount for each offer and find the best one
    let bestOffer = null;
    let maxDiscount = 0;
    
    for (const offer of validOffers) {
      const discount = offer.calculateDiscount(product.salePrice);
      if (discount > maxDiscount) {
        maxDiscount = discount;
        bestOffer = offer;
      }
    }
    
    if (!bestOffer) return null;
    
    return {
      offer: bestOffer,
      originalPrice: product.salePrice,
      discount: maxDiscount,
      finalPrice: product.salePrice - maxDiscount,
      discountPercentage: Math.round((maxDiscount / product.salePrice) * 100)
    };
    
  } catch (error) {
    console.error('Error calculating best offer for product:', error);
    return null;
  }
};

/**
 * Calculate offers for multiple products (for cart/checkout)
 */
const calculateOffersForProducts = async (products, userId = null) => {
  try {
    const results = [];
    
    for (const item of products) {
      const productId = item.productId || item._id;
      const quantity = item.quantity || 1;
      
      const offerResult = await calculateBestOfferForProduct(productId, userId);
      
      if (offerResult) {
        results.push({
          productId: productId,
          quantity: quantity,
          originalPrice: offerResult.originalPrice,
          finalPrice: offerResult.finalPrice,
          discount: offerResult.discount,
          totalDiscount: offerResult.discount * quantity,
          offer: offerResult.offer,
          discountPercentage: offerResult.discountPercentage
        });
      } else {
        // No offer available
        const product = await Product.findById(productId);
        if (product) {
          results.push({
            productId: productId,
            quantity: quantity,
            originalPrice: product.salePrice,
            finalPrice: product.salePrice,
            discount: 0,
            totalDiscount: 0,
            offer: null,
            discountPercentage: 0
          });
        }
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('Error calculating offers for products:', error);
    return [];
  }
};

/**
 * Get all active offers for display
 */
const getActiveOffers = async (offerType = null) => {
  try {
    const currentDate = new Date();
    
    let query = {
      isActive: true,
      isDeleted: false,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate }
    };
    
    if (offerType) {
      query.offerType = offerType;
    }
    
    const offers = await Offer.find(query)
      .populate('applicableProducts', 'productName productImage salePrice')
      .populate('applicableCategories', 'name')
      .sort({ createdAt: -1 });
    
    return offers;
    
  } catch (error) {
    console.error('Error getting active offers:', error);
    return [];
  }
};

/**
 * Apply offer usage when order is placed
 */
const applyOfferUsage = async (offerId, userId) => {
  try {
    const offer = await Offer.findById(offerId);
    if (!offer) return false;
    
    // Update total usage count
    offer.usedCount += 1;
    
    // Update user-specific usage
    const userUsage = offer.usedBy.find(usage => usage.userId.toString() === userId.toString());
    if (userUsage) {
      userUsage.usedCount += 1;
      userUsage.lastUsed = new Date();
    } else {
      offer.usedBy.push({
        userId: userId,
        usedCount: 1,
        lastUsed: new Date()
      });
    }
    
    await offer.save();
    return true;
    
  } catch (error) {
    console.error('Error applying offer usage:', error);
    return false;
  }
};

/**
 * Get product price with best offer applied
 */
const getProductPriceWithOffer = async (productId, userId = null) => {
  try {
    const product = await Product.findById(productId);
    if (!product) return null;
    
    const offerResult = await calculateBestOfferForProduct(productId, userId);
    
    return {
      productId: productId,
      originalPrice: product.salePrice,
      finalPrice: offerResult ? offerResult.finalPrice : product.salePrice,
      discount: offerResult ? offerResult.discount : 0,
      hasOffer: !!offerResult,
      offer: offerResult ? offerResult.offer : null
    };
    
  } catch (error) {
    console.error('Error getting product price with offer:', error);
    return null;
  }
};

/**
 * Validate if offer can be applied to cart
 */
const validateOfferForCart = async (offerId, cartItems, userId) => {
  try {
    const offer = await Offer.findById(offerId);
    if (!offer || !offer.isCurrentlyValid) {
      return { valid: false, message: 'Offer is not valid or has expired' };
    }
    
    if (!offer.canUserUse(userId)) {
      return { valid: false, message: 'You have already used this offer' };
    }
    
    // Calculate cart total
    let cartTotal = 0;
    for (const item of cartItems) {
      const product = await Product.findById(item.productId);
      if (product) {
        cartTotal += product.salePrice * item.quantity;
      }
    }
    
    if (cartTotal < offer.minimumPurchaseAmount) {
      return { 
        valid: false, 
        message: `Minimum purchase amount of ₹${offer.minimumPurchaseAmount} required` 
      };
    }
    
    return { valid: true, offer: offer };
    
  } catch (error) {
    console.error('Error validating offer for cart:', error);
    return { valid: false, message: 'Error validating offer' };
  }
};

module.exports = {
  calculateBestOfferForProduct,
  calculateOffersForProducts,
  getActiveOffers,
  applyOfferUsage,
  getProductPriceWithOffer,
  validateOfferForCart
};
