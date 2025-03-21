const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const Product = require('../../models/productSchema');
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadSignUppage = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("signup not found");
    res.status(500).send("server error");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b> Your OTP:${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

const loadLoginpage = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login");
    } else {
      res.redirect("/home"); // Redirect to home if already logged in
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

// File: userController.js

// File: userController.js
// File: userController.js
// Replace the existing loadHome function with this
const loadHome = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect("/login");
    }
    
    const userData = await User.findById(userId);

    // Fetch products
    const products = await Product.find({ 
      isBlocked: false,
      status: "Available" 
    })
    .sort({ createdAt: -1 })
    .limit(8);

    // Debug log to check the products
    console.log("Products from DB:", products.map(p => ({
      name: p.productName,
      images: p.productImage
    })));

    res.render("home", { 
      user: userData,
      products: products
    });
  } catch (error) {
    console.log("Home not found", error);
    res.status(500).send("server error");
  }
};

const loadLandingpage = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect("/home"); // Redirect to home if already logged in
    }
    return res.render("landing");
  } catch (error) {
    console.log("Landing page not found", error);
    res.status(500).send("server error");
  }
};

const signup = async (req, res) => {
  try {
    const { name, email, password, cPassword } = req.body;

    if (!email || !password || !cPassword) {
      return res.render("signup", { message: "All fields are required" });
    }

    if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "User already exists" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      console.log("Failed to send OTP to:", email);
      return res.render("signup", {
        message: "Failed to send OTP. Check email settings.",
      });
    }

    req.session.userOtp = otp;
    req.session.otpTimestamp = Date.now();
    req.session.userData = { name, email, password };
    res.render("verify-otp");
    console.log("OTP sent:", otp);
  } catch (error) {
    console.error("Signup error:", error);
    return res.redirect("/pageNotFound");
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error hashing password:", error);
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const otpTimestamp = req.session.otpTimestamp;
    const currentTime = Date.now();
    const timeDifference = (currentTime - otpTimestamp) / 1000;

    console.log(
      "OTP:",
      otp,
      "Session OTP:",
      req.session.userOtp,
      "Time elapsed (s):",
      timeDifference
    );

    if (!otpTimestamp || timeDifference > 120) {
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });
    }

    if (otp === req.session.userOtp) {
      const user = req.session.userData;

      const existingUser = await User.findOne({ email: user.email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "A user with this email already exists",
        });
      }

      const passwordHash = await securePassword(user.password);
      const saveUserData = new User({
        name: user.name,
        email: user.email,
        password: passwordHash,
      });
      await saveUserData.save();
      req.session.user = saveUserData._id;
      res.json({ success: true, redirectUrl: "/home" }); // Redirect to home after OTP verification
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists",
      });
    }
    res
      .status(500)
      .json({ success: false, message: "An error occurred during verification" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const email = req.session.userData?.email;
    if (!email) {
      console.log("Email not found in session:", req.session);
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpTimestamp = Date.now();

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP sent successfully:", otp, "to", email);
      return res
        .status(200)
        .json({ success: true, message: "OTP resent successfully" });
    } else {
      console.log("Failed to resend OTP to:", email);
      return res
        .status(500)
        .json({ success: false, message: "Failed to resend OTP" });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email: email });
    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" });
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect password" });
    }
    req.session.user = findUser._id;
    res.redirect("/home"); // Redirect to home after login
  } catch (error) {
    console.error("Login error", error);
    res.render("login", { message: "Login failed, please try again later" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Session destruction error", err);
        return res.redirect("/pageNotFound");
      }
       res.redirect("/login");
    });
  } catch (error) {
    console.log("Logout error", error);
    res.redirect("/pageNotFound");
  }
};

const loadForgotPassword = async (req, res) => {
  try {
    res.render("forgot-password", { message: "" });
  } catch (error) {
    console.log("Forgot password page not found", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error loading forgot password page" 
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "No account found with this email" 
      });
    }

    // Generate reset token and OTP
    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour expiry
    const otp = generateOtp(); // Using your existing generateOtp function

    // Log the OTP to console
    console.log(`Reset Password OTP for ${email}: ${otp}`);

    // Save token and OTP to user
    user.forgotPasswordOtp = resetToken;
    user.otpExpires = resetTokenExpiry;
    user.resetPasswordOtp = otp; // Store OTP in the user document
    await user.save();

    // Send OTP via email
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again."
      });
    }

    res.json({ 
      success: true, 
      message: "OTP has been sent to your email",
      token: resetToken,
      redirectUrl: `/newPassword?token=${resetToken}`
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ 
      success: false, 
      message: "An error occurred. Please try again."
    });
  }
};

const loadNewPassword = async (req, res) => {
  try {
    const { token } = req.query;
    
    const user = await User.findOne({
      forgotPasswordOtp: token,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.render("forgot-password", { 
        message: "Invalid or expired reset token" 
      });
    }

    res.render("new-password", { 
      token: token,
      message: ""
    });
  } catch (error) {
    console.error("Load new password error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error loading new password page" 
    });
  }
};

const newPassword = async (req, res) => {
  try {
    const { token, otp, password } = req.body;
    
    const user = await User.findOne({
      forgotPasswordOtp: token,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    // Hash new password
    const hashedPassword = await securePassword(password);
    
    // Update user password and clear reset fields
    user.password = hashedPassword;
    user.forgotPasswordOtp = null;
    user.otpExpires = null;
    user.resetPasswordOtp = null;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error) {
    console.error("New password error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while resetting password"
    });
  }
};




const Category = require('../../models/categorySchema'); // Only import Category here if not already imported

const loadShop = async (req, res) => {
  try {
    // Get query parameters from the request
    const {
      search = '',
      sort = 'default',
      category = 'all',
      min_price = 0,
      max_price = 200,
      page = 1
    } = req.query;

    // Build the product query
    let query = {
      isBlocked: false, // Exclude blocked products
      status: "Available" // Only show available products
    };

    // Search filter
    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    // Category filter
    if (category !== 'all') {
      let categoryArray;
      if (Array.isArray(category)) {
        categoryArray = category;
      } else if (typeof category === 'string') {
        categoryArray = category.split(',');
      } else {
        categoryArray = [category];
      }

      const categories = await Category.find({ 
        name: { $in: categoryArray.map(cat => new RegExp(`^${cat}$`, 'i')) },
        isListed: true
      });

      console.log("Requested categories:", categoryArray);
      console.log("Found categories:", categories);

      if (categories.length > 0) {
        query.category = { $in: categories.map(cat => cat._id) };
      }
    }

    // Price range filter
    if (min_price || max_price) {
      query.salePrice = { $gte: parseFloat(min_price), $lte: parseFloat(max_price) };
    }

    // Sorting logic
    let sortOption = {};
    switch (sort) {
      case 'price_asc':
        sortOption = { salePrice: 1 };
        break;
      case 'price_desc':
        sortOption = { salePrice: -1 };
        break;
      case 'name_asc':
        sortOption = { productName: 1 };
        break;
      case 'name_desc':
        sortOption = { productName: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    // Pagination
    const perPage = 9;
    const skip = (page - 1) * perPage;

    // Fetch products
    const products = await Product.find(query)
      .populate('category')
      .sort(sortOption)
      .skip(skip)
      .limit(perPage);

    // Fetch recommended products (e.g., 4 random available products)
    const recommendedProducts = await Product.find({
      isBlocked: false,
      status: "Available"
    })
      .populate('category')
      .sort({ createdAt: -1 }) // Newest first
      .limit(4);

    // Fetch listed categories for filter
    const listedCategories = await Category.find({ isListed: true });

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    // Transform product data
    const productData = products.map(product => ({
      name: product.productName,
      image: product.productImage && product.productImage.length > 0 ? `/uploads/product-images/${product.productImage[0]}` : '/images/placeholder.jpg',
      category: product.category?.name || 'Uncategorized',
      price: product.salePrice,
      originalPrice: product.regularPrice,
      discount: product.offerPercentage > 0 ? product.offerPercentage : 0,
      isNew: (Date.now() - new Date(product.createdAt)) < (7 * 24 * 60 * 60 * 1000)
    }));

    // Transform recommended product data
    const recommendedProductData = recommendedProducts.map(product => ({
      name: product.productName,
      image: product.productImage && product.productImage.length > 0 ? `/uploads/product-images/${product.productImage[0]}` : '/images/placeholder.jpg',
      category: product.category?.name || 'Uncategorized',
      price: product.salePrice,
      originalPrice: product.regularPrice,
      discount: product.offerPercentage > 0 ? product.offerPercentage : 0,
      isNew: (Date.now() - new Date(product.createdAt)) < (7 * 24 * 60 * 60 * 1000)
    }));

    // Debug logs
    console.log("Query:", query);
    console.log("Fetched Products:", products.length);
    console.log("Product Data:", productData);
    console.log("Recommended Products:", recommendedProductData);
    console.log("Listed Categories:", listedCategories);

    // Render shop page with data
    res.render("shop", {
      products: productData,
      recommendedProducts: recommendedProductData, // Add recommended products
      categories: listedCategories, // Add listed categories
      query: req.query,
      currentPage: parseInt(page),
      totalPages,
      totalProducts
    });
  } catch (error) {
    console.log("Error loading shop:", error.message);
    res.redirect("/pageNotFound");
  }
};
module.exports = {
  loadHome,
  loadLandingpage,
  loadSignUppage,
  loadLoginpage,
  signup,
  verifyOtp,
  resendOtp,
  pageNotFound,
  login,
  logout,
  loadForgotPassword, 
  resetPassword,      
  loadNewPassword,    
  newPassword  ,
  loadShop       
};

