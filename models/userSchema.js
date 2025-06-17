const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  googleId: { type: String, index: { unique: true, sparse: true } }, // Sparse index
  password: { type: String, required: false },
  phone: { type: String, default: null },
  dateOfBirth: { type: Date, default: null },
  bio: { type: String, default: null },
  profileImage: { type: String, default: null },
  isBlocked: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  cart: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cart" }],
  wallet: { type: Number, default: 0 },
  Wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Wishlist" }],
  orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  createdOn: { type: Date, default: Date.now },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  referredBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  searchHistory: [
    {
      category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
      brand: { type: String },
      searchOne: { type: Date, default: Date.now },
    },
  ],
  forgotPasswordOtp: { type: String, default: null },
  otpExpires: { type: Date, default: null },
  resetPasswordOtp: { type: String, default: null },
});

const User = mongoose.model("User", userSchema);
module.exports = User;