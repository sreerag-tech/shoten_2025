const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    minlength: 3,
    maxlength: 20
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  discountType: {
    type: String,
    required: true,
    enum: ["percentage", "fixed"],
    default: "fixed"
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  startOn: {
    type: Date,
    required: true,
  },
  expireOn: {
    type: Date,
    required: true,
  },
  offerPrice: {
    type: Number,
    required: true,
  },
  minimumPrice: {
    type: Number,
    required: true,
  },
  maximumDiscountAmount: {
    type: Number,
    min: 0,
    default: null
  },
  maxUses: {
    type: Number,
    default: null,  // null means unlimited
  },
  usesCount: {
    type: Number,
    default: 0,
  },
  userUsageLimit: {
    type: Number,
    min: 1,
    default: 1
  },
  userUses: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    count: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  isListed: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: false,
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});


// Update the updatedAt field before saving
couponSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better performance (code index is automatic due to unique: true)
couponSchema.index({ startOn: 1, expireOn: 1 });
couponSchema.index({ isListed: 1, isDeleted: 1 });

// Method to check if coupon is valid
couponSchema.methods.isValidCoupon = function() {
  const now = new Date();
  return this.isListed &&
         !this.isDeleted &&
         this.startOn <= now &&
         this.expireOn >= now &&
         (this.maxUses === null || this.usesCount < this.maxUses);
};

// Method to check if user can use this coupon
couponSchema.methods.canUserUseCoupon = function(userId) {
  if (!this.isValidCoupon()) return false;

  const userUsage = this.userUses.find(usage => usage.userId.toString() === userId.toString());
  if (!userUsage) return true;

  return userUsage.count < this.userUsageLimit;
};

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function(orderAmount) {
  if (orderAmount < this.minimumPrice) return 0;

  let discount = 0;

  // Use new discount system if available
  if (this.discountType && this.discountValue) {
    if (this.discountType === "percentage") {
      discount = (orderAmount * this.discountValue) / 100;
    } else if (this.discountType === "fixed") {
      discount = this.discountValue;
    }
  } else if (this.offerPrice) {
    // Backward compatibility with old offerPrice system
    discount = this.offerPrice;
  }

  // Apply maximum discount limit if set
  if (this.maximumDiscountAmount && discount > this.maximumDiscountAmount) {
    discount = this.maximumDiscountAmount;
  }

  // Ensure discount doesn't exceed order amount
  if (discount > orderAmount) {
    discount = orderAmount;
  }

  return Math.round(discount * 100) / 100; // Round to 2 decimal places
};

// Method to use coupon
couponSchema.methods.useCoupon = function(userId) {
  this.usesCount += 1;

  const userUsage = this.userUses.find(usage => usage.userId.toString() === userId.toString());
  if (userUsage) {
    userUsage.count += 1;
    userUsage.lastUsed = new Date();
  } else {
    this.userUses.push({
      userId: userId,
      count: 1,
      lastUsed: new Date()
    });
  }

  return this.save();
};

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;