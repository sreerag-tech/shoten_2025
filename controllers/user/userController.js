const User = require("../../models/userSchema");
const nodemailer = require(`nodemailer`);
const env = require("dotenv").config();
const bcrypt = require("bcrypt");

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
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP:${otp}</b>`
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

const loadLoginpage = async (req, res) => {
  try {
    return res.render("login");
  } catch (error) {
    console.log("login not found");
    res.status(500).send("server error");
  }
};

const loadHomepage = async (req, res) => {
  try {
    return res.render("home");
  } catch (error) {
    console.log("Homepage not found", error);
    res.status(500).send("server error");
  }
};

const signup = async (req, res) => {
  try {
    const { name, email, password, cPassword } = req.body;

    if (!email || !password || !cPassword) {
      return res.render('signup', { message: 'All fields are required' });
    }

    if (password !== cPassword) {
      return res.render('signup', { message: 'Passwords do not match' });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render('signup', { message: 'User already exists' });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      console.log('Failed to send OTP to:', email);
      return res.render('signup', { message: 'Failed to send OTP. Check email settings.' });
    }

    req.session.userOtp = otp;
    req.session.otpTimestamp = Date.now();
    req.session.userData = { name, email, password };
    res.render('verify-otp');
    console.log('OTP sent:', otp);
  } catch (error) {
    console.error('Signup error:', error);
    return res.redirect('/pageNotFound');
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

    console.log("OTP:", otp, "Session OTP:", req.session.userOtp, "Time elapsed (s):", timeDifference);

    if (!otpTimestamp || timeDifference > 120) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
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
      res.json({ success: true, redirectUrl: "/login" });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  } catch (error) {
    console.error(`Error verifying OTP:`, error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists",
      });
    }
    res.status(500).json({ success: false, message: "An error occurred during verification" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const email = req.session.userData?.email;
    if (!email) {
      console.log("Email not found in session:", req.session);
      return res.status(400).json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpTimestamp = Date.now();

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP sent successfully:", otp, "to", email);
      return res.status(200).json({ success: true, message: "OTP resent successfully" });
    } else {
      console.log("Failed to resend OTP to:", email);
      return res.status(500).json({ success: false, message: "Failed to resend OTP" });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  loadHomepage,
  loadSignUppage,
  loadLoginpage,
  signup,
  verifyOtp,
  resendOtp,
};