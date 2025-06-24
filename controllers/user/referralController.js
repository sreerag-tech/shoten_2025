const User = require("../../models/userSchema");
const ReferralService = require("../../services/referralService");

// Load referral dashboard
const loadReferralDashboard = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.redirect("/login");
    }

    // Get referral statistics
    const referralStats = await ReferralService.getReferralStats(userId);
    
    res.render("referral-dashboard", {
      user: await User.findById(userId),
      referralStats: referralStats,
      activePage: 'referral'
    });

  } catch (error) {
    console.error('Error loading referral dashboard:', error);
    res.redirect("/pageNotFound");
  }
};

// Generate new referral link (if user doesn't have one)
const generateReferralCode = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login first' });
    }

    const referralCode = await ReferralService.generateReferralCode(userId);
    
    res.json({
      success: true,
      referralCode: referralCode,
      referralLink: `/signup?ref=${referralCode}`
    });

  } catch (error) {
    console.error('Error generating referral code:', error);
    res.status(500).json({ success: false, message: 'Error generating referral code' });
  }
};

// Get referral statistics API
const getReferralStats = async (req, res) => {
  try {
    const userId = req.session.user;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login first' });
    }

    const referralStats = await ReferralService.getReferralStats(userId);
    
    res.json({
      success: true,
      data: referralStats
    });

  } catch (error) {
    console.error('Error getting referral stats:', error);
    res.status(500).json({ success: false, message: 'Error getting referral statistics' });
  }
};

module.exports = {
  loadReferralDashboard,
  generateReferralCode,
  getReferralStats
};
