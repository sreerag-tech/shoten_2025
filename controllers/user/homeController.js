const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const offerService = require('../../services/offerService');

//  Home and landing page functions from userController.js

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadLandingpage = async (req, res) => { 
  try {
    if (req.session.user) {
      return res.redirect("/home");
    }
    return res.render("landing");
  } catch (error) {
    console.log("Landing page not found", error);
    res.status(500).send("server error");
  }
};

const loadHome = async (req, res) => {
  try {
    const userId = req.session.user;

    const userData = await User.findById(userId);

    const products = await Product.find({
      isBlocked: false,
      isDeleted: { $ne: true },
      status: "Available",
    })
    .populate({
      path: 'category',
      match: { isListed: true }
    })
    .sort({ createdAt: -1 })
    .limit(8);

    const filteredProducts = products.filter(product => product.category);

    // Calculate offers for home page products
    const productsWithOffers = await Promise.all(filteredProducts.map(async (product) => {
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
        productName: product.productName,
        productImage: product.productImage,
        category: product.category,
        price: finalPrice,
        originalPrice: product.salePrice,
        discount: discount,
        hasOffer: hasOffer,
        offerInfo: offerInfo,
        createdAt: product.createdAt,
        status: product.status,
        quantity: product.quantity
      };
    }));

    res.render("home", {
      user: userData,
      products: productsWithOffers
    });
  } catch (error) {
    console.log("Home not found", error);
    res.status(500).send("server error");
  }
};

module.exports = {
  pageNotFound,
  loadLandingpage,
  loadHome
};
