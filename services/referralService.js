const User = require("../models/userSchema");
const Coupon = require("../models/couponSchema");

class ReferralService {
  
  // Generate unique referral code for user
  static async generateReferralCode(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // If user already has a referral code, return it
      if (user.referralCode) {
        return user.referralCode;
      }

      // Generate code based on user's name and random string
      const namePrefix = user.name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      let referralCode = `${namePrefix}${randomSuffix}`;

      // Ensure uniqueness
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        const existing = await User.findOne({ referralCode });
        if (!existing) {
          isUnique = true;
        } else {
          const newRandomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          referralCode = `${namePrefix}${newRandomSuffix}`;
          attempts++;
        }
      }

      if (!isUnique) {
        // Fallback to completely random code
        referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      }

      // Update user with referral code
      user.referralCode = referralCode;
      await user.save();

      return referralCode;
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw error;
    }
  }

  // Process referral when new user signs up
  static async processReferral(newUserId, referralCode) {
    try {
      if (!referralCode) {
        return { success: false, message: 'No referral code provided' };
      }

      // Find the referrer by referral code
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (!referrer) {
        return { success: false, message: 'Invalid referral code' };
      }

      // Get the new user
      const newUser = await User.findById(newUserId);
      if (!newUser) {
        return { success: false, message: 'New user not found' };
      }

      // Check if user is trying to refer themselves
      if (referrer._id.toString() === newUserId.toString()) {
        return { success: false, message: 'Cannot refer yourself' };
      }

      // Check if new user is already referred by someone
      if (newUser.referredBy) {
        return { success: false, message: 'User already referred by someone else' };
      }

      // Update new user's referredBy field
      newUser.referredBy = referrer._id;
      await newUser.save();

      // Update referrer's referral count
      referrer.referralCount = (referrer.referralCount || 0) + 1;
      await referrer.save();

      // Create reward coupon for referrer
      const rewardCoupon = await this.createReferralRewardCoupon(referrer);

      return {
        success: true,
        message: 'Referral processed successfully',
        referrer: {
          id: referrer._id,
          name: referrer.name,
          email: referrer.email
        },
        rewardCoupon: rewardCoupon
      };

    } catch (error) {
      console.error('Error processing referral:', error);
      return { success: false, message: 'Error processing referral' };
    }
  }

  // Create reward coupon for successful referral
  static async createReferralRewardCoupon(referrer) {
    try {
      const couponCode = `REF${referrer.referralCode}${Date.now().toString().slice(-4)}`;
      
      // Calculate reward amount (10% discount or ₹100, whichever is higher)
      const discountPercentage = 10;
      const minimumDiscount = 100;

      const rewardCoupon = new Coupon({
        name: `Referral Reward - ${referrer.name}`,
        couponCode: couponCode,
        createdOn: new Date(),
        expireOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        offerPrice: discountPercentage,
        minimumPrice: 500, // Minimum order value to use coupon
        isList: true,
        userId: [referrer._id], // Only this user can use this coupon
        description: `Congratulations! You've earned this coupon for successfully referring a friend. Enjoy ${discountPercentage}% off on your next purchase!`,
        discountType: 'percentage',
        usageLimit: 1,
        usedCount: 0
      });

      await rewardCoupon.save();

      return {
        couponCode: couponCode,
        discountPercentage: discountPercentage,
        minimumOrderValue: 500,
        expiryDate: rewardCoupon.expireOn,
        description: rewardCoupon.description
      };

    } catch (error) {
      console.error('Error creating referral reward coupon:', error);
      throw error;
    }
  }

  // Get referral statistics for user
  static async getReferralStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get referral code (generate if doesn't exist)
      let referralCode = user.referralCode;
      if (!referralCode) {
        referralCode = await this.generateReferralCode(userId);
      }

      // Get referred users
      const referredUsers = await User.find({ referredBy: userId })
        .select('name email createdOn')
        .sort({ createdOn: -1 });

      // Get referral coupons for this user
      const referralCoupons = await Coupon.find({
        userId: userId,
        couponCode: { $regex: /^REF/ }
      }).select('couponCode offerPrice expireOn isList usedCount');

      return {
        referralCode: referralCode,
        totalReferrals: user.referralCount || 0,
        referredUsers: referredUsers,
        rewardCoupons: referralCoupons,
        referralLink: `/signup?ref=${referralCode}`
      };

    } catch (error) {
      console.error('Error getting referral stats:', error);
      throw error;
    }
  }

  // Validate referral code
  static async validateReferralCode(referralCode) {
    try {
      if (!referralCode) {
        return { valid: false, message: 'Referral code is required' };
      }

      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (!referrer) {
        return { valid: false, message: 'Invalid referral code' };
      }

      if (referrer.isBlocked) {
        return { valid: false, message: 'Referral code is no longer valid' };
      }

      return {
        valid: true,
        referrer: {
          id: referrer._id,
          name: referrer.name,
          referralCode: referrer.referralCode
        }
      };

    } catch (error) {
      console.error('Error validating referral code:', error);
      return { valid: false, message: 'Error validating referral code' };
    }
  }

  // Get all referrals for admin
  static async getAllReferrals(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const referrals = await User.find({ referredBy: { $ne: null } })
        .populate('referredBy', 'name email referralCode')
        .select('name email createdOn referredBy')
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(limit);

      const totalReferrals = await User.countDocuments({ referredBy: { $ne: null } });
      const totalPages = Math.ceil(totalReferrals / limit);

      return {
        referrals,
        currentPage: page,
        totalPages,
        totalReferrals,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };

    } catch (error) {
      console.error('Error getting all referrals:', error);
      throw error;
    }
  }
}

module.exports = ReferralService;
