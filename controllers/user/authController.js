const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");

//  Authentication related functions from userController.js

const loadSignUppage = async (req, res) => {
  try {
    // Get referral code from URL query parameter
    const referralCode = req.query.ref || '';

    return res.render("signup", {
      referralCode: referralCode,
      formData: {}
    });
  } catch (error) {
    console.log("signup not found");
    res.status(500).send("server error");
  }
};

const loadLoginpage = async (req, res) => {
  try {
    if (!req.session.user) {
      // Get auth message from session and clear it
      const authMessage = req.session.authMessage || null;
      req.session.authMessage = null;

      return res.render("login", { authMessage });
    } else {
      res.redirect("/home");
    }
  } catch (error) {
    res.redirect("/pageNotFound");
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

const securePassword = async (password) => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    console.error("Error hashing password:", error);
  }
};

const signup = async (req, res) => {
  try {
    const { name, email, password, cPassword, referralCode } = req.body;

    if (!email || !password || !cPassword) {
      return res.render("signup", { message: "All fields are required" });
    }

    if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("login", { message: "User already exists" });
    }

    // Validate referral code if provided
    let referralValidation = null;
    if (referralCode && referralCode.trim()) {
      const ReferralService = require("../../services/referralService");
      referralValidation = await ReferralService.validateReferralCode(referralCode.trim());

      if (!referralValidation.valid) {
        return res.render("signup", {
          message: referralValidation.message,
          formData: { name, email, referralCode }
        });
      }
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.render("signup", {
        message: "Failed to send OTP. Check email settings.",
        formData: { name, email, referralCode }
      });
    }
    console.log('Otp in signup controller',otp);

    req.session.userOtp = otp;
    req.session.otpTimestamp = Date.now();
    req.session.userData = { name, email, password, referralCode: referralCode?.trim() || null };
    res.render("verify-otp");
  } catch (error) {
    console.error("Signup error:", error);
    return res.redirect("/pageNotFound");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const otpTimestamp = req.session.otpTimestamp;
    const currentTime = Date.now();
    const timeDifference = (currentTime - otpTimestamp) / 1000;

    if (!otpTimestamp || timeDifference > 120) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }
console.log(otp)
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

      // Process referral if provided
      if (user.referralCode) {
        try {
          const ReferralService = require("../../services/referralService");
          const referralResult = await ReferralService.processReferral(saveUserData._id, user.referralCode);

          if (referralResult.success) {
            console.log('Referral processed successfully:', referralResult);
          } else {
            console.log('Referral processing failed:', referralResult.message);
          }
        } catch (referralError) {
          console.error('Error processing referral:', referralError);
          // Don't fail the signup if referral processing fails
        }
      }

      // Generate referral code for the new user
      try {
        const ReferralService = require("../../services/referralService");
        await ReferralService.generateReferralCode(saveUserData._id);
      } catch (referralCodeError) {
        console.error('Error generating referral code:', referralCodeError);
        // Don't fail the signup if referral code generation fails
      }

      req.session.user = saveUserData._id;
      res.json({ success: true, redirectUrl: "/home" });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ success: false, message: "An error occurred during verification" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const email = req.session.userData?.email;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpTimestamp = Date.now();

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log(' resend Otp in signup controller',otp);
      return res.status(200).json({ success: true, message: "OTP resent successfully" });
    } else {
      return res.status(500).json({ success: false, message: "Failed to resend OTP" });
      
    }
    
  }
   catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
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
    res.redirect("/home");
  } catch (error) {
    console.error("Login error", error);
    res.render("login", { message: "Login failed, please try again later" });
  }
};

const googleCallbackHandler = async (req, res) => {
  try {
    // Fetch the user from the database first
    const user = await User.findOne({ _id: req.user._id });
    if (!user) {
      return res.render("login", { message: "User not found" });
    }

    // Check if the user is blocked before setting the session
    if (user.isBlocked) {
      console.log("User is blocked:", user._id);
      // Destroy the session to ensure the user isn't logged in
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.redirect("/pageNotFound");
        }
        return res.render("login", { message: "User is blocked by admin" });
      });
      return; 
    }

    // If user is not blocked, set the session and proceed
    req.session.user = req.user._id;
    console.log("User logged in via Google:", req.user._id);
    res.redirect("/home");
  } catch (error) {
    console.error("Error in Google callback handler:", error);
    // Destroy session in case of error to prevent partial login states
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }
      res.redirect("/login");
    });
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

module.exports = {
  loadSignUppage,
  loadLoginpage,
  signup,
  verifyOtp,
  resendOtp,
  login,
  googleCallbackHandler,
  logout,
  generateOtp,
  sendVerificationEmail,
  securePassword
};
