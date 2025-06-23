const Coupon = require("../models/couponSchema");

class CouponService {
  // Validate coupon code and return coupon details
  async validateCoupon(couponCode, userId, orderAmount) {
    try {
      // Find the coupon
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isListed: true,
        isDeleted: false
      });

      if (!coupon) {
        return {
          isValid: false,
          message: "Invalid coupon code"
        };
      }

      // Check if coupon is currently valid (date range)
      const now = new Date();
      if (coupon.startOn > now) {
        return {
          isValid: false,
          message: "Coupon is not yet active"
        };
      }

      if (coupon.expireOn < now) {
        return {
          isValid: false,
          message: "Coupon has expired"
        };
      }

      // Check total usage limit
      if (coupon.maxUses && coupon.usesCount >= coupon.maxUses) {
        return {
          isValid: false,
          message: "Coupon usage limit exceeded"
        };
      }

      // Check user usage limit
      const userUsage = coupon.userUses.find(usage => 
        usage.userId.toString() === userId.toString()
      );
      
      if (userUsage && userUsage.count >= coupon.userUsageLimit) {
        return {
          isValid: false,
          message: "You have already used this coupon the maximum number of times"
        };
      }

      // Check minimum order amount
      if (orderAmount < coupon.minimumPrice) {
        return {
          isValid: false,
          message: `Minimum order amount of ₹${coupon.minimumPrice} required`
        };
      }

      // Calculate discount
      const discount = coupon.calculateDiscount(orderAmount);

      return {
        isValid: true,
        coupon: coupon,
        discount: discount,
        message: "Coupon applied successfully"
      };
    } catch (error) {
      console.error('Error validating coupon:', error);
      return {
        isValid: false,
        message: "Error validating coupon"
      };
    }
  }

  // Apply coupon to order
  async applyCoupon(couponCode, userId, orderAmount) {
    try {
      const validation = await this.validateCoupon(couponCode, userId, orderAmount);
      
      if (!validation.isValid) {
        return validation;
      }

      return {
        isValid: true,
        coupon: validation.coupon,
        discount: validation.discount,
        finalAmount: orderAmount - validation.discount,
        message: validation.message
      };
    } catch (error) {
      console.error('Error applying coupon:', error);
      return {
        isValid: false,
        message: "Error applying coupon"
      };
    }
  }

  // Use coupon (increment usage count)
  async useCoupon(couponId, userId) {
    try {
      const coupon = await Coupon.findById(couponId);
      
      if (!coupon) {
        throw new Error('Coupon not found');
      }

      await coupon.useCoupon(userId);
      return true;
    } catch (error) {
      console.error('Error using coupon:', error);
      throw error;
    }
  }

  // Get available coupons for user
  async getAvailableCoupons(userId, orderAmount = 0) {
    try {
      const now = new Date();
      
      // Find all active coupons
      const coupons = await Coupon.find({
        isListed: true,
        isDeleted: false,
        startOn: { $lte: now },
        expireOn: { $gte: now },
        $or: [
          { maxUses: null },
          { $expr: { $lt: ["$usesCount", "$maxUses"] } }
        ]
      }).sort({ discountValue: -1 });

      // Filter coupons based on user eligibility
      const availableCoupons = [];
      
      for (const coupon of coupons) {
        // Check user usage limit
        const userUsage = coupon.userUses.find(usage => 
          usage.userId.toString() === userId.toString()
        );
        
        const userCanUse = !userUsage || userUsage.count < coupon.userUsageLimit;
        
        if (userCanUse) {
          const couponData = {
            _id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minimumPrice: coupon.minimumPrice,
            maximumDiscountAmount: coupon.maximumDiscountAmount,
            expireOn: coupon.expireOn,
            isApplicable: orderAmount >= coupon.minimumPrice,
            discount: orderAmount >= coupon.minimumPrice ? coupon.calculateDiscount(orderAmount) : 0
          };
          
          availableCoupons.push(couponData);
        }
      }

      return availableCoupons;
    } catch (error) {
      console.error('Error getting available coupons:', error);
      return [];
    }
  }

  // Get best coupon for order amount
  async getBestCoupon(userId, orderAmount) {
    try {
      const availableCoupons = await this.getAvailableCoupons(userId, orderAmount);
      
      if (availableCoupons.length === 0) {
        return null;
      }

      // Filter applicable coupons and sort by discount amount
      const applicableCoupons = availableCoupons
        .filter(coupon => coupon.isApplicable && coupon.discount > 0)
        .sort((a, b) => b.discount - a.discount);

      return applicableCoupons.length > 0 ? applicableCoupons[0] : null;
    } catch (error) {
      console.error('Error getting best coupon:', error);
      return null;
    }
  }

  // Check if coupon code exists and is valid format
  async checkCouponExists(couponCode) {
    try {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isDeleted: false
      });

      return !!coupon;
    } catch (error) {
      console.error('Error checking coupon existence:', error);
      return false;
    }
  }

  // Get coupon usage statistics
  async getCouponStats(couponId) {
    try {
      const coupon = await Coupon.findById(couponId)
        .populate('userUses.userId', 'name email');

      if (!coupon) {
        return null;
      }

      const now = new Date();
      const isActive = coupon.isListed && 
                      !coupon.isDeleted && 
                      coupon.startOn <= now && 
                      coupon.expireOn >= now &&
                      (coupon.maxUses === null || coupon.usesCount < coupon.maxUses);

      return {
        coupon: coupon,
        isActive: isActive,
        remainingUses: coupon.maxUses ? coupon.maxUses - coupon.usesCount : null,
        uniqueUsers: coupon.userUses.length,
        totalDiscount: coupon.userUses.reduce((total, usage) => {
          return total + (usage.count * coupon.discountValue);
        }, 0)
      };
    } catch (error) {
      console.error('Error getting coupon stats:', error);
      return null;
    }
  }
}

module.exports = new CouponService();
