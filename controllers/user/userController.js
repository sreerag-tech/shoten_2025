

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
  addAddress,
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
  loadOrderDetail
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

// Checkout functions
const {
  loadCheckout,
  loadOrderSuccess
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
  addAddress,
  deleteAddress,
  setDefaultAddress,
  changePassword,
  loadEmailVerification,
  verifyEmailOTP,
  resendEmailOTP,

  // Order functions
  loadOrders,
  loadOrderDetail,
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

  // Checkout functions
  loadCheckout,
  loadOrderSuccess,
  placeOrder,
  addCheckoutAddress,
  setDefaultCheckoutAddress
};