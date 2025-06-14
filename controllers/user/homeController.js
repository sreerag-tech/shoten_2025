const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

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

    res.render("home", { 
      user: userData,
      products: filteredProducts
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
