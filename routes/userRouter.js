const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");

router.get("/", userController.loadLandingpage);
router.get("/signup", userController.loadSignUppage);
router.get("/login", userController.loadLoginpage);
router.get("/home", userController.loadHome);
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
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    req.session.user = req.user._id;
    res.redirect("/home");
  }
);

module.exports = router;