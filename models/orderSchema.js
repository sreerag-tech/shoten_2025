const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderedItems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      status: {
        type: String,
        required: true,
        enum: [
          "Pending",
          "Processing",
          "Shipped",
          "Out for Delivery",
          "Delivered",
          "Cancelled",
          "Return Request",
          "Returned",
          "Payment Failed",
        ],
        default: "Pending",
      },
      returnReason: {
        type: String,
        default: null,
      },
      adminResponse: {
        type: String,
        default: null,
      },
      cancelReason: {
        type: String,
        default: null,
      },
      cancelledAt: {
        type: Date,
        default: null,
      },
    },
  ],
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Payment Failed",
    ],
    default: "Pending",
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  shippingCharge: {
    type: Number,
    required: false,
    default: 0,
  },
  discount: {
    type: Number,
    required: true,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  shippingAddress: {
    fullName: {
      type: String,
      required: true
    },
    addressType: {
      type: String,
      required: true
    },
    landmark: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      required: true
    },
    phone: {
      type: Number,
      required: true
    },
  },
  paymentMethod: {
    type: String,
    enum: ["debitCredit", "bank", "upi", "wallet", "cod", "razorpay"],
    required: true,
  },
  paymentGateway: {
    type: String,
    enum: ["Razorpay", "Other"],
    default: "Razorpay",
  },
  invoiceDate: {
    type: Date,
    default: Date.now,
  },
  orderDate: {
    type: Date,
    required: true,
  },
  deliveryDate: {
    type: Date,
    required: true,
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  couponCode: {
    type: String,
    default: null,
  },
  cancellation_reason: {
    type: String,
    default: null,
  },
  return_reason: {
    type: String,
    default: null,
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Completed", "Failed", "Refunded"],
    default: "Pending",
  },
  razorpayOrderId: {
    type: String,
    default: null,
  },
  razorpayPaymentId: {
    type: String,
    default: null,
  },
  refundStatus: {
    type: String,
    enum: ["None", "Partial", "Completed"],
    default: "None",
  },
  refundAmount: {
    type: Number,
    default: 0,
  },
  refundDate: {
    type: Date,
    default: null,
  },
  cancelReason: {
    type: String,
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  returnDays: {
    type: Number,
    default: 7, // Default 7 days return policy
  },
  deliveredAt: {
    type: Date,
    default: null,
  },
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;