const mongoose = require("mongoose");
const { Schema } = mongoose;

const offerSchema = new Schema({
  offerName: {
    type: String,
    required: true,
    trim: true
  },
  offerType: {
    type: String,
    enum: ['product', 'category', 'referral'],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscountAmount: {
    type: Number,
    default: null // For percentage discounts, max discount cap
  },
  minimumPurchaseAmount: {
    type: Number,
    default: 0
  },
  // For product offers
  applicableProducts: [{
    type: Schema.Types.ObjectId,
    ref: 'Product'
  }],
  // For category offers
  applicableCategories: [{
    type: Schema.Types.ObjectId,
    ref: 'Category'
  }],
  // For referral offers
  referralSettings: {
    referrerReward: {
      type: Number,
      default: 0
    },
    refereeReward: {
      type: Number,
      default: 0
    },
    maxReferrals: {
      type: Number,
      default: null
    }
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  usageLimit: {
    type: Number,
    default: null // null means unlimited
  },
  usedCount: {
    type: Number,
    default: 0
  },
  userUsageLimit: {
    type: Number,
    default: 1 // How many times a single user can use this offer
  },
  usedBy: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    usedCount: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
offerSchema.index({ offerType: 1, isActive: 1, isDeleted: 1 });
offerSchema.index({ startDate: 1, endDate: 1 });
offerSchema.index({ applicableProducts: 1 });
offerSchema.index({ applicableCategories: 1 });

// Virtual for checking if offer is currently valid
offerSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  return this.isActive &&
         !this.isDeleted &&
         this.startDate <= now &&
         this.endDate >= now &&
         (this.usageLimit === null || this.usedCount < this.usageLimit);
});

// Method to check if user can use this offer
offerSchema.methods.canUserUse = function(userId) {
  if (!this.isCurrentlyValid) return false;

  const userUsage = this.usedBy.find(usage => usage.userId.toString() === userId.toString());
  if (!userUsage) return true;

  return userUsage.usedCount < this.userUsageLimit;
};

// Method to calculate discount for a given amount
offerSchema.methods.calculateDiscount = function(amount) {
  if (amount < this.minimumPurchaseAmount) return 0;

  let discount = 0;
  if (this.discountType === 'percentage') {
    discount = (amount * this.discountValue) / 100;
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  } else {
    discount = this.discountValue;
  }

  return Math.min(discount, amount); // Discount cannot exceed the amount
};

const Offer = mongoose.model("Offer", offerSchema);
module.exports = Offer;