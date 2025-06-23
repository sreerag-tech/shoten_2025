const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const offerService = require("../../services/offerService");
const crypto = require("crypto");

const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);

    console.log("User data for profile:", {
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      dateOfBirth: userData.dateOfBirth,
      bio: userData.bio,
      profileImage: userData.profileImage,
    });

    // Get user addresses
    const addresses = await Address.find({ userId: userId }).sort({
      isDefault: -1,
      createdAt: -1,
    });

    // Get user orders with populated product data
    const orders = await Order.find({ userId: userId })
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage regularPrice salePrice category',
        populate: {
          path: 'category',
          model: 'Category',
          select: 'name'
        }
      })
      .sort({ createdOn: -1 })
      .limit(10);

    // Calculate offer-adjusted totals for orders
    const ordersWithOffers = await Promise.all(orders.map(async (order) => {
      let newSubtotal = 0;

      // Calculate offers for each order item
      for (const item of order.orderedItems) {
        if (item.product) {
          const offerResult = await offerService.calculateBestOfferForProduct(item.product._id, userId);

          let finalPrice = item.price;
          if (offerResult) {
            finalPrice = offerResult.finalPrice;
          }

          newSubtotal += finalPrice * item.quantity;
        } else {
          newSubtotal += item.price * item.quantity;
        }
      }

      // Calculate new total (keeping original shipping and discount logic)
      const shippingCharge = order.shippingCharge || 0;
      const originalDiscount = order.discount || 0;
      const newTotal = newSubtotal + shippingCharge - originalDiscount;

      return {
        ...order.toObject(),
        subtotalWithOffers: newSubtotal,
        totalPriceWithOffers: newTotal,
        offerSavings: order.totalPrice - shippingCharge + originalDiscount - newSubtotal
      };
    }));

    // Get user wishlist items
    const mongoose = require("mongoose");
    const Wishlist =
      mongoose.models.Wishlist || require("../../models/wishListSchema");

    const wishlistItems = await Wishlist.find({ userId: userId })
      .populate({
        path: "products.productId",
        populate: {
          path: "category",
          model: "Category",
        },
      })
      .sort({ "products.addedOn": -1 });

    // Extract wishlist products (limit to 6 for profile preview)
    let wishlistProducts = [];
    if (wishlistItems.length > 0) {
      const filteredProducts = wishlistItems[0].products
        .filter(
          (item) =>
            item.productId &&
            !item.productId.isDeleted &&
            !item.productId.isBlocked
        )
        .slice(0, 6); // Limit to 6 items for profile preview

      // Calculate offers for wishlist products
      wishlistProducts = await Promise.all(filteredProducts.map(async (item) => {
        const offerResult = await offerService.calculateBestOfferForProduct(item.productId._id, userId);

        let finalPrice = item.productId.salePrice;
        let discount = 0;
        let hasOffer = false;
        let offerInfo = null;

        if (offerResult) {
          finalPrice = offerResult.finalPrice;
          discount = offerResult.discountPercentage;
          hasOffer = true;
          offerInfo = {
            type: offerResult.offer.offerType,
            name: offerResult.offer.offerName,
            discountAmount: offerResult.discount
          };
        }

        return {
          _id: item.productId._id,
          name: item.productId.productName,
          price: finalPrice,
          originalPrice: item.productId.salePrice,
          regularPrice: item.productId.regularPrice,
          image:
            item.productId.productImage &&
            item.productId.productImage.length > 0
              ? `/uploads/product-images/${item.productId.productImage[0]}`
              : "/images/placeholder.jpg",
          category: item.productId.category
            ? item.productId.category.name
            : "Unknown",
          isAvailable: item.productId.quantity > 0,
          discount: discount,
          hasOffer: hasOffer,
          offerInfo: offerInfo,
          addedOn: item.addedOn,
        };
      }));
    }

    // Get success/error messages from session
    const profileMessage = req.session.profileMessage || null;
    req.session.profileMessage = null;

    res.render("profile", {
      user: userData,
      addresses: addresses,
      orders: ordersWithOffers,
      wishlistItems: wishlistProducts,
      wishlistCount: wishlistProducts.length,
      profileMessage: profileMessage,
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadEditProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);

    console.log("User data for edit profile:", {
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      dateOfBirth: userData.dateOfBirth,
      bio: userData.bio,
      profileImage: userData.profileImage,
    });

    res.render("edit-profile", { user: userData });
  } catch (error) {
    console.error("Error loading edit profile:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Server-side validation functions
function validateProfileData(data) {
  const errors = [];

  // Name validation
  if (
    !data.name ||
    data.name.trim().length < 2 ||
    data.name.trim().length > 50
  ) {
    errors.push("Name must be between 2 and 50 characters");
  }

  if (!/^[A-Za-z\s]+$/.test(data.name)) {
    errors.push("Name should contain only letters and spaces");
  }

  // Email validation
  if (!data.email) {
    errors.push("Email is required");
  } else if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(data.email)) {
    errors.push("Please enter a valid email address");
  }

  // Phone validation (optional)
  if (data.phone && !/^[0-9]{10}$/.test(data.phone)) {
    errors.push("Phone number must be exactly 10 digits");
  }

  // Date of birth validation (optional)
  if (data.dateOfBirth) {
    const birthDate = new Date(data.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();

    if (age < 13) {
      errors.push("You must be at least 13 years old");
    }

    if (birthDate > today) {
      errors.push("Date of birth cannot be in the future");
    }
  }

  // Bio validation (optional)
  if (data.bio && data.bio.length > 500) {
    errors.push("Bio cannot exceed 500 characters");
  }

  return errors;
}

// Helper function to generate OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to send verification email
async function sendVerificationEmail(email, otp) {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Shoten - Email Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1f2937; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #00ffff; margin: 0;">SHOTEN</h1>
            <p style="color: #9ca3af; margin: 5px 0;">Email Verification</p>
          </div>

          <div style="background-color: #374151; padding: 30px; border-radius: 10px; text-align: center;">
            <h2 style="color: #00ffff; margin-bottom: 20px;">Verify Your Email Address</h2>
            <p style="color: #d1d5db; margin-bottom: 30px;">
              You requested to change your email address. Please use the verification code below to confirm this change:
            </p>

            <div style="background-color: #1f2937; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #00ffff; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                ${otp}
              </h1>
            </div>

            <p style="color: #9ca3af; font-size: 14px; margin-top: 20px;">
              This code will expire in 5 minutes for security reasons.
            </p>

            <p style="color: #9ca3af; font-size: 14px; margin-top: 20px;">
              If you didn't request this change, please ignore this email.
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #374151;">
            <p style="color: #6b7280; font-size: 12px;">
              © 2024 Shoten. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
}

const updateProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, email, phone, dateOfBirth, bio } = req.body;
    const profileImage = req.file?.filename;

    console.log("Update Profile Data:", {
      name,
      email,
      phone,
      dateOfBirth,
      bio,
      profileImage,
    });

    // Server-side validation
    const validationErrors = validateProfileData({
      name,
      email,
      phone,
      dateOfBirth,
      bio,
    });

    if (validationErrors.length > 0) {
      req.session.profileMessage = {
        type: "error",
        text: "Validation errors: " + validationErrors.join(", "),
      };
      return res.redirect("/profile/edit");
    }

    // Check if email is being changed and handle verification
    const currentUser = await User.findById(userId);
    if (email && email !== currentUser.email) {
      // Check if new email already exists
      const existingUser = await User.findOne({
        email: email,
        _id: { $ne: userId },
      });
      if (existingUser) {
        req.session.profileMessage = {
          type: "error",
          text: "Email already exists!",
        };
        return res.redirect("/profile/edit");
      }

      // Generate OTP for email verification
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);

      if (!emailSent) {
        req.session.profileMessage = {
          type: "error",
          text: "Failed to send verification email!",
        };
        return res.redirect("/profile/edit");
      }

      // Store pending update data in session
      req.session.pendingProfileUpdate = {
        name: name.trim(),
        email: email.trim(),
        phone: phone ? phone.trim() : null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        bio: bio ? bio.trim() : null,
        profileImage: profileImage || null,
      };
      req.session.emailVerificationOtp = otp;
      req.session.otpTimestamp = Date.now();
      req.session.newEmail = email.trim();

      // Redirect to email verification page
      req.session.verifyMessage = {
        type: "info",
        text: `Verification code sent to ${email}. Please check your email.`,
      };
      return res.redirect("/profile/verify-email");
    }

    // Build update data object
    const updateData = {
      name: name.trim(),
      email: email.trim(),
    };

    if (phone && phone.trim()) updateData.phone = phone.trim();
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
    if (bio) updateData.bio = bio.trim();
    if (profileImage) updateData.profileImage = profileImage;

    console.log("Update Data Object:", updateData);

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });
    console.log("Updated User:", updatedUser);

    // Set success message in session and redirect
    req.session.profileMessage = {
      type: "success",
      text: "Profile updated successfully!",
    };
    res.redirect("/profile");
  } catch (error) {
    console.error("Error updating profile:", error);
    req.session.profileMessage = {
      type: "error",
      text: "Failed to update profile. Please try again.",
    };
    res.redirect("/profile/edit");
  }
};

// Address Management Functions
const addAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressData = req.body;

    // If this is set as default, unset other default addresses
    if (addressData.isDefault) {
      await Address.updateMany(
        { userId: userId },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = new Address({
      userId: userId,
      ...addressData,
    });

    await newAddress.save();

    res.json({ success: true, message: "Address added successfully" });
  } catch (error) {
    console.error("Error adding address:", error);
    res.json({ success: false, message: "Failed to add address" });
  }
};

const getAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;

    const address = await Address.findOne({ _id: addressId, userId: userId });

    if (!address) {
      return res.json({ success: false, message: "Address not found" });
    }

    res.json({ success: true, address: address });
  } catch (error) {
    console.error("Error fetching address:", error);
    res.json({ success: false, message: "Failed to fetch address" });
  }
};

const editAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user;
    const {
      name,
      phone,
      pincode,
      address,
      locality,
      city,
      state,
      landMark,
      addressType,
      isDefault,
    } = req.body;

    // Find and update the address
    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, userId: userId },
      {
        name: name.trim(),
        phone: phone.trim(),
        pincode: pincode.trim(),
        address: address.trim(),
        locality: locality.trim(),
        city: city.trim(),
        state: state.trim(),
        landMark: landMark ? landMark.trim() : "",
        addressType: addressType,
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res.json({ success: false, message: "Address not found" });
    }

    // If setting as default, update other addresses
    if (isDefault) {
      await Address.updateMany(
        { userId: userId, _id: { $ne: addressId } },
        { isDefault: false }
      );
      updatedAddress.isDefault = true;
      await updatedAddress.save();
    }

    res.json({ success: true, message: "Address updated successfully" });
  } catch (error) {
    console.error("Error updating address:", error);
    res.json({ success: false, message: "Failed to update address" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;

    const address = await Address.findOne({ _id: addressId, userId: userId });
    if (!address) {
      return res.json({ success: false, message: "Address not found" });
    }

    await Address.findByIdAndDelete(addressId);

    res.json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.json({ success: false, message: "Failed to delete address" });
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;

    // Unset all default addresses for this user
    await Address.updateMany(
      { userId: userId },
      { $set: { isDefault: false } }
    );

    // Set the selected address as default
    await Address.findByIdAndUpdate(addressId, { isDefault: true });

    res.json({ success: true, message: "Default address updated" });
  } catch (error) {
    console.error("Error setting default address:", error);
    res.json({ success: false, message: "Failed to set default address" });
  }
};

// Password Change Function
const changePassword = async (req, res) => {
  try {
    const userId = req.session.user;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // Check if user has a password (Google users might not have one)
    if (!user.password) {
      return res.json({
        success: false,
        message: "Cannot change password for Google account",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.json({ success: false, message: "Failed to change password" });
  }
};

// Order Management Function
const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Check if order can be cancelled
    const canCancel = order.orderedItems.some(
      (item) => item.status === "Processing" || item.status === "Shipped"
    );

    if (!canCancel) {
      return res.json({ success: false, message: "Order cannot be cancelled" });
    }

    // Update order status to cancelled
    await Order.findByIdAndUpdate(orderId, {
      $set: {
        "orderedItems.$[].status": "Cancelled",
        cancellation_reason: "Cancelled by user",
      },
    });

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.json({ success: false, message: "Failed to cancel order" });
  }
};

// Load Email Verification Page
const loadEmailVerification = async (req, res) => {
  try {
    if (
      !req.session.pendingProfileUpdate ||
      !req.session.emailVerificationOtp
    ) {
      req.session.profileMessage = {
        type: "error",
        text: "No pending email verification found.",
      };
      return res.redirect("/profile/edit");
    }

    // Get verification message from session
    const verifyMessage = req.session.verifyMessage || null;
    req.session.verifyMessage = null;

    res.render("verify-email", { verifyMessage });
  } catch (error) {
    console.error("Error loading email verification:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Verify Email OTP
const verifyEmailOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.session.user;

    if (
      !req.session.pendingProfileUpdate ||
      !req.session.emailVerificationOtp
    ) {
      return res.json({
        success: false,
        message: "No pending email verification found.",
      });
    }

    // Check OTP expiry (5 minutes)
    const otpAge = Date.now() - req.session.otpTimestamp;
    if (otpAge > 5 * 60 * 1000) {
      // Clear expired session data
      delete req.session.pendingProfileUpdate;
      delete req.session.emailVerificationOtp;
      delete req.session.otpTimestamp;
      delete req.session.newEmail;

      return res.json({
        success: false,
        message: "Verification code has expired. Please try again.",
      });
    }

    // Verify OTP
    if (otp !== req.session.emailVerificationOtp) {
      return res.json({
        success: false,
        message: "Invalid verification code. Please try again.",
      });
    }

    // Update profile with pending data
    const updateData = req.session.pendingProfileUpdate;
    await User.findByIdAndUpdate(userId, updateData, { new: true });

    // Clear session data
    delete req.session.pendingProfileUpdate;
    delete req.session.emailVerificationOtp;
    delete req.session.otpTimestamp;
    delete req.session.newEmail;

    // Set success message
    req.session.profileMessage = {
      type: "success",
      text: "Email verified and profile updated successfully!",
    };

    res.json({ success: true, message: "Email verified successfully!" });
  } catch (error) {
    console.error("Error verifying email OTP:", error);
    res.json({
      success: false,
      message: "Failed to verify email. Please try again.",
    });
  }
};

// Resend Email OTP
const resendEmailOTP = async (req, res) => {
  try {
    if (!req.session.pendingProfileUpdate || !req.session.newEmail) {
      return res.json({
        success: false,
        message: "No pending email verification found.",
      });
    }

    // Generate new OTP
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(req.session.newEmail, otp);

    if (!emailSent) {
      return res.json({
        success: false,
        message: "Failed to send verification email!",
      });
    }

    // Update session with new OTP
    req.session.emailVerificationOtp = otp;
    req.session.otpTimestamp = Date.now();

    res.json({
      success: true,
      message: "Verification code sent successfully!",
    });
  } catch (error) {
    console.error("Error resending email OTP:", error);
    res.json({
      success: false,
      message: "Failed to resend verification code.",
    });
  }
};

// Update Basic Profile (without email)
const updateBasicProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, phone, dateOfBirth, bio } = req.body;

    // Basic validation for required fields (excluding email)
    if (!name || name.trim().length === 0) {
      req.session.profileMessage = {
        type: "error",
        text: "Name is required",
      };
      return res.redirect("/profile");
    }

    // Prepare update data (excluding email)
    const updateData = {
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      dateOfBirth: dateOfBirth || null,
      bio: bio ? bio.trim() : null,
    };

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });
    console.log("Updated User:", updatedUser);

    // Set success message in session and redirect
    req.session.profileMessage = {
      type: "success",
      text: "Profile updated successfully!",
    };
    res.redirect("/profile");
  } catch (error) {
    console.error("Error updating basic profile:", error);
    req.session.profileMessage = {
      type: "error",
      text: "Failed to update profile. Please try again.",
    };
    res.redirect("/profile");
  }
};

// Change Email (separate function)
const changeEmail = async (req, res) => {
  try {
    const userId = req.session.user;
    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Get current user
    const currentUser = await User.findById(userId);
    if (email === currentUser.email) {
      return res.json({
        success: false,
        message: "New email must be different from current email",
      });
    }

    // Check if new email already exists
    const existingUser = await User.findOne({
      email: email,
      _id: { $ne: userId },
    });
    if (existingUser) {
      return res.json({ success: false, message: "Email already exists!" });
    }

    // Generate OTP for email verification
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json({
        success: false,
        message: "Failed to send verification email!",
      });
    }

    // Store pending update data in session
    req.session.pendingProfileUpdate = {
      name: currentUser.name,
      email: email.trim(),
      phone: currentUser.phone,
      dateOfBirth: currentUser.dateOfBirth,
      bio: currentUser.bio,
    };

    req.session.emailVerificationOtp = otp;
    req.session.otpTimestamp = Date.now();
    req.session.newEmail = email.trim();

    // Return success response
    res.json({
      success: true,
      message: "Verification code sent successfully!",
      redirectUrl: "/profile/verify-email",
    });
  } catch (error) {
    console.error("Error changing email:", error);
    res.json({
      success: false,
      message: "Failed to send verification email. Please try again.",
    });
  }
};

module.exports = {
  loadProfile,
  loadEditProfile,
  updateProfile,
  updateBasicProfile,
  changeEmail,
  addAddress,
  getAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress,
  changePassword,
  cancelOrder,
  loadEmailVerification,
  verifyEmailOTP,
  resendEmailOTP,
};
