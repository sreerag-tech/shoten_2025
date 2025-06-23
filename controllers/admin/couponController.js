const Coupon = require("../../models/couponSchema");
const User = require("../../models/userSchema");

// Load Coupons Management Page
const loadCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    // Search and filter parameters
    const search = req.query.search || "";
    const status = req.query.status || "";
    const sortBy = req.query.sortBy || "createdOn";
    const sortOrder = req.query.sortOrder || "desc";

    // Build query object
    let query = { isDeleted: false };

    // Search by coupon code or name
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } }
      ];
    }

    // Filter by status
    if (status === "active") {
      const now = new Date();
      query.isListed = true;
      query.startOn = { $lte: now };
      query.expireOn = { $gte: now };
    } else if (status === "inactive") {
      query.isListed = false;
    } else if (status === "expired") {
      query.expireOn = { $lt: new Date() };
    } else if (status === "upcoming") {
      query.startOn = { $gt: new Date() };
    }

    // Sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get coupons with pagination
    const coupons = await Coupon.find(query)
      .populate('createdBy', 'name email')
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit);

    // Get coupon statistics
    const now = new Date();
    const couponStats = await Coupon.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isListed", true] },
                    { $lte: ["$startOn", now] },
                    { $gte: ["$expireOn", now] }
                  ]
                },
                1,
                0
              ]
            }
          },
          expired: {
            $sum: {
              $cond: [{ $lt: ["$expireOn", now] }, 1, 0]
            }
          },
          upcoming: {
            $sum: {
              $cond: [{ $gt: ["$startOn", now] }, 1, 0]
            }
          },
          totalUsed: { $sum: "$usesCount" }
        }
      }
    ]);

    const stats = couponStats[0] || {
      total: 0,
      active: 0,
      expired: 0,
      upcoming: 0,
      totalUsed: 0
    };

    res.render("admin-coupons", {
      coupons: coupons,
      currentPage: page,
      totalPages: totalPages,
      totalCoupons: totalCoupons,
      search: search,
      status: status,
      sortBy: sortBy,
      sortOrder: sortOrder,
      stats: stats,
      activePage: 'coupons'
    });
  } catch (error) {
    console.error('Error loading coupons:', error);
    res.redirect("/admin/pageerror");
  }
};

// Load Add Coupon Page
const loadAddCoupon = async (req, res) => {
  try {
    res.render("admin-add-coupon", {
      activePage: 'coupons'
    });
  } catch (error) {
    console.error('Error loading add coupon page:', error);
    res.redirect("/admin/pageerror");
  }
};

// Create New Coupon
const createCoupon = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      minimumPrice,
      maximumDiscountAmount,
      maxUses,
      userUsageLimit,
      startOn,
      expireOn
    } = req.body;

    // Validation
    if (!code || !name || !discountType || !discountValue || !minimumPrice || !startOn || !expireOn) {
      return res.json({ 
        success: false, 
        message: 'All required fields must be filled' 
      });
    }

    // Validate coupon code format
    if (!/^[A-Z0-9]{3,20}$/.test(code.toUpperCase())) {
      return res.json({ 
        success: false, 
        message: 'Coupon code must be 3-20 characters long and contain only letters and numbers' 
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ 
      code: code.toUpperCase(), 
      isDeleted: false 
    });
    
    if (existingCoupon) {
      return res.json({ 
        success: false, 
        message: 'Coupon code already exists' 
      });
    }

    // Validate dates
    const startDate = new Date(startOn);
    const endDate = new Date(expireOn);
    const now = new Date();

    if (startDate >= endDate) {
      return res.json({ 
        success: false, 
        message: 'End date must be after start date' 
      });
    }

    if (endDate <= now) {
      return res.json({ 
        success: false, 
        message: 'End date must be in the future' 
      });
    }

    // Validate discount value
    if (discountType === "percentage" && (discountValue <= 0 || discountValue > 100)) {
      return res.json({ 
        success: false, 
        message: 'Percentage discount must be between 1 and 100' 
      });
    }

    if (discountType === "fixed" && discountValue <= 0) {
      return res.json({ 
        success: false, 
        message: 'Fixed discount amount must be greater than 0' 
      });
    }

    // Validate minimum price
    if (minimumPrice < 0) {
      return res.json({ 
        success: false, 
        message: 'Minimum order amount cannot be negative' 
      });
    }

    // Create new coupon
    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      name: name.trim(),
      description: description?.trim() || '',
      discountType: discountType,
      discountValue: parseFloat(discountValue),
      minimumPrice: parseFloat(minimumPrice),
      maximumDiscountAmount: maximumDiscountAmount ? parseFloat(maximumDiscountAmount) : null,
      maxUses: maxUses ? parseInt(maxUses) : null,
      userUsageLimit: userUsageLimit ? parseInt(userUsageLimit) : 1,
      startOn: startDate,
      expireOn: endDate,
      offerPrice: discountType === "fixed" ? parseFloat(discountValue) : 0, // For backward compatibility
      createdBy: req.session.adminId || null, // Use adminId instead of admin boolean
      isListed: true,
      isDeleted: false
    });

    await newCoupon.save();

    res.json({ 
      success: true, 
      message: 'Coupon created successfully',
      coupon: newCoupon
    });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.json({ 
      success: false, 
      message: 'Failed to create coupon. Please try again.' 
    });
  }
};



// Toggle Coupon Status
const toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon || coupon.isDeleted) {
      return res.json({
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isListed = !coupon.isListed;
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon ${coupon.isListed ? 'activated' : 'deactivated'} successfully`,
      isListed: coupon.isListed
    });
  } catch (error) {
    console.error('Error toggling coupon status:', error);
    res.json({
      success: false,
      message: 'Failed to update coupon status'
    });
  }
};

// Delete Coupon (Soft Delete)
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon || coupon.isDeleted) {
      return res.json({
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isDeleted = true;
    coupon.isListed = false;
    await coupon.save();

    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.json({
      success: false,
      message: 'Failed to delete coupon'
    });
  }
};

// Get Coupon Details API
const getCouponDetails = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId)
      .populate('createdBy', 'name email')
      .populate('userUses.userId', 'name email');

    if (!coupon || coupon.isDeleted) {
      return res.json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.json({
      success: true,
      coupon: coupon
    });
  } catch (error) {
    console.error('Error getting coupon details:', error);
    res.json({
      success: false,
      message: 'Failed to get coupon details'
    });
  }
};

module.exports = {
  loadCoupons,
  loadAddCoupon,
  createCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getCouponDetails
};
