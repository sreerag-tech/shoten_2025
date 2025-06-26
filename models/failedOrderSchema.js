const mongoose = require("mongoose");
const { Schema } = mongoose;

const failedOrderSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tempOrderId: {
    type: String,
    required: true
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  orderData: {
    type: Schema.Types.Mixed,
    required: true
  },
  orderedItems: [{
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
      required: true,
    },
    status: {
      type: String,
      default: 'Pending'
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    default: 'razorpay'
  },
  failureReason: {
    type: String,
    default: null
  },
  attemptCount: {
    type: Number,
    default: 1
  },
  lastAttempt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  },
  status: {
    type: String,
    enum: ['Failed', 'Retrying', 'Expired', 'Completed'],
    default: 'Failed'
  },
  actualOrderId: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    default: null
  }
});

// Create indexes using schema.index() method only
failedOrderSchema.index({ userId: 1, createdAt: -1 });
failedOrderSchema.index({ tempOrderId: 1 }, { unique: true });
failedOrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const FailedOrder = mongoose.model("FailedOrder", failedOrderSchema);
module.exports = FailedOrder;
