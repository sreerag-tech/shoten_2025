const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
  referrerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  refereeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  referralToken: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values
  },
  tokenExpiresAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired'],
    default: 'pending'
  },
  referralMethod: {
    type: String,
    enum: ['code', 'token'],
    required: true
  },
  rewardCouponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Coupon",
    default: null
  },
  rewardGiven: {
    type: Boolean,
    default: false
  },
  rewardAmount: {
    type: Number,
    default: 0
  },
  completedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
referralSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better performance
referralSchema.index({ referralCode: 1 });
referralSchema.index({ referralToken: 1 });
referralSchema.index({ referrerId: 1 });
referralSchema.index({ refereeId: 1 });
referralSchema.index({ status: 1 });

// Static method to generate unique referral code
referralSchema.statics.generateReferralCode = async function(userId) {
  const User = require('./userSchema');
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Generate code based on user's name and random string
  const namePrefix = user.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  let referralCode = `${namePrefix}${randomSuffix}`;
  
  // Ensure uniqueness
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    const existing = await this.findOne({ referralCode });
    if (!existing) {
      isUnique = true;
    } else {
      const newRandomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      referralCode = `${namePrefix}${newRandomSuffix}`;
      attempts++;
    }
  }
  
  if (!isUnique) {
    // Fallback to completely random code
    referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  }
  
  return referralCode;
};

// Static method to generate referral token
referralSchema.statics.generateReferralToken = function() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

// Method to check if referral is valid
referralSchema.methods.isValid = function() {
  if (this.status !== 'pending') {
    return false;
  }
  
  if (this.referralMethod === 'token' && this.tokenExpiresAt) {
    return new Date() < this.tokenExpiresAt;
  }
  
  return true;
};

// Method to complete referral
referralSchema.methods.complete = async function(refereeId) {
  this.refereeId = refereeId;
  this.status = 'completed';
  this.completedAt = new Date();
  await this.save();
};

// Method to expire referral
referralSchema.methods.expire = async function() {
  this.status = 'expired';
  await this.save();
};

module.exports = mongoose.model("Referral", referralSchema);
