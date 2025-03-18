const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/user/userController");

router.get("/", userController.loadLandingpage); // Landing page as default
router.get("/signup", userController.loadSignUppage);
router.get("/login", userController.loadLoginpage);
router.get("/home", userController.loadHome); // Protected home page
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.post("/login", userController.login);
router.post("/logout", userController.logout);
router.get("/pageNotFound", userController.pageNotFound);

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    req.session.user = req.user._id;
    res.redirect("/home"); // Redirect to home after Google login
  }
);

module.exports = router;