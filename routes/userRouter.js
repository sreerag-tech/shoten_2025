const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");

router.get("/", userController.loadHomepage);
router.get("/signup", userController.loadSignUppage);
router.get("/login", userController.loadLoginpage);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

module.exports = router;