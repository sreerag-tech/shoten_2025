const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletTransactionSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ["credit", "debit"],
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    required: true,
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    default: null,
  },
  transactionId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "completed",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const walletSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  transactions: [walletTransactionSchema],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
walletSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to add money to wallet
walletSchema.methods.addMoney = function(amount, description, orderId = null, transactionId = null) {
  this.balance += amount;
  this.transactions.push({
    type: "credit",
    amount: amount,
    description: description,
    orderId: orderId,
    transactionId: transactionId,
    status: "completed"
  });
  return this.save();
};

// Method to deduct money from wallet
walletSchema.methods.deductMoney = function(amount, description, orderId = null) {
  if (this.balance < amount) {
    throw new Error("Insufficient wallet balance");
  }
  this.balance -= amount;
  this.transactions.push({
    type: "debit",
    amount: amount,
    description: description,
    orderId: orderId,
    status: "completed"
  });
  return this.save();
};

// Method to get transaction history
walletSchema.methods.getTransactionHistory = function(limit = 10, skip = 0) {
  return this.transactions
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(skip, skip + limit);
};

module.exports = mongoose.model("Wallet", walletSchema);