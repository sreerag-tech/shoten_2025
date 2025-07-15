const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const Wallet = require("../../models/walletSchema");
const offerService = require("../../services/offerService");
const couponService = require("../../services/couponService");
const PaymentService = require("../../services/paymentService");
const { useWalletForPayment } = require("./walletController");
const { v4: uuidv4 } = require('uuid');

// Place Order
const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const {
            addressId,
            paymentMethod = 'COD',
            subtotal,
            shippingCharge,
            discount,
            totalAmount
        } = req.body;
        console.log(req.body, 'Request body for placing order');

        if (!addressId) {
            return res.json({ success: false, message: 'Please select a delivery address' });
        }

        // Reject COD for orders >= ₹1000
        if (paymentMethod === 'COD' && totalAmount >= 1000) {
            return res.json({ success: false, message: 'Cash on Delivery is not available for orders of ₹1000 or more' });
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

        // Calculate order totals with offers
        let calculatedSubtotal = 0;
        const orderedItems = [];

        for (const item of validCartItems) {
            // Calculate offer for the product
            const offerResult = await offerService.calculateBestOfferForProduct(item.productId._id, userId);

            let finalPrice = item.productId.salePrice;
            if (offerResult) {
                finalPrice = offerResult.finalPrice;
            }

            const itemTotal = finalPrice * item.quantity;
            calculatedSubtotal += itemTotal;

            orderedItems.push({
                product: item.productId._id,
                quantity: item.quantity,
                price: finalPrice,
                status: 'Processing'
            });

            // Reduce product stock
            await Product.findByIdAndUpdate(item.productId._id, {
                $inc: { quantity: -item.quantity }
            });
        }

        // Calculate shipping charge
        const calculatedShippingCharge = calculatedSubtotal >= 500 ? 0 : 50;

        // Handle coupon discount
        let calculatedDiscount = 0;
        let couponCode = null;
        let couponApplied = false;

        if (req.session.appliedCoupon) {
            const couponResult = await couponService.applyCoupon(req.session.appliedCoupon.code, userId, calculatedSubtotal);

            if (couponResult.isValid) {
                calculatedDiscount = couponResult.discount;
                couponCode = couponResult.coupon.code;
                couponApplied = true;

                // Use the coupon (increment usage count)
                await couponService.useCoupon(couponResult.coupon._id, userId);
            }

            // Clear coupon from session after processing
            req.session.appliedCoupon = null;
        }

        const finalTotal = calculatedSubtotal + calculatedShippingCharge - calculatedDiscount;

        // Generate unique order ID
        const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        // Create order
        const newOrder = new Order({
            orderId: orderId,
            userId: userId,
            orderedItems: orderedItems,
            totalPrice: calculatedSubtotal,
            shippingCharge: calculatedShippingCharge,
            discount: calculatedDiscount,
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
            paymentMethod: paymentMethod === 'COD' ? 'cod' : paymentMethod === 'Wallet' ? 'wallet' : 'razorpay',
            paymentGateway: paymentMethod === 'COD' || paymentMethod === 'Wallet' ? 'Other' : 'Razorpay',
            orderDate: new Date(),
            deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            invoiceDate: new Date(),
            couponApplied: couponApplied,
            couponCode: couponCode,
            status: 'Processing',
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Completed',
            razorpayOrderId: null,
            razorpayPaymentId: null
        });

        if (paymentMethod === 'Wallet') {
            try {
                const walletResult = await useWalletForPayment({
                    session: { user: userId },
                    body: {
                        amount: finalTotal,
                        orderId: newOrder._id,
                        description: `Payment for order #${orderId}`
                    }
                }, {
                    json: (data) => {
                        console.log('Wallet payment response:', data);
                        return data;
                    }
                });

                if (!walletResult || !walletResult.success) {
                    console.error('Wallet payment failed:', walletResult?.message || 'No response from wallet payment');
                    return res.json({
                        success: false,
                        message: walletResult?.message || 'Failed to process wallet payment'
                    });
                }

                // Save order
                await newOrder.save();

                // Clear cart
                await Cart.deleteMany({ userId: userId });

                // Update user order history
                await User.findByIdAndUpdate(userId, {
                    $push: { orderHistory: newOrder._id }
                });
                console.log(newOrder._id, 'Order placed successfully using wallet!');

                return res.json({
                    success: true,
                    message: 'Order placed successfully using wallet!',
                    orderId: newOrder._id
                });
            } catch (error) {
                console.error('Error processing wallet payment:', error);
                return res.json({
                    success: false,
                    message: 'Failed to process wallet payment: ' + error.message
                });
            }
        } else if (paymentMethod === 'Online') {
            // Create Razorpay order for online payment
            const user = await User.findById(userId);
            const razorpayResult = await PaymentService.createRazorpayOrder({
                orderId: orderId,
                totalAmount: finalTotal,
                userId: userId,
                customerName: user.name,
                customerEmail: user.email
            });

            if (!razorpayResult.success) {
                return res.json({
                    success: false,
                    message: 'Failed to create payment order'
                });
            }

            // Update order with Razorpay order ID
            newOrder.razorpayOrderId = razorpayResult.razorpayOrderId;

            // Store order data in session for later use (after payment success)
            req.session.pendingOrder = {
                orderData: newOrder.toObject(),
                orderedItems: orderedItems,
                userId: userId,
                couponCode: couponCode,
                couponApplied: couponApplied,
                razorpayOrderId: razorpayResult.razorpayOrderId,
                tempOrderId: orderId
            };

            // Generate payment options for frontend
            const paymentOptions = PaymentService.generatePaymentOptions(
                {
                    orderId: orderId,
                    totalAmount: finalTotal,
                    customerName: user.name,
                    customerEmail: user.email,
                    customerPhone: user.phone
                },
                razorpayResult.razorpayOrderId
            );

            return res.json({
                success: true,
                paymentRequired: true,
                tempOrderId: orderId,
                razorpayOrderId: razorpayResult.razorpayOrderId,
                paymentOptions: paymentOptions
            });
        } else if (paymentMethod === 'COD') {
            console.log(totalAmount, 'Processing COD order');
            // COD Order - Process immediately
            await newOrder.save();

            // Clear cart
            await Cart.deleteMany({ userId: userId });

            // Update user order history
            await User.findByIdAndUpdate(userId, {
                $push: { orderHistory: newOrder._id }
            });

            return res.json({
                success: true,
                message: 'Order placed successfully!',
                orderId: newOrder._id
            });
        }

    } catch (error) {
        console.error('Error placing order:', error);
        return res.json({ success: false, message: 'Failed to place order: ' + error.message });
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

        return res.json({
            success: true,
            message: 'Address added successfully!',
            address: newAddress
        });

    } catch (error) {
        console.error('Error adding checkout address:', error);
        return res.json({ success: false, message: 'Failed to add address: ' + error.message });
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

        return res.json({ success: true, message: 'Default address updated successfully' });

    } catch (error) {
        console.error('Error setting default address:', error);
        return res.json({ success: false, message: 'Failed to update default address: ' + error.message });
    }
};

module.exports = {
    placeOrder,
    addCheckoutAddress,
    setDefaultCheckoutAddress
};