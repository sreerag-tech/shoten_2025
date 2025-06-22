const express = require('express');
const app = express();
const path = require("path");
const passport=require("./config/passport");
require('dotenv').config();
const session = require("express-session");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require('./routes/adminRouter')
db();

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

    // Check if the request is for admin routes
    if (req.originalUrl.startsWith('/admin')) {
        // Render admin 404 page
        res.status(404).render(path.join(__dirname, 'views/admin/404'), {
            title: 'Page Not Found - Admin Panel',
            url: req.originalUrl,
            layout: false // Don't use any layout for 404 page
        });
    } else {
        // Render user 404 page
        res.status(404).render(path.join(__dirname, 'views/user/404'), {
            title: 'Page Not Found - Shoten',
            url: req.originalUrl,
            layout: false // Don't use any layout for 404 page
        });
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    // Set default error status
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Log error details
    console.error(`Error ${status}: ${message}`);
    console.error('Stack:', err.stack);

    // Check if the request is for admin routes
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

const PORT = process.env.PORT || 4200;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


// module.exports = app;