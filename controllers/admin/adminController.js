//this page give the basic login ,logout and admin opening working


const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const mongoose = require("mongoose");
const bcrypt = require(`bcrypt`);
const offerService = require("../../services/offerService");


const pageerror= async(req,res)=>{
  res.render("admin-error")
}


const loadLogin=(req,res)=>{
  if(req.session.admin){
    return res.redirect("/admin/dashboard")
  }
  res.render("admin-login",{message:null})
}


const login = async (req, res) => {
  try {
    const { email, password } = req.body;
   

    // Find admin user
    const admin = await User.findOne({ email, isAdmin: true });
    
    if (!admin) {
      // Render admin login page with error message if no admin found
      return res.render('admin-login', { 
        message: 'Invalid email or password',
       
      });
    }
    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, admin.password);
    
    if (passwordMatch) {
      // Successful login
      req.session.admin = true;
      req.session.adminId = admin._id;
      return res.redirect('/admin/dashboard');
    } else {
      // Render admin login page with error message if password doesn't match
      return res.render('admin-login', { 
        message: 'Invalid email or password',
        email // Keep email in form
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    // Render admin login page with generic error
    return res.render('admin-login', { 
      message: 'An error occurred. Please try again.',
      email: req.body.email
    });
  }
};


const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      // Get dashboard statistics
      const totalCustomers = await User.countDocuments({ isAdmin: false });
      const totalProducts = await Product.countDocuments();
      const totalOrders = await Order.countDocuments();

      // Get total revenue (offer-adjusted)
      const orders = await Order.find({ status: { $ne: 'Cancelled' } })
        .populate('orderedItems.product');

      let totalRevenue = 0;
      for (const order of orders) {
        let orderTotal = 0;

        for (const item of order.orderedItems) {
          if (item.product) {
            const offerResult = await offerService.calculateBestOfferForProduct(item.product._id);

            let finalPrice = item.price;
            if (offerResult) {
              finalPrice = offerResult.finalPrice;
            }

            orderTotal += finalPrice * item.quantity;
          } else {
            orderTotal += item.price * item.quantity;
          }
        }

        // Add shipping and subtract discounts
        orderTotal += (order.shippingCharge || 0) - (order.discount || 0);
        totalRevenue += orderTotal;
      }

      // Get recent orders (last 5) with offer-adjusted amounts
      const recentOrdersRaw = await Order.find()
        .populate('userId', 'name email profileImage')
        .populate('orderedItems.product')
        .sort({ createdOn: -1 })
        .limit(5);

      // Calculate offer-adjusted amounts for recent orders
      const recentOrders = await Promise.all(recentOrdersRaw.map(async (order) => {
        let orderTotal = 0;

        for (const item of order.orderedItems) {
          if (item.product) {
            const offerResult = await offerService.calculateBestOfferForProduct(item.product._id);

            let finalPrice = item.price;
            if (offerResult) {
              finalPrice = offerResult.finalPrice;
            }

            orderTotal += finalPrice * item.quantity;
          } else {
            orderTotal += item.price * item.quantity;
          }
        }

        // Add shipping and subtract discounts
        orderTotal += (order.shippingCharge || 0) - (order.discount || 0);

        return {
          ...order.toObject(),
          totalPriceWithOffers: orderTotal
        };
      }));

      // Get latest products (last 5) with offers
      const latestProductsRaw = await Product.find({ isBlocked: false })
        .populate('category', 'name')
        .sort({ createdOn: -1 })
        .limit(5);

      // Calculate offers for latest products
      const latestProducts = await Promise.all(latestProductsRaw.map(async (product) => {
        const offerResult = await offerService.calculateBestOfferForProduct(product._id);

        let finalPrice = product.salePrice;
        let hasOffer = false;
        let offerInfo = null;

        if (offerResult) {
          finalPrice = offerResult.finalPrice;
          hasOffer = true;
          offerInfo = {
            type: offerResult.offer.offerType,
            name: offerResult.offer.offerName,
            discountAmount: offerResult.discount,
            discountPercentage: offerResult.discountPercentage
          };
        }

        return {
          ...product.toObject(),
          finalPrice: finalPrice,
          hasOffer: hasOffer,
          offerInfo: offerInfo
        };
      }));

      // Get order statistics by status
      const orderStats = await Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalPrice" }
          }
        }
      ]);

      res.render("dashboard", {
        totalCustomers,
        totalProducts,
        totalOrders,
        totalRevenue,
        recentOrders,
        latestProducts,
        orderStats,
        activePage: 'dashboard'
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.redirect("/admin/pageerror");
    }
  } else {
    res.redirect("/admin/login");
  }
};


const logout = async(req,res)=>{
  try{
    req.session.destroy(err=>{
      if(err){
        console.log("error destroying session",err);
        return res.redirect("/pageerror")
      }
      res.redirect("/admin/login")
    })
  }catch(error){
    console.log(("unexpected error during logout",error));
    res.redirect("/pageerror")
  }
}






module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
} 