const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const { v4: uuidv4 } = require('uuid');

// Place Order
const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod = 'COD' } = req.body;
    
    if (!addressId) {
      return res.json({ success: false, message: 'Please select a delivery address' });
    }
    
    // Get selected address
    const selectedAddress = await Address.findOne({ _id: addressId, userId: userId });
    if (!selectedAddress) {
      return res.json({ success: false, message: 'Selected address not found' });
    }
    
    // Get cart items with populated product data
    const cartItems = await Cart.find({ userId: userId })
      .populate({
        path: 'productId',
        populate: {
          path: 'category',
          model: 'Category'
        }
      });
    
    // Validate cart items
    const validCartItems = [];
    for (const item of cartItems) {
      if (!item.productId) continue;
      if (item.productId.isBlocked || item.productId.isDeleted || item.productId.status !== 'Available') continue;
      if (!item.productId.category || item.productId.category.isListed === false) continue;
      
      // Check stock availability
      if (item.productId.quantity < item.quantity) {
        return res.json({ 
          success: false, 
          message: `Insufficient stock for ${item.productId.productName}. Only ${item.productId.quantity} available.` 
        });
      }
      
      validCartItems.push(item);
    }
    
    if (validCartItems.length === 0) {
      return res.json({ success: false, message: 'No valid items in cart' });
    }
    
    // Calculate order totals
    let subtotal = 0;
    const orderedItems = [];
    
    for (const item of validCartItems) {
      const itemTotal = item.productId.salePrice * item.quantity;
      subtotal += itemTotal;
      
      orderedItems.push({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice,
        status: 'Processing'
      });
      
      // Reduce product stock
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { quantity: -item.quantity }
      });
    }
    
    // Calculate taxes and charges
    const taxRate = 0.18;
    const taxAmount = Math.round(subtotal * taxRate);
    const shippingCharge = subtotal >= 500 ? 0 : 50;
    const discount = 0;
    const finalTotal = subtotal + taxAmount + shippingCharge - discount;
    
    // Generate unique order ID
    const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // Create order
    const newOrder = new Order({
      orderId: orderId,
      userId: userId,
      orderedItems: orderedItems,
      totalPrice: subtotal,
      discount: discount,
      finalAmount: finalTotal,
      shippingAddress: {
        fullName: selectedAddress.name,
        addressType: selectedAddress.addressType,
        landmark: selectedAddress.landMark || '',
        city: selectedAddress.city,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: parseInt(selectedAddress.phone)
      },
      paymentMethod: paymentMethod === 'COD' ? 'cod' : paymentMethod.toLowerCase(),
      paymentGateway: paymentMethod === 'COD' ? 'Other' : 'Razorpay',
      orderDate: new Date(),
      deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      invoiceDate: new Date(),
      shippingCharge: shippingCharge,
      taxAmount: taxAmount,
      status: 'Processing'
    });
    
    await newOrder.save();
    
    // Clear cart
    await Cart.deleteMany({ userId: userId });
    
    // Update user order history
    await User.findByIdAndUpdate(userId, {
      $push: { orderHistory: newOrder._id }
    });
    
    res.json({ 
      success: true, 
      message: 'Order placed successfully!',
      orderId: newOrder._id
    });
    
  } catch (error) {
    console.error('Error placing order:', error);
    res.json({ success: false, message: 'Failed to place order. Please try again.' });
  }
};

// Add New Address during Checkout
const addCheckoutAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, addressType, address, locality, city, state, pincode, phone, landMark } = req.body;

    // Validation
    if (!name || !address || !locality || !city || !state || !pincode || !phone) {
      return res.json({ success: false, message: 'All required fields must be filled' });
    }

    // Validate phone number
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.json({ success: false, message: 'Please enter a valid 10-digit phone number' });
    }

    // Validate pincode
    if (!/^[0-9]{6}$/.test(pincode)) {
      return res.json({ success: false, message: 'Please enter a valid 6-digit pincode' });
    }

    // Check if this is the first address (make it default)
    const existingAddresses = await Address.find({ userId: userId });
    const isDefault = existingAddresses.length === 0;

    // Create new address
    const newAddress = new Address({
      userId: userId,
      name: name.trim(),
      addressType: addressType || 'Home',
      address: address.trim(),
      locality: locality.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      phone: phone.trim(),
      landMark: landMark ? landMark.trim() : null,
      isDefault: isDefault
    });

    await newAddress.save();

    res.json({
      success: true,
      message: 'Address added successfully!',
      address: newAddress
    });

  } catch (error) {
    console.error('Error adding checkout address:', error);
    res.json({ success: false, message: 'Failed to add address. Please try again.' });
  }
};

// Set Default Address
const setDefaultCheckoutAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.body;
    
    // Remove default from all addresses
    await Address.updateMany({ userId: userId }, { isDefault: false });
    
    // Set new default
    const result = await Address.findOneAndUpdate(
      { _id: addressId, userId: userId },
      { isDefault: true },
      { new: true }
    );
    
    if (!result) {
      return res.json({ success: false, message: 'Address not found' });
    }
    
    res.json({ success: true, message: 'Default address updated successfully' });
    
  } catch (error) {
    console.error('Error setting default address:', error);
    res.json({ success: false, message: 'Failed to update default address' });
  }
};

module.exports = {
  placeOrder,
  addCheckoutAddress,
  setDefaultCheckoutAddress
};
