const Coupon = require("../../models/couponSchema");
const User = require("../../models/userSchema");

// Load user coupons page
const loadUserCoupons = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/login");
    }

    // Get all available coupons (general coupons)
    const now = new Date();
    const generalCoupons = await Coupon.find({
      isListed: true,
      isDeleted: false,
      startOn: { $lte: now },
      expireOn: { $gte: now },
      code: { $not: { $regex: /^REF/ } } // Exclude referral coupons
    }).sort({ createdOn: -1 });

    // Get user's referral reward coupons
    const referralCoupons = await Coupon.find({
      code: { $regex: /^REF/ },
      isDeleted: false,
      $or: [
        { expireOn: { $gte: now } }, // Active coupons
        { usesCount: { $gt: 0 } } // Used coupons (for history)
      ]
    }).sort({ createdOn: -1 });

    // Filter referral coupons that belong to this user (check if user can use them)
    const userReferralCoupons = [];
    for (const coupon of referralCoupons) {
      // Check if this coupon was created for this user's referrals
      if (coupon.code.includes(user.referralCode)) {
        userReferralCoupons.push(coupon);
      }
    }

    res.render("user-coupons", {
      user: user,
      generalCoupons: generalCoupons,
      referralCoupons: userReferralCoupons,
      activePage: 'coupons'
    });

  } catch (error) {
    console.error('Error loading user coupons:', error);
    res.redirect("/pageNotFound");
  }
};

// Get coupon details API
const getCouponDetails = async (req, res) => {
  try {
    const { couponCode } = req.params;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login first' });
    }

    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isDeleted: false 
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    // Check if coupon is valid
    const isValid = coupon.isValidCoupon();
    const canUserUse = coupon.canUserUseCoupon(userId);

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minimumPrice: coupon.minimumPrice,
        maximumDiscountAmount: coupon.maximumDiscountAmount,
        expireOn: coupon.expireOn,
        isValid: isValid,
        canUserUse: canUserUse,
        usesCount: coupon.usesCount,
        maxUses: coupon.maxUses
      }
    });

  } catch (error) {
    console.error('Error getting coupon details:', error);
    res.status(500).json({ success: false, message: 'Error getting coupon details' });
  }
};

// Validate coupon for checkout
const validateCouponForCheckout = async (req, res) => {
  try {
    const { couponCode, orderAmount } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login first' });
    }

    if (!couponCode || !orderAmount) {
      return res.status(400).json({ success: false, message: 'Coupon code and order amount are required' });
    }

    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(),
      isDeleted: false 
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid coupon code' });
    }

    // Check if coupon is valid
    if (!coupon.isValidCoupon()) {
      return res.status(400).json({ success: false, message: 'Coupon is expired or not active' });
    }

    // Check if user can use this coupon
    if (!coupon.canUserUseCoupon(userId)) {
      return res.status(400).json({ success: false, message: 'You have already used this coupon' });
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(orderAmount);

    if (discountAmount === 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum order amount of ₹${coupon.minimumPrice} required for this coupon` 
      });
    }

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        name: coupon.name,
        discountAmount: discountAmount,
        minimumPrice: coupon.minimumPrice,
        maximumDiscountAmount: coupon.maximumDiscountAmount
      }
    });

  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ success: false, message: 'Error validating coupon' });
  }
};

module.exports = {
  loadUserCoupons,
  getCouponDetails,
  validateCouponForCheckout
};
