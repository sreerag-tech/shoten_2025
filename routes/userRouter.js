const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");
const  {userAuth}  = require("../middlewares/auth"); // Import userAuth middleware

// Import existing multer configuration for profile uploads
const multer = require("multer");
const path = require("path");

// Profile image upload configuration
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/profiles/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

router.get("/", userController.loadLandingpage);
router.get("/signup", userController.loadSignUppage);
router.get("/login", userController.loadLoginpage);
router.get("/home",userController.loadHome);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.post("/login", userController.login);
router.post("/logout", userController.logout);
router.get("/pageNotFound", userController.pageNotFound);
router.get("/forgot-password", userController.loadForgotPassword);
router.post("/resetPassword", userController.resetPassword);
router.get("/newPassword", userController.loadNewPassword);
router.post("/newPassword", userController.newPassword);
router.get("/shop", userController.loadShop);
router.get('/shop/product/:id', userController.loadProductDetail);
router.get('/profile', userAuth, userController.loadProfile);
router.get('/profile/edit', userAuth, userController.loadEditProfile);
router.post('/profile', userAuth, profileUpload.single('profileImage'), userController.updateProfile);

// Address Management Routes
router.post('/profile/address', userAuth, userController.addAddress);
router.put('/profile/address/:id', userAuth, userController.editAddress);
router.delete('/profile/address/:id', userAuth, userController.deleteAddress);
router.put('/profile/address/:id/default', userAuth, userController.setDefaultAddress);

// Password Change Route
router.post('/profile/change-password', userAuth, userController.changePassword);

// Email Change Route
router.post('/profile/change-email', userAuth, userController.changeEmail);

// Email Verification Routes
router.get('/profile/verify-email', userAuth, userController.loadEmailVerification);
router.post('/profile/verify-email', userAuth, userController.verifyEmailOTP);
router.post('/profile/resend-email-otp', userAuth, userController.resendEmailOTP);

// Order Management Routes
router.get('/orders', userAuth, userController.loadOrders);
router.get('/orders/:id', userAuth, userController.loadOrderDetail);
router.get('/api/orders/:id', userAuth, userController.getOrderDetailsAPI);
router.put('/orders/:id/cancel', userAuth, userController.cancelOrder);
router.put('/orders/:id/items/:itemIndex/cancel', userAuth, userController.cancelOrderItem);
router.put('/orders/:id/return', userAuth, userController.returnOrder);
router.put('/orders/:id/items/:itemIndex/return', userAuth, userController.returnOrderItem);
router.get('/orders/:id/invoice', userAuth, userController.downloadInvoice);

// Cart Management Routes
router.get('/cart', userAuth, userController.loadCart);
router.get('/cart/count', userController.getCartCount);
router.post('/cart/add', userAuth, userController.addToCart);
router.put('/cart/update-quantity', userAuth, userController.updateCartQuantity);
router.delete('/cart/remove', userAuth, userController.removeFromCart);
router.delete('/cart/clear', userAuth, userController.clearCart);

// Wishlist Management Routes
router.get('/wishlist', userAuth, userController.loadWishlist);
router.get('/api/wishlist/count', userController.getWishlistCount);
router.post('/api/wishlist/add', userAuth, userController.addToWishlist);
router.delete('/api/wishlist/remove', userAuth, userController.removeFromWishlist);
router.post('/api/wishlist/move-to-cart', userAuth, userController.moveToCart);
router.post('/api/wishlist/move-all-to-cart', userAuth, userController.moveAllToCart);
router.delete('/api/wishlist/clear', userAuth, userController.clearWishlist);

// Wallet Management Routes
router.get('/wallet', userAuth, userController.loadWallet);
router.post('/wallet/add-money', userAuth, userController.addMoney);
router.get('/wallet/balance', userAuth, userController.getWalletBalance);
router.get('/wallet/transactions', userAuth, userController.getTransactionHistory);
router.post('/wallet/use-for-payment', userAuth, userController.useWalletForPayment);

// Checkout Routes
router.get('/checkout', userAuth, userController.loadCheckout);
router.post('/checkout/place-order', userAuth, userController.placeOrder);
router.post('/checkout/add-address', userAuth, userController.addCheckoutAddress);
router.put('/checkout/set-default-address', userAuth, userController.setDefaultCheckoutAddress);
router.get('/order-success/:orderId', userAuth, userController.loadOrderSuccess);


router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  
  // (req, res) => {
  //   req.session.user = req.user._id;
  //   res.redirect("/home");
  // }
   userController.googleCallbackHandler
);

module.exports = router;




