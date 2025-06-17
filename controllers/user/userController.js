

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
  setDefaultCheckoutAddress
};