const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

// ✅ EXTRACTED: Product detail functions from userController.js

const loadProductDetail = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const productId = req.params.id;

    // Validate the product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.render("product-detail", { product: null, relatedProducts: [] });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: { $ne: true }
    }).populate('category');

    if (!product) {
      return res.render("product-detail", { product: null, relatedProducts: [] });
    }

    // Prepare product data regardless of status
    const productData = {
      _id: product._id,
      name: product.productName,
      description: product.description,
      image: product.productImage && product.productImage.length > 0 ? `/uploads/product-images/${product.productImage[0]}` : '/images/placeholder.jpg',
      // Fix: Only include additional images in gallery (excluding the main image)
      gallery: product.productImage && product.productImage.length > 1
        ? product.productImage.slice(1).map(img => `/uploads/product-images/${img}`)
        : [],
      category: product.category?.name || 'Uncategorized',
      price: product.salePrice,
      originalPrice: product.regularPrice,
      discount: product.offerPercentage > 0 ? product.offerPercentage : 0,
      stock: product.quantity,
      isNew: (Date.now() - new Date(product.createdAt)) < (7 * 24 * 60 * 60 * 1000),
      rating: product.averageRating || 0,
      reviewCount: 0, // Placeholder
      coupons: [], // Placeholder
      highlights: [], // Placeholder
      specifications: {}, // Placeholder
      longDescription: product.description,
      reviews: [], // Placeholder
      ratingDistribution: null, // Placeholder
      isBlocked: product.isBlocked, // Pass blocked status
      status: product.status // Pass availability status
    };

    // Fetch related products
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isBlocked: false,
      isDeleted: { $ne: true },
      status: "Available"
    })
      .sort({ popularityScore: -1 })
      .limit(4)
      .select('productName productImage salePrice regularPrice offerPercentage createdAt');

    const relatedProductsData = relatedProducts.map(related => ({
      _id: related._id,
      name: related.productName,
      image: related.productImage && related.productImage.length > 0 ? `/uploads/product-images/${related.productImage[0]}` : '/images/placeholder.jpg',
      price: related.salePrice,
      originalPrice: related.regularPrice,
      discount: related.offerPercentage > 0 ? related.offerPercentage : 0,
      rating: related.averageRating || 0,
      reviewCount: 0,
      isNew: (Date.now() - new Date(related.createdAt)) < (7 * 24 * 60 * 60 * 1000)
    }));

    res.render("product-detail", {
      user: userData,
      product: productData,
      relatedProducts: relatedProductsData
    });
  } catch (error) {
    console.log("Error loading product detail:", error.message);
    res.render("product-detail", { product: null, relatedProducts: [] });
  }
};

module.exports = {
  loadProductDetail
};
