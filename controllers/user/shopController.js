const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const mongoose = require('mongoose');
const offerService = require('../../services/offerService');

//  Shop and product browsing functions from userController.js

const loadShop = async (req, res) => {
  try {
    const userId = req.session.user;
    
    const userData = await User.findById(userId);
    const {
      search = '',
      sort = 'default',
      category = 'all',
      min_price = 0,
      max_price = 2000,
      page = 1
    } = req.query;

    // Base query to filter available and unblocked products
    let query = {
      isBlocked: false,
      isDeleted: { $ne: true },
      status: "Available"
    };

    // Add search filter if provided
    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    // Filter by category and ensure only listed categories are included
    if (category !== 'all') {
      let categoryArray = Array.isArray(category) ? category : category.split(',');
      const categories = await Category.find({ 
        name: { $in: categoryArray.map(cat => new RegExp(`^${cat}$`, 'i')) },
        isListed: true // Only listed categories
      });
      if (categories.length > 0) {
        query.category = { $in: categories.map(cat => cat._id) };
      } else {
        // If no listed categories match, return no products
        query.category = { $in: [] };
      }
    } else {
      // When category is 'all', only show products from listed categories
      const listedCategories = await Category.find({ isListed: true });
      query.category = { $in: listedCategories.map(cat => cat._id) };
    }

    // Add price range filter
    if (min_price || max_price) {
      query.salePrice = { $gte: parseFloat(min_price), $lte: parseFloat(max_price) };
    }

    // Define sort options
    let sortOption = {};
    switch (sort) {
      case 'price_asc': sortOption = { salePrice: 1 }; break;
      case 'price_desc': sortOption = { salePrice: -1 }; break;
      case 'name_asc': sortOption = { productName: 1 }; break;
      case 'name_desc': sortOption = { productName: -1 }; break;
      default: sortOption = { createdAt: -1 };
    }

    const perPage = 9;
    const skip = (page - 1) * perPage;

    // Fetch products with the updated query
    const products = await Product.find(query)
      .populate('category')
      .sort(sortOption)
      .skip(skip)
      .limit(perPage);

    // Fetch recommended products (also respecting listed categories)
    const listedCategories = await Category.find({ isListed: true });
    const recommendedProducts = await Product.find({
      isBlocked: false,
      isDeleted: { $ne: true },
      status: "Available",
      category: { $in: listedCategories.map(cat => cat._id) } // Only from listed categories
    })
      .populate('category')
      .sort({ createdAt: -1 })
      .limit(4);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    // Calculate offers for products
    const productData = await Promise.all(products.map(async (product) => {
      const offerResult = await offerService.calculateBestOfferForProduct(product._id, userId);

      let finalPrice = product.salePrice;
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

      return {
        _id: product._id,
        name: product.productName,
        image: product.productImage && product.productImage.length > 0 ? `/uploads/product-images/${product.productImage[0]}` : '/images/placeholder.jpg',
        category: product.category?.name || 'Uncategorized',
        price: finalPrice,
        originalPrice: product.salePrice,
        discount: discount,
        hasOffer: hasOffer,
        offerInfo: offerInfo,
        isNew: (Date.now() - new Date(product.createdAt)) < (7 * 24 * 60 * 60 * 1000)
      };
    }));

    // Calculate offers for recommended products
    const recommendedProductData = await Promise.all(recommendedProducts.map(async (product) => {
      const offerResult = await offerService.calculateBestOfferForProduct(product._id, userId);

      let finalPrice = product.salePrice;
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

      return {
        _id: product._id,
        name: product.productName,
        image: product.productImage && product.productImage.length > 0 ? `/uploads/product-images/${product.productImage[0]}` : '/images/placeholder.jpg',
        category: product.category?.name || 'Uncategorized',
        price: finalPrice,
        originalPrice: product.salePrice,
        discount: discount,
        hasOffer: hasOffer,
        offerInfo: offerInfo,
        isNew: (Date.now() - new Date(product.createdAt)) < (7 * 24 * 60 * 60 * 1000)
      };
    }));

    // Check if this is an AJAX request
    const isAjaxRequest = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (isAjaxRequest) {
      // For AJAX requests, render only the shop content without layout
      res.render("shop", {
        user: userData,
        products: productData,
        recommendedProducts: recommendedProductData,
        categories: listedCategories,
        query: req.query,
        currentPage: parseInt(page),
        totalPages,
        totalProducts,
        layout: false // This prevents the full page layout from being rendered
      });
    } else {
      // For regular requests, render the full page
      res.render("shop", {
        user: userData,
        products: productData,
        recommendedProducts: recommendedProductData,
        categories: listedCategories,
        query: req.query,
        currentPage: parseInt(page),
        totalPages,
        totalProducts
      });
    }
  } catch (error) {
    console.log("Error loading shop:", error.message);
    res.redirect("/pageNotFound");
  }
};

const loadProductsView = async (req, res) => {
  try {
    const {
      search = '',
      sort = 'default',
      category = 'all',
      min_price = 0,
      max_price = 200,
      page = 1
    } = req.query;

    // Clean query parameters: remove empty search
    let cleanedQuery = { ...req.query };
    if (cleanedQuery.search === '' || cleanedQuery.search === undefined) {
      delete cleanedQuery.search;
    }

    let query = {
      isBlocked: false,
      isDeleted: { $ne: true },
      status: "Available"
    };

    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    if (category !== 'all') {
      let categoryArray = Array.isArray(category) ? category : category.split(',');
      const categories = await Category.find({ 
        name: { $in: categoryArray.map(cat => new RegExp(`^${cat}$`, 'i')) },
        isListed: true
      });
      if (categories.length > 0) {
        query.category = { $in: categories.map(cat => cat._id) };
      }
    }

    if (min_price || max_price) {
      query.salePrice = { $gte: parseFloat(min_price), $lte: parseFloat(max_price) };
    }

    let sortOption = {};
    switch (sort) {
      case 'price_asc': sortOption = { salePrice: 1 }; break;
      case 'price_desc': sortOption = { salePrice: -1 }; break;
      case 'name_asc': sortOption = { productName: 1 }; break;
      case 'name_desc': sortOption = { productName: -1 }; break;
      default: sortOption = { createdAt: -1 };
    }

    const perPage = 9;
    const skip = (page - 1) * perPage;

    const products = await Product.find(query)
      .populate('category')
      .sort(sortOption)
      .skip(skip)
      .limit(perPage);

    const listedCategories = await Category.find({ isListed: true });
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    // Calculate offers for products
    const productData = await Promise.all(products.map(async (product) => {
      const offerResult = await offerService.calculateBestOfferForProduct(product._id);

      let finalPrice = product.salePrice;
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

      return {
        _id: product._id,
        name: product.productName,
        image: product.productImage && product.productImage.length > 0 ? `/uploads/product-images/${product.productImage[0]}` : '/images/placeholder.jpg',
        category: product.category?.name || 'Uncategorized',
        price: finalPrice,
        originalPrice: product.salePrice,
        discount: discount,
        hasOffer: hasOffer,
        offerInfo: offerInfo,
        isNew: (Date.now() - new Date(product.createdAt)) < (7 * 24 * 60 * 60 * 1000)
      };
    }));

    res.render("products-view", {
      products: productData,
      categories: listedCategories,
      query: cleanedQuery,
      currentPage: parseInt(page),
      totalPages,
      totalProducts
    });
  } catch (error) {
    console.log("Error loading products view:", error.message);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  loadShop,
  loadProductsView
};
