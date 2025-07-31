const express = require('express');
const app = express();
const path = require("path");
const passport = require("./config/passport");
require('dotenv').config();
const session = require("express-session");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require('./routes/adminRouter');
const cron = require('node-cron');
const mongoose = require('mongoose');
const Offer = require('./models/offerSchema');
const Coupon = require('./models/couponSchema');

db();

// Install node-cron if not already installed
// npm install node-cron

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Session timeout middleware
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    if (req.session.lastActivity) {
      const currentTime = Date.now();
      const sessionTimeout = 72 * 60 * 60 * 1000; // 72 hours in milliseconds

      if (currentTime - req.session.lastActivity > sessionTimeout) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying expired session:', err);
          }
          if (!req.xhr && (!req.headers.accept || req.headers.accept.indexOf('json') === -1)) {
            return res.redirect('/login?expired=true');
          }
          if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({
              success: false,
              message: 'Your session has expired. Please log in again.',
              redirect: '/login'
            });
          }
        });
        return;
      }

      req.session.lastActivity = currentTime;
    } else {
      req.session.lastActivity = Date.now();
    }
  }
  next();
});

// Cache control middleware
app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
});

// Disable caching for all requests
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Set view engine first
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Set views directory to include both admin and user views
app.set("views", [
    path.join(__dirname, 'views/admin'),
    path.join(__dirname, 'views/user')
]);

// Mount admin router
app.use('/admin', adminRouter);

// Mount user router
app.use("/", userRouter);

// Development test routes (only in development mode)
if (process.env.NODE_ENV === 'development') {
    app.get('/test-500-error', (req, res, next) => {
        const error = new Error('This is a test 500 error');
        error.status = 500;
        next(error);
    });

    app.get('/admin/test-500-error', (req, res, next) => {
        const error = new Error('This is a test admin 500 error');
        error.status = 500;
        next(error);
    });
}

// 404 Error Handler - Must be after all routes
app.use((req, res, next) => {
    const error = new Error(`Page not found: ${req.originalUrl}`);
    error.status = 404;

    if (req.originalUrl.startsWith('/admin')) {
        res.status(404).render(path.join(__dirname, 'views/admin/404'), {
            title: 'Page Not Found - Admin Panel',
            url: req.originalUrl,
            layout: false
        });
    } else {
        res.status(404).render(path.join(__dirname, 'views/user/404'), {
            title: 'Page Not Found - Shoten',
            url: req.originalUrl,
            layout: false
        });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    console.error(`Error ${status}: ${message}`);
    console.error('Stack:', err.stack);

    if (req.originalUrl.startsWith('/admin')) {
        res.status(status).render(path.join(__dirname, 'views/admin/admin-error'), {
            title: `Error ${status} - Admin Panel`,
            error: process.env.NODE_ENV === 'development' ? err : {},
            status: status,
            message: message,
            layout: false
        });
    } else {
        res.status(status).render(path.join(__dirname, 'views/user/error'), {
            title: `Error ${status} - Shoten`,
            error: process.env.NODE_ENV === 'development' ? err : {},
            status: status,
            message: message,
            layout: false
        });
    }
});

// Cron job setup
const currentDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });

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
cron.schedule('*/5 * * * *', () => {
  console.log('Running cron jobs at', currentDate);
  updateOffers();
  updateCoupons();
}, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});

const PORT = process.env.PORT || 4200;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});