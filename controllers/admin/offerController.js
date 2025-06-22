const Offer = require("../../models/offerSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

// Load Offers Page
const loadOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const search = req.query.search || '';
    const offerType = req.query.offerType || '';
    const status = req.query.status || '';
    
    // Build search query
    let searchQuery = { isDeleted: false };
    
    if (search) {
      searchQuery.$or = [
        { offerName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (offerType) {
      searchQuery.offerType = offerType;
    }
    
    if (status === 'active') {
      searchQuery.isActive = true;
    } else if (status === 'inactive') {
      searchQuery.isActive = false;
    }
    
    // Get offers with pagination
    const offers = await Offer.find(searchQuery)
      .populate('applicableProducts', 'productName')
      .populate('applicableCategories', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalOffers = await Offer.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalOffers / limit);
    
    // Get statistics
    const stats = {
      total: await Offer.countDocuments({ isDeleted: false }),
      active: await Offer.countDocuments({ isDeleted: false, isActive: true }),
      inactive: await Offer.countDocuments({ isDeleted: false, isActive: false }),
      product: await Offer.countDocuments({ isDeleted: false, offerType: 'product' }),
      category: await Offer.countDocuments({ isDeleted: false, offerType: 'category' }),
      referral: await Offer.countDocuments({ isDeleted: false, offerType: 'referral' })
    };
    
    res.render("offers", {
      offers,
      currentPage: page,
      totalPages,
      totalOffers,
      search,
      offerType,
      status,
      stats,
      activePage: 'offers'
    });
    
  } catch (error) {
    console.error('Error loading offers:', error);
    res.redirect("/admin/pageerror");
  }
};

// Load Add Offer Page
const loadAddOffer = async (req, res) => {
  try {
    // Get products and categories for selection
    const products = await Product.find({ 
      isDeleted: false, 
      isBlocked: false 
    }).select('productName category').populate('category', 'name');
    
    const categories = await Category.find({ 
      isListed: true 
    }).select('name');
    
    res.render("add-offer", {
      products,
      categories,
      activePage: 'offers'
    });
    
  } catch (error) {
    console.error('Error loading add offer page:', error);
    res.redirect("/admin/pageerror");
  }
};

// Add New Offer
const addOffer = async (req, res) => {
  try {
    const {
      offerName,
      offerType,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumPurchaseAmount,
      applicableProducts,
      applicableCategories,
      startDate,
      endDate,
      usageLimit,
      userUsageLimit
    } = req.body;
    
    // Validation
    if (!offerName || !offerType || !description || !discountType || !discountValue || !startDate || !endDate) {
      return res.json({ success: false, message: 'All required fields must be filled' });
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
      return res.json({ success: false, message: 'End date must be after start date' });
    }
    
    if (discountValue <= 0) {
      return res.json({ success: false, message: 'Discount value must be greater than 0' });
    }
    
    if (discountType === 'percentage' && discountValue > 100) {
      return res.json({ success: false, message: 'Percentage discount cannot exceed 100%' });
    }
    
    // Check if offer name already exists
    const existingOffer = await Offer.findOne({ 
      offerName: { $regex: new RegExp(`^${offerName}$`, 'i') },
      isDeleted: false 
    });
    
    if (existingOffer) {
      return res.json({ success: false, message: 'Offer name already exists' });
    }
    
    // Prepare offer data
    const offerData = {
      offerName: offerName.trim(),
      offerType,
      description: description.trim(),
      discountType,
      discountValue: parseFloat(discountValue),
      maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
      minimumPurchaseAmount: minimumPurchaseAmount ? parseFloat(minimumPurchaseAmount) : 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      userUsageLimit: userUsageLimit ? parseInt(userUsageLimit) : 1,
      createdBy: req.session.adminId
    };
    
    // Add applicable items based on offer type
    if (offerType === 'product' && applicableProducts) {
      offerData.applicableProducts = Array.isArray(applicableProducts) ? applicableProducts : [applicableProducts];
    }
    
    if (offerType === 'category' && applicableCategories) {
      offerData.applicableCategories = Array.isArray(applicableCategories) ? applicableCategories : [applicableCategories];
    }
    
    // Create offer
    const newOffer = new Offer(offerData);
    await newOffer.save();
    
    res.json({ 
      success: true, 
      message: 'Offer created successfully!',
      offerId: newOffer._id
    });
    
  } catch (error) {
    console.error('Error adding offer:', error);
    res.json({ success: false, message: 'Failed to create offer. Please try again.' });
  }
};

// Load Edit Offer Page
const loadEditOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    
    const offer = await Offer.findById(offerId)
      .populate('applicableProducts', 'productName')
      .populate('applicableCategories', 'name');
    
    if (!offer || offer.isDeleted) {
      return res.redirect("/admin/offers");
    }
    
    // Get products and categories for selection
    const products = await Product.find({ 
      isDeleted: false, 
      isBlocked: false 
    }).select('productName category').populate('category', 'name');
    
    const categories = await Category.find({ 
      isListed: true 
    }).select('name');
    
    res.render("edit-offer", {
      offer,
      products,
      categories,
      activePage: 'offers'
    });
    
  } catch (error) {
    console.error('Error loading edit offer page:', error);
    res.redirect("/admin/pageerror");
  }
};

// Update Offer
const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const {
      offerName,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumPurchaseAmount,
      applicableProducts,
      applicableCategories,
      startDate,
      endDate,
      usageLimit,
      userUsageLimit
    } = req.body;

    // Find offer
    const offer = await Offer.findById(offerId);
    if (!offer || offer.isDeleted) {
      return res.json({ success: false, message: 'Offer not found' });
    }

    // Validation
    if (!offerName || !description || !discountType || !discountValue || !startDate || !endDate) {
      return res.json({ success: false, message: 'All required fields must be filled' });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.json({ success: false, message: 'End date must be after start date' });
    }

    if (discountValue <= 0) {
      return res.json({ success: false, message: 'Discount value must be greater than 0' });
    }

    if (discountType === 'percentage' && discountValue > 100) {
      return res.json({ success: false, message: 'Percentage discount cannot exceed 100%' });
    }

    // Check if offer name already exists (excluding current offer)
    const existingOffer = await Offer.findOne({
      offerName: { $regex: new RegExp(`^${offerName}$`, 'i') },
      isDeleted: false,
      _id: { $ne: offerId }
    });

    if (existingOffer) {
      return res.json({ success: false, message: 'Offer name already exists' });
    }

    // Update offer data
    offer.offerName = offerName.trim();
    offer.description = description.trim();
    offer.discountType = discountType;
    offer.discountValue = parseFloat(discountValue);
    offer.maxDiscountAmount = maxDiscountAmount ? parseFloat(maxDiscountAmount) : null;
    offer.minimumPurchaseAmount = minimumPurchaseAmount ? parseFloat(minimumPurchaseAmount) : 0;
    offer.startDate = new Date(startDate);
    offer.endDate = new Date(endDate);
    offer.usageLimit = usageLimit ? parseInt(usageLimit) : null;
    offer.userUsageLimit = userUsageLimit ? parseInt(userUsageLimit) : 1;
    offer.updatedAt = new Date();

    // Update applicable items based on offer type
    if (offer.offerType === 'product') {
      offer.applicableProducts = applicableProducts ?
        (Array.isArray(applicableProducts) ? applicableProducts : [applicableProducts]) : [];
    }

    if (offer.offerType === 'category') {
      offer.applicableCategories = applicableCategories ?
        (Array.isArray(applicableCategories) ? applicableCategories : [applicableCategories]) : [];
    }

    await offer.save();

    res.json({
      success: true,
      message: 'Offer updated successfully!'
    });

  } catch (error) {
    console.error('Error updating offer:', error);
    res.json({ success: false, message: 'Failed to update offer. Please try again.' });
  }
};

// Toggle Offer Status
const toggleOfferStatus = async (req, res) => {
  try {
    const offerId = req.params.id;

    const offer = await Offer.findById(offerId);
    if (!offer || offer.isDeleted) {
      return res.json({ success: false, message: 'Offer not found' });
    }

    offer.isActive = !offer.isActive;
    offer.updatedAt = new Date();
    await offer.save();

    res.json({
      success: true,
      message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully!`,
      isActive: offer.isActive
    });

  } catch (error) {
    console.error('Error toggling offer status:', error);
    res.json({ success: false, message: 'Failed to update offer status' });
  }
};

// Delete Offer (Soft Delete)
const deleteOffer = async (req, res) => {
  try {
    const offerId = req.params.id;

    const offer = await Offer.findById(offerId);
    if (!offer || offer.isDeleted) {
      return res.json({ success: false, message: 'Offer not found' });
    }

    offer.isDeleted = true;
    offer.isActive = false;
    offer.updatedAt = new Date();
    await offer.save();

    res.json({
      success: true,
      message: 'Offer deleted successfully!'
    });

  } catch (error) {
    console.error('Error deleting offer:', error);
    res.json({ success: false, message: 'Failed to delete offer' });
  }
};

// Get Offer Details
const getOfferDetails = async (req, res) => {
  try {
    const offerId = req.params.id;

    const offer = await Offer.findById(offerId)
      .populate('applicableProducts', 'productName productImage salePrice')
      .populate('applicableCategories', 'name')
      .populate('createdBy', 'name email');

    if (!offer || offer.isDeleted) {
      return res.json({ success: false, message: 'Offer not found' });
    }

    res.json({
      success: true,
      offer: offer
    });

  } catch (error) {
    console.error('Error getting offer details:', error);
    res.json({ success: false, message: 'Failed to get offer details' });
  }
};

module.exports = {
  loadOffers,
  loadAddOffer,
  addOffer,
  loadEditOffer,
  updateOffer,
  toggleOfferStatus,
  deleteOffer,
  getOfferDetails
};
