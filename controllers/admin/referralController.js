const User = require("../../models/userSchema");
const Coupon = require("../../models/couponSchema");
const ReferralService = require("../../services/referralService");

// Load referral management page
const loadReferralManagement = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const search = req.query.search || '';

    // Get all referrals with pagination
    const referralData = await ReferralService.getAllReferrals(page, limit);

    // Get referral statistics
    const totalUsers = await User.countDocuments();
    const usersWithReferrals = await User.countDocuments({ referredBy: { $ne: null } });
    const totalReferralCoupons = await Coupon.countDocuments({ couponCode: { $regex: /^REF/ } });
    const usedReferralCoupons = await Coupon.countDocuments({ 
      couponCode: { $regex: /^REF/ }, 
      usedCount: { $gt: 0 } 
    });

    const stats = {
      totalUsers,
      usersWithReferrals,
      referralRate: totalUsers > 0 ? ((usersWithReferrals / totalUsers) * 100).toFixed(2) : 0,
      totalReferralCoupons,
      usedReferralCoupons,
      couponUsageRate: totalReferralCoupons > 0 ? ((usedReferralCoupons / totalReferralCoupons) * 100).toFixed(2) : 0
    };

    res.render("admin-referral-management", {
      referrals: referralData.referrals,
      currentPage: referralData.currentPage,
      totalPages: referralData.totalPages,
      totalReferrals: referralData.totalReferrals,
      hasNextPage: referralData.hasNextPage,
      hasPrevPage: referralData.hasPrevPage,
      stats: stats,
      search: search,
      activePage: 'referral-management'
    });

  } catch (error) {
    console.error('Error loading referral management:', error);
    res.redirect("/admin/pageerror");
  }
};

// Get referral analytics data
const getReferralAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    let groupBy = {};
    let dateRange = {};
    const now = new Date();

    switch (period) {
      case 'daily':
        // Last 30 days
        dateRange = {
          createdOn: {
            $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          }
        };
        groupBy = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdOn" }
        };
        break;

      case 'weekly':
        // Last 12 weeks
        dateRange = {
          createdOn: {
            $gte: new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000)
          }
        };
        groupBy = {
          $dateToString: { format: "%Y-W%U", date: "$createdOn" }
        };
        break;

      case 'monthly':
      default:
        // Last 12 months
        dateRange = {
          createdOn: {
            $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1)
          }
        };
        groupBy = {
          $dateToString: { format: "%Y-%m", date: "$createdOn" }
        };
        break;
    }

    // Get referral signups over time
    const referralSignups = await User.aggregate([
      {
        $match: {
          referredBy: { $ne: null },
          ...dateRange
        }
      },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Get top referrers
    const topReferrers = await User.aggregate([
      {
        $match: {
          referralCount: { $gt: 0 }
        }
      },
      {
        $sort: { referralCount: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          name: 1,
          email: 1,
          referralCode: 1,
          referralCount: 1
        }
      }
    ]);

    // Get referral conversion rates
    const conversionData = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          referredUsers: {
            $sum: {
              $cond: [{ $ne: ["$referredBy", null] }, 1, 0]
            }
          },
          usersWithReferralCode: {
            $sum: {
              $cond: [{ $ne: ["$referralCode", null] }, 1, 0]
            }
          }
        }
      }
    ]);

    const conversion = conversionData[0] || { totalUsers: 0, referredUsers: 0, usersWithReferralCode: 0 };

    res.json({
      success: true,
      data: {
        referralSignups,
        topReferrers,
        conversion: {
          totalUsers: conversion.totalUsers,
          referredUsers: conversion.referredUsers,
          usersWithReferralCode: conversion.usersWithReferralCode,
          referralRate: conversion.totalUsers > 0 ? 
            ((conversion.referredUsers / conversion.totalUsers) * 100).toFixed(2) : 0,
          participationRate: conversion.totalUsers > 0 ? 
            ((conversion.usersWithReferralCode / conversion.totalUsers) * 100).toFixed(2) : 0
        }
      }
    });

  } catch (error) {
    console.error('Error getting referral analytics:', error);
    res.status(500).json({ success: false, message: 'Error getting referral analytics' });
  }
};

// Export referral data
const exportReferralData = async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    // Get all referral data
    const referrals = await User.find({ referredBy: { $ne: null } })
      .populate('referredBy', 'name email referralCode')
      .select('name email createdOn referredBy')
      .sort({ createdOn: -1 });

    if (format === 'csv') {
      // Generate CSV
      let csv = 'Referee Name,Referee Email,Referrer Name,Referrer Email,Referrer Code,Signup Date\n';
      
      referrals.forEach(referral => {
        csv += `"${referral.name}","${referral.email}","${referral.referredBy?.name || 'N/A'}","${referral.referredBy?.email || 'N/A'}","${referral.referredBy?.referralCode || 'N/A'}","${new Date(referral.createdOn).toLocaleDateString()}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="referral-data-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);

    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="referral-data-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({
        exportDate: new Date().toISOString(),
        totalReferrals: referrals.length,
        referrals: referrals
      });
    }

  } catch (error) {
    console.error('Error exporting referral data:', error);
    res.status(500).json({ success: false, message: 'Error exporting referral data' });
  }
};

// Get user referral details
const getUserReferralDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const referralStats = await ReferralService.getReferralStats(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdOn: user.createdOn
        },
        referralStats
      }
    });

  } catch (error) {
    console.error('Error getting user referral details:', error);
    res.status(500).json({ success: false, message: 'Error getting user referral details' });
  }
};

module.exports = {
  loadReferralManagement,
  getReferralAnalytics,
  exportReferralData,
  getUserReferralDetails
};
