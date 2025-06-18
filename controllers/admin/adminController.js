//this page give the basic login ,logout and admin opening working


const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const mongoose = require("mongoose");
const bcrypt = require(`bcrypt`);


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

      // Get total revenue
      const revenueResult = await Order.aggregate([
        { $match: { status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, totalRevenue: { $sum: "$totalPrice" } } }
      ]);
      const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

      // Get recent orders (last 5)
      const recentOrders = await Order.find()
        .populate('userId', 'name email profileImage')
        .sort({ createdOn: -1 })
        .limit(5);

      // Get latest products (last 5)
      const latestProducts = await Product.find({ isBlocked: false })
        .populate('category', 'name')
        .sort({ createdOn: -1 })
        .limit(5);

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