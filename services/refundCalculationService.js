/**
 * Refund Calculation Service
 * Handles proper coupon discount distribution and refund calculations
 */

/**
 * Calculate proper refund amount for cancelled/returned items considering coupon discounts
 * @param {Object} order - The order object
 * @param {Array} itemsToRefund - Array of items to refund with their quantities
 * @returns {Object} - Refund calculation details
 */
const calculateRefundAmount = (order, itemsToRefund) => {
  try {
    const orderData = order.toObject ? order.toObject() : order;
    
    // Get order totals
    const subtotal = orderData.totalPrice || 0;
    const shippingCharge = orderData.shippingCharge || 0;
    const couponDiscount = orderData.discount || 0;
    const totalPaidByCustomer = subtotal + shippingCharge - couponDiscount;

    console.log('Refund Calculation - Order totals:', {
      subtotal,
      shippingCharge,
      couponDiscount,
      totalPaidByCustomer
    });

    // If no coupon was applied, simple calculation
    if (couponDiscount === 0) {
      const refundAmount = itemsToRefund.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);

      return {
        refundAmount,
        couponRefundPortion: 0,
        itemRefundPortion: refundAmount,
        calculation: 'No coupon applied - direct item price refund'
      };
    }

    // Complex calculation when coupon was applied
    return calculateCouponAdjustedRefund(orderData, itemsToRefund, couponDiscount);

  } catch (error) {
    console.error('Error in calculateRefundAmount:', error);
    // Fallback to simple calculation
    const fallbackAmount = itemsToRefund.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    return {
      refundAmount: fallbackAmount,
      couponRefundPortion: 0,
      itemRefundPortion: fallbackAmount,
      calculation: 'Fallback calculation due to error'
    };
  }
};

/**
 * Calculate refund when coupon discount needs to be properly distributed
 * @param {Object} orderData - Order data
 * @param {Array} itemsToRefund - Items to refund
 * @param {Number} couponDiscount - Total coupon discount applied
 * @returns {Object} - Detailed refund calculation
 */
const calculateCouponAdjustedRefund = (orderData, itemsToRefund, couponDiscount) => {
  // Calculate total value of items being refunded (before coupon)
  const itemsRefundValue = itemsToRefund.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Calculate total value of all items in order (before coupon)
  const totalOrderItemsValue = orderData.orderedItems.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  console.log('Coupon Refund Calculation:', {
    itemsRefundValue,
    totalOrderItemsValue,
    couponDiscount
  });

  // Calculate proportional coupon discount for refunded items
  const proportionalCouponDiscount = totalOrderItemsValue > 0
    ? Math.round((couponDiscount * itemsRefundValue) / totalOrderItemsValue)
    : 0;

  // Final refund amount = item value - proportional coupon discount
  const refundAmount = Math.max(0, itemsRefundValue - proportionalCouponDiscount);

  return {
    refundAmount,
    couponRefundPortion: proportionalCouponDiscount,
    itemRefundPortion: itemsRefundValue,
    calculation: `Items: ₹${itemsRefundValue} - Coupon portion: ₹${proportionalCouponDiscount} = ₹${refundAmount}`,
    details: {
      itemsRefundValue,
      totalOrderItemsValue,
      proportionalCouponDiscount,
      couponDiscountRate: (proportionalCouponDiscount / itemsRefundValue * 100).toFixed(2) + '%'
    }
  };
};

/**
 * Calculate refund for entire order cancellation
 * @param {Object} order - The order object
 * @returns {Object} - Refund calculation details
 */
const calculateFullOrderRefund = (order) => {
  try {
    const orderData = order.toObject ? order.toObject() : order;
    
    // For full order cancellation, customer gets back exactly what they paid
    const subtotal = orderData.totalPrice || 0;
    const shippingCharge = orderData.shippingCharge || 0;
    const couponDiscount = orderData.discount || 0;
    const refundAmount = subtotal + shippingCharge - couponDiscount;

    return {
      refundAmount: Math.max(0, refundAmount),
      couponRefundPortion: couponDiscount,
      itemRefundPortion: subtotal,
      shippingRefund: shippingCharge,
      calculation: `Full order refund: ₹${subtotal} + ₹${shippingCharge} - ₹${couponDiscount} = ₹${refundAmount}`
    };

  } catch (error) {
    console.error('Error in calculateFullOrderRefund:', error);
    return {
      refundAmount: 0,
      couponRefundPortion: 0,
      itemRefundPortion: 0,
      shippingRefund: 0,
      calculation: 'Error in calculation'
    };
  }
};

/**
 * Validate refund calculation
 * @param {Object} refundCalculation - The refund calculation result
 * @param {Object} order - The original order
 * @returns {Boolean} - Whether the calculation is valid
 */
const validateRefundCalculation = (refundCalculation, order) => {
  try {
    const orderData = order.toObject ? order.toObject() : order;
    const totalPaidByCustomer = (orderData.totalPrice || 0) + (orderData.shippingCharge || 0) - (orderData.discount || 0);
    
    // Refund amount should not exceed what customer paid
    if (refundCalculation.refundAmount > totalPaidByCustomer) {
      console.warn('Refund amount exceeds total paid by customer');
      return false;
    }

    // Refund amount should not be negative
    if (refundCalculation.refundAmount < 0) {
      console.warn('Refund amount is negative');
      return false;
    }

    return true;

  } catch (error) {
    console.error('Error validating refund calculation:', error);
    return false;
  }
};

/**
 * Get refund summary for display
 * @param {Object} refundCalculation - The refund calculation result
 * @returns {String} - Human readable refund summary
 */
const getRefundSummary = (refundCalculation) => {
  if (refundCalculation.couponRefundPortion > 0) {
    return `Refund: ₹${refundCalculation.refundAmount.toLocaleString()} (Items: ₹${refundCalculation.itemRefundPortion.toLocaleString()}, Coupon adjustment: -₹${refundCalculation.couponRefundPortion.toLocaleString()})`;
  } else {
    return `Refund: ₹${refundCalculation.refundAmount.toLocaleString()}`;
  }
};

module.exports = {
  calculateRefundAmount,
  calculateFullOrderRefund,
  validateRefundCalculation,
  getRefundSummary
};
