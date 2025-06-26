

// Import organized controller modules
const authController = require('./authController');
const passwordController = require('./passwordController');
const homeController = require('./homeController');
const shopController = require('./shopController');
const productController = require('./productController');
const profileController = require('./profileController');
const orderController = require('./orderController');
const orderActionsController = require('./orderActionsController');
const invoiceController = require('./invoiceController');
const cartController = require('./cartController');
const cartActionsController = require('./cartActionsController');
const wishlistController = require('./wishlistController');
const walletController = require('./walletController');
const checkoutController = require('./checkoutController');
const checkoutActionsController = require('./checkoutActionsController');

//  Export functions from organized controllers

// Home and landing page functions
const { pageNotFound, loadLandingpage, loadHome } = homeController;

// Authentication functions
const {
  loadSignUppage,
  loadLoginpage,
  signup,
  verifyOtp,
  resendOtp,
  login,
  googleCallbackHandler,
  logout
} = authController;

// Password reset functions
const {
  loadForgotPassword,
  resetPassword,
  loadNewPassword,
  newPassword
} = passwordController;

// Shop functions
const { loadShop, loadProductsView } = shopController;

// Product functions
const { loadProductDetail } = productController;

// Profile functions
const {
  loadProfile,
  loadEditProfile,
  updateProfile,
  updateBasicProfile,
  changeEmail,
  addAddress,
  getAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress,
  changePassword,
  loadEmailVerification,
  verifyEmailOTP,
  resendEmailOTP
} = profileController;

// Order functions
const {
  loadOrders,
  loadOrderDetail,
  getOrderDetailsAPI
} = orderController;

// Order action functions
const {
  cancelOrder,
  cancelOrderItem,
  returnOrder,
  returnOrderItem
} = orderActionsController;

// Invoice functions
const {
  downloadInvoice
} = invoiceController;

// Cart functions
const {
  loadCart,
  getCartCount
} = cartController;

// Cart action functions
const {
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart
} = cartActionsController;

// Wishlist functions
const {
  loadWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
  moveAllToCart,
  clearWishlist,
  getWishlistCount
} = wishlistController;

// Wallet functions
const {
  loadWallet,
  addMoney,
  getWalletBalance,
  getTransactionHistory,
  useWalletForPayment
} = walletController;

// Checkout functions
const {
  loadCheckout,
  loadOrderSuccess,
  applyCoupon,
  removeCoupon
} = checkoutController;

// Checkout action functions
const {
  placeOrder,
  addCheckoutAddress,
  setDefaultCheckoutAddress
} = checkoutActionsController;

// ✅ REFACTORED: Export all functions from organized controller modules
module.exports = {
  // Home and landing page functions
  pageNotFound,
  loadLandingpage,
  loadHome,
  

  // Authentication functions
  loadSignUppage,
  loadLoginpage,
  signup,
  verifyOtp,
  resendOtp,
  login,
  googleCallbackHandler,
  logout,

  // Password reset functions
  loadForgotPassword,
  resetPassword,
  loadNewPassword,
  newPassword,

  // Shop functions
  loadShop,
  loadProductsView,

  // Product functions
  loadProductDetail,

  // Profile functions
  loadProfile,
  loadEditProfile,
  updateProfile,
  updateBasicProfile,
  changeEmail,
  addAddress,
  getAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress,
  changePassword,
  loadEmailVerification,
  verifyEmailOTP,
  resendEmailOTP,

  // Order functions
  loadOrders,
  loadOrderDetail,
  getOrderDetailsAPI,
  cancelOrder,
  cancelOrderItem,
  returnOrder,
  returnOrderItem,
  downloadInvoice,

  // Cart functions
  loadCart,
  getCartCount,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,

  // Wishlist functions
  loadWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
  moveAllToCart,
  clearWishlist,
  getWishlistCount,

  // Wallet functions
  loadWallet,
  addMoney,
  getWalletBalance,
  getTransactionHistory,
  useWalletForPayment,

  // Checkout functions
  loadCheckout,
  loadOrderSuccess,
  placeOrder,
  addCheckoutAddress,
  setDefaultCheckoutAddress,
  applyCoupon,
  removeCoupon,

  // Session status function
  getSessionStatus: async (req, res) => {
    try {
      if (req.session.user) {
        // User is logged in, get user data
        const User = require("../../models/userSchema");
        const user = await User.findById(req.session.user).select('name email isBlocked');

        if (user) {
          if (user.isBlocked) {
            // User is blocked, destroy session immediately
            req.session.destroy((err) => {
              if (err) {
                console.error('Error destroying session for blocked user:', err);
              }
            });
            return res.json({
              isLoggedIn: false,
              reason: 'User is blocked',
              message: 'Your account has been blocked by the administrator.'
            });
          } else {
            // User is active
            return res.json({
              isLoggedIn: true,
              user: {
                id: user._id,
                name: user.name,
                email: user.email
              }
            });
          }
        } else {
          // User not found, destroy session
          req.session.destroy((err) => {
            if (err) {
              console.error('Error destroying session for non-existent user:', err);
            }
          });
          return res.json({
            isLoggedIn: false,
            reason: 'User not found',
            message: 'User account no longer exists.'
          });
        }
      } else {
        // No session
        return res.json({
          isLoggedIn: false,
          reason: 'No session',
          message: 'Please login to continue.'
        });
      }
    } catch (error) {
      console.error('Error checking session status:', error);
      return res.json({
        isLoggedIn: false,
        reason: 'Server error',
        message: 'An error occurred. Please try again.'
      });
    }
  }
};