const cron = require('node-cron');
const mongoose = require('mongoose');
const Offer = require('./models/offerSchema');
const Coupon = require('./models/couponSchema');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/your_database', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected for cron'))
  .catch(err => console.error('MongoDB connection error:', err));

// Current date and time (IST)
const currentDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });

// Function to update offers
const updateOffers = async () => {
  try {
    const now = new Date(currentDate);
    const activeOffers = await Offer.updateMany(
      { startDate: { $lte: now }, endDate: { $gte: now }, isActive: false, isDeleted: false },
      { $set: { isActive: true } }
    );
    const expiredOffers = await Offer.updateMany(
      { endDate: { $lt: now }, isActive: true, isDeleted: false },
      { $set: { isActive: false } }
    );
    console.log(`Updated ${activeOffers.modifiedCount} offers to active, ${expiredOffers.modifiedCount} to inactive at ${currentDate}`);
  } catch (error) {
    console.error('Error updating offers:', error);
  }
};

// Function to update coupons
const updateCoupons = async () => {
  try {
    const now = new Date(currentDate);
    const activeCoupons = await Coupon.updateMany(
      { startOn: { $lte: now }, expireOn: { $gte: now }, isListed: false, isDeleted: false },
      { $set: { isListed: true } }
    );
    const expiredCoupons = await Coupon.updateMany(
      { expireOn: { $lt: now }, isListed: true, isDeleted: false },
      { $set: { isListed: false } }
    );
    console.log(`Updated ${activeCoupons.modifiedCount} coupons to active, ${expiredCoupons.modifiedCount} to inactive at ${currentDate}`);
  } catch (error) {
    console.error('Error updating coupons:', error);
  }
};

// Schedule the jobs to run every 5 minutes
cron.schedule('*/1440 * * * *', () => {
  console.log('Running cron jobs at', currentDate);
  updateOffers();
  updateCoupons();
}, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});

// Keep the process running
process.on('SIGTERM', () => {
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
  });
});