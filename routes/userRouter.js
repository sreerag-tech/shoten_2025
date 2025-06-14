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
router.delete('/profile/address/:id', userAuth, userController.deleteAddress);
router.put('/profile/address/:id/default', userAuth, userController.setDefaultAddress);

// Password Change Route
router.post('/profile/change-password', userAuth, userController.changePassword);

// Email Verification Routes
router.get('/profile/verify-email', userAuth, userController.loadEmailVerification);
router.post('/profile/verify-email', userAuth, userController.verifyEmailOTP);
router.post('/profile/resend-email-otp', userAuth, userController.resendEmailOTP);

// Order Management Routes
router.get('/orders', userAuth, userController.loadOrders);
router.get('/orders/:id', userAuth, userController.loadOrderDetail);
router.put('/orders/:id/cancel', userAuth, userController.cancelOrder);
router.put('/orders/:id/items/:itemIndex/cancel', userAuth, userController.cancelOrderItem);
router.put('/orders/:id/return', userAuth, userController.returnOrder);
router.put('/orders/:id/items/:itemIndex/return', userAuth, userController.returnOrderItem);
router.get('/orders/:id/invoice', userAuth, userController.downloadInvoice);


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




