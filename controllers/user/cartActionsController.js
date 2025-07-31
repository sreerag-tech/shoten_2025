const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const mongoose = require('mongoose');
const Wishlist = mongoose.models.Wishlist || require("../../models/wishListSchema");
const offerService = require("../../services/offerService");

// Maximum quantity per product
const MAX_QUANTITY_PER_PRODUCT = 10;

// Add Product to Cart
const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity = 1 } = req.body;
    
    if (!userId) {
      return res.json({ success: false, message: 'Please login to add items to cart' });
    }
    
    // Validate quantity
    const qty = parseInt(quantity);
    if (qty < 1 || qty > MAX_QUANTITY_PER_PRODUCT) {
      return res.json({ 
        success: false, 
        message: `Quantity must be between 1 and ${MAX_QUANTITY_PER_PRODUCT}` 
      });
    }
    
    // Get product with category
    const product = await Product.findById(productId).populate('category');

    if (!product) {
      return res.json({ success: false, message: 'Product not found' });
    }



    // Check if product is blocked, deleted, or not available
    if (product.isBlocked || product.isDeleted || product.status !== 'Available') {
      return res.json({ success: false, message: 'This product is currently unavailable' });
    }
    
    // Check if category is unlisted
    if (!product.category || product.category.isListed === false) {

      return res.json({ success: false, message: 'This product category is currently unavailable' });
    }
    
    // Check stock availability
    if (product.quantity < qty) {
      // Check if product is completely out of stock
      if (product.quantity <= 0) {
        // Remove item from cart if completely out of stock
        await Cart.deleteOne({ _id: existingCartItem._id });
        return res.json({ 
          success: true,
          message: 'Product removed from cart as it is out of stock',
          shouldRemove: true
        });
      }
      return res.json({ 
        success: false, 
        message: `Only ${product.quantity} items available in stock` 
      });
    }
    
    // Check if product already exists in cart
    const existingCartItem = await Cart.findOne({ userId, productId });
    
    if (existingCartItem) {
      // Update quantity if product already in cart
      const newQuantity = existingCartItem.quantity + qty;
      
      // Check maximum quantity limit
      if (newQuantity > MAX_QUANTITY_PER_PRODUCT) {
        return res.json({ 
          success: false, 
          message: `Maximum ${MAX_QUANTITY_PER_PRODUCT} items allowed per product` 
        });
      }
      
      // Check stock for new quantity
      if (product.quantity < newQuantity) {
        return res.json({ 
          success: false, 
          message: `Only ${product.quantity} items available in stock` 
        });
      }
      
      existingCartItem.quantity = newQuantity;
      existingCartItem.price = product.salePrice;
      existingCartItem.totalPrice = product.salePrice * newQuantity;
      await existingCartItem.save();
    } else {
      // Create new cart item
      const price = product.salePrice;
      const totalPrice = price * qty;

      const cartItem = new Cart({
        userId,
        productId,
        quantity: qty,
        price: price,
        totalPrice: totalPrice
      });
      await cartItem.save();
    }
    
    // Remove from wishlist if exists
    await removeFromWishlistHelper(userId, productId);
    
    // Get updated cart count
    const cartCount = await getCartItemCount(userId);
    
    res.json({ 
      success: true, 
      message: 'Product added to cart successfully',
      cartCount: cartCount
    });
    
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.json({ success: false, message: 'Failed to add product to cart' });
  }
};

// Update Cart Item Quantity
const updateCartQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const { cartItemId, action } = req.body; // action: 'increment' or 'decrement'
    
    if (!userId) {
      return res.json({ success: false, message: 'Please login to update cart' });
    }
    
    // Get cart item with product details
    const cartItem = await Cart.findOne({ _id: cartItemId, userId }).populate('productId');
    
    if (!cartItem) {
      return res.json({ success: false, message: 'Cart item not found' });
    }
    
    // Check if product is still available
    if (!cartItem.productId || cartItem.productId.isBlocked || cartItem.productId.isDeleted || cartItem.productId.status !== 'Available') {
      // Remove invalid item
      await Cart.findByIdAndDelete(cartItemId);
      return res.json({
        success: false,
        message: 'Product is no longer available',
        shouldRemove: true
      });
    }
    
    let newQuantity = cartItem.quantity;
    
    if (action === 'increment') {
      newQuantity += 1;
      
      // Check maximum quantity limit
      if (newQuantity > MAX_QUANTITY_PER_PRODUCT) {
        return res.json({ 
          success: false, 
          message: `Maximum ${MAX_QUANTITY_PER_PRODUCT} items allowed per product` 
        });
      }
      
      // Check stock availability
      if (cartItem.productId.quantity < newQuantity) {
        return res.json({ 
          success: false, 
          message: `Only ${cartItem.productId.quantity} items available in stock` 
        });
      }
    } else if (action === 'decrement') {
      newQuantity -= 1;
      
      // Remove item if quantity becomes 0
      if (newQuantity <= 0) {
        await Cart.findByIdAndDelete(cartItemId);
        const cartCount = await getCartItemCount(userId);
        return res.json({ 
          success: true, 
          message: 'Item removed from cart',
          shouldRemove: true,
          cartCount: cartCount
        });
      }
    } else {
      return res.json({ success: false, message: 'Invalid action' });
    }
    
    // Calculate offer for the product
    const offerResult = await offerService.calculateBestOfferForProduct(cartItem.productId._id, userId);

    let finalPrice = cartItem.productId.salePrice;
    if (offerResult) {
      finalPrice = offerResult.finalPrice;
    }

    // Update quantity and prices with offer-adjusted price
    cartItem.quantity = newQuantity;
    cartItem.price = finalPrice;
    cartItem.totalPrice = finalPrice * newQuantity;
    await cartItem.save();

    // Calculate new item total with offers
    const itemTotal = cartItem.totalPrice;
    const cartCount = await getCartItemCount(userId);

    res.json({
      success: true,
      message: 'Cart updated successfully',
      newQuantity: newQuantity,
      itemTotal: itemTotal,
      cartCount: cartCount
    });
    
  } catch (error) {
    console.error('Error updating cart quantity:', error);
    res.json({ success: false, message: 'Failed to update cart' });
  }
};

// Remove Item from Cart
const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { cartItemId } = req.body;
    
    if (!userId) {
      return res.json({ success: false, message: 'Please login to remove items from cart' });
    }
    
    // Remove cart item
    const result = await Cart.findOneAndDelete({ _id: cartItemId, userId });
    
    if (!result) {
      return res.json({ success: false, message: 'Cart item not found' });
    }
    
    const cartCount = await getCartItemCount(userId);
    
    res.json({ 
      success: true, 
      message: 'Item removed from cart successfully',
      cartCount: cartCount
    });
    
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.json({ success: false, message: 'Failed to remove item from cart' });
  }
};

// Clear Cart
const clearCart = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.json({ success: false, message: 'Please login to clear cart' });
    }
    
    await Cart.deleteMany({ userId });
    
    res.json({ 
      success: true, 
      message: 'Cart cleared successfully',
      cartCount: 0
    });
    
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.json({ success: false, message: 'Failed to clear cart' });
  }
};

// Helper function to remove product from wishlist
const removeFromWishlistHelper = async (userId, productId) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        item => item.productId.toString() !== productId.toString()
      );
      await wishlist.save();
    }
  } catch (error) {
    console.error('Error removing from wishlist:', error);
  }
};

// Helper function to get cart item count
async function getCartItemCount(userId) {
  try {
    const cartItems = await Cart.find({ userId }).populate({
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
    
    return validItems.reduce((sum, item) => sum + item.quantity, 0);
  } catch (error) {
    console.error('Error getting cart count:', error);
    return 0;
  }
}

module.exports = {
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart
};
