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




const PORT = process.env.PORT || 4200; // Fix this line (see below)
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


module.exports = app;