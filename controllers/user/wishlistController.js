const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const mongoose = require('mongoose');
const Wishlist = mongoose.models.Wishlist || require("../../models/wishListSchema");

// Load Wishlist Page
const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    
    // Get user data for header
    const userData = await User.findById(userId);
    
    // Get wishlist items with populated product and category data
    const wishlistItems = await Wishlist.find({ userId: userId })
      .populate({
        path: 'products.productId',
        populate: {
          path: 'category',
          model: 'Category'
        }
      })
      .sort({ 'products.addedOn': -1 });

    // Extract products from wishlist
    let products = [];
    if (wishlistItems.length > 0) {
      products = wishlistItems[0].products
        .filter(item => item.productId && !item.productId.isDeleted && !item.productId.isBlocked)
        .map(item => ({
          _id: item.productId._id,
          name: item.productId.productName,
          description: item.productId.description,
          price: item.productId.salePrice,
          originalPrice: item.productId.regularPrice,
          image: item.productId.productImage && item.productId.productImage.length > 0
            ? `/uploads/product-images/${item.productId.productImage[0]}`
            : '/images/placeholder.jpg',
          category: item.productId.category ? item.productId.category.name : 'Unknown',
          stock: item.productId.quantity,
          isAvailable: item.productId.quantity > 0,
          discount: item.productId.offerPercentage || 0,
          addedOn: item.addedOn
        }));
    }

    // Get available categories (only listed categories that have products)
    const availableCategories = await Category.find({
      isListed: true
    }).sort({ name: 1 });

    res.render("wishlist", {
      user: userData,
      wishlistItems: products,
      totalItems: products.length,
      availableCategories: availableCategories
    });
  } catch (error) {
    res.status(500).render("pageNotFound");
  }
};

// Add Product to Wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    // Check if product exists and is available
    const product = await Product.findOne({
      _id: productId,
      isDeleted: { $ne: true },
      isBlocked: false
    });

    if (!product) {
      return res.json({ success: false, message: 'Product not found or unavailable' });
    }

    // Find or create user's wishlist
    let wishlist = await Wishlist.findOne({ userId: userId });
    
    if (!wishlist) {
      wishlist = new Wishlist({
        userId: userId,
        products: []
      });
    }

    // Check if product already exists in wishlist
    const existingProduct = wishlist.products.find(
      item => item.productId.toString() === productId
    );

    if (existingProduct) {
      return res.json({ success: false, message: 'Product already in wishlist' });
    }

    // Add product to wishlist
    wishlist.products.push({
      productId: productId,
      addedOn: new Date()
    });

    await wishlist.save();

    res.json({ success: true, message: 'Product added to wishlist successfully' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to add product to wishlist' });
  }
};

// Remove Product from Wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    const wishlist = await Wishlist.findOne({ userId: userId });
    
    if (!wishlist) {
      return res.json({ success: false, message: 'Wishlist not found' });
    }

    // Remove product from wishlist
    wishlist.products = wishlist.products.filter(
      item => item.productId.toString() !== productId
    );

    await wishlist.save();

    res.json({ success: true, message: 'Product removed from wishlist' });
  } catch (error) {
    res.json({ success: false, message: 'Failed to remove product from wishlist' });
  }
};

// Move Product from Wishlist to Cart
const moveToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    // Check if product exists and is available
    const product = await Product.findOne({
      _id: productId,
      isDeleted: { $ne: true },
      isBlocked: false
    }).populate('category');

    if (!product) {
      return res.json({ success: false, message: 'Product not found or unavailable' });
    }

    if (product.quantity <= 0) {
      return res.json({ success: false, message: 'Product is out of stock' });
    }

    // Check if category is available
    if (!product.category || product.category.isListed === false) {
      return res.json({ success: false, message: 'This product category is currently unavailable' });
    }

    // Import Cart model
    const Cart = require("../../models/cartSchema");

    // Check if product already exists in cart
    const existingCartItem = await Cart.findOne({ userId, productId });

    if (existingCartItem) {
      // Update quantity if product already in cart
      const newQuantity = existingCartItem.quantity + 1;

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
      const totalPrice = price * 1;

      const cartItem = new Cart({
        userId,
        productId,
        quantity: 1,
        price: price,
        totalPrice: totalPrice
      });
      await cartItem.save();
    }

    // Remove from wishlist after successfully adding to cart
    const wishlist = await Wishlist.findOne({ userId: userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        item => item.productId.toString() !== productId
      );
      await wishlist.save();
    }

    res.json({
      success: true,
      message: 'Product moved to cart successfully'
    });
  } catch (error) {
    console.error('Error moving to cart:', error);
    res.json({ success: false, message: 'Failed to move product to cart' });
  }
};

// Move All Products from Wishlist to Cart
const moveAllToCart = async (req, res) => {
  try {
    const userId = req.session.user;

    // Get user's wishlist
    const wishlist = await Wishlist.findOne({ userId: userId })
      .populate({
        path: 'products.productId',
        populate: {
          path: 'category'
        }
      });

    if (!wishlist || wishlist.products.length === 0) {
      return res.json({ success: false, message: 'Wishlist is empty' });
    }

    const Cart = require("../../models/cartSchema");
    let movedCount = 0;
    let failedItems = [];

    // Process each wishlist item
    for (const wishlistItem of wishlist.products) {
      const product = wishlistItem.productId;

      // Skip if product doesn't exist or is unavailable
      if (!product || product.isDeleted || product.isBlocked || product.quantity <= 0) {
        failedItems.push({
          name: product?.productName || 'Unknown Product',
          reason: 'Product unavailable or out of stock'
        });
        continue;
      }

      // Skip if category is unavailable
      if (!product.category || product.category.isListed === false) {
        failedItems.push({
          name: product.productName,
          reason: 'Category unavailable'
        });
        continue;
      }

      try {
        // Check if product already exists in cart
        const existingCartItem = await Cart.findOne({ userId, productId: product._id });

        if (existingCartItem) {
          // Update quantity if product already in cart
          const newQuantity = existingCartItem.quantity + 1;

          // Check stock for new quantity
          if (product.quantity < newQuantity) {
            failedItems.push({
              name: product.productName,
              reason: `Only ${product.quantity} items available in stock`
            });
            continue;
          }

          existingCartItem.quantity = newQuantity;
          existingCartItem.price = product.salePrice;
          existingCartItem.totalPrice = product.salePrice * newQuantity;
          await existingCartItem.save();
        } else {
          // Create new cart item
          const cartItem = new Cart({
            userId,
            productId: product._id,
            quantity: 1,
            price: product.salePrice,
            totalPrice: product.salePrice
          });
          await cartItem.save();
        }

        movedCount++;
      } catch (error) {
        failedItems.push({
          name: product.productName,
          reason: 'Failed to add to cart'
        });
      }
    }

    // Clear wishlist of successfully moved items
    if (movedCount > 0) {
      const successfulProductIds = wishlist.products
        .filter(item => !failedItems.some(failed => failed.name === item.productId?.productName))
        .map(item => item.productId._id);

      wishlist.products = wishlist.products.filter(
        item => !successfulProductIds.includes(item.productId._id)
      );
      await wishlist.save();
    }

    // Prepare response message
    let message = '';
    if (movedCount > 0 && failedItems.length === 0) {
      message = `All ${movedCount} items moved to cart successfully`;
    } else if (movedCount > 0 && failedItems.length > 0) {
      message = `${movedCount} items moved to cart. ${failedItems.length} items could not be moved.`;
    } else {
      message = 'No items could be moved to cart';
    }

    res.json({
      success: movedCount > 0,
      message: message,
      movedCount: movedCount,
      failedCount: failedItems.length,
      failedItems: failedItems
    });
  } catch (error) {
    console.error('Error moving all to cart:', error);
    res.json({ success: false, message: 'Failed to move items to cart' });
  }
};

// Clear Entire Wishlist
const clearWishlist = async (req, res) => {
  try {
    const userId = req.session.user;

    await Wishlist.findOneAndUpdate(
      { userId: userId },
      { $set: { products: [] } },
      { upsert: true }
    );

    res.json({ success: true, message: 'Wishlist cleared successfully' });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    res.json({ success: false, message: 'Failed to clear wishlist' });
  }
};

// Get Wishlist Count
const getWishlistCount = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.json({ count: 0 });
    }

    const wishlist = await Wishlist.findOne({ userId: userId });
    const count = wishlist ? wishlist.products.length : 0;

    res.json({ count: count });
  } catch (error) {
    console.error('Error getting wishlist count:', error);
    res.json({ count: 0 });
  }
};

module.exports = {
  loadWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
  moveAllToCart,
  clearWishlist,
  getWishlistCount
};
