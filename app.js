const express = require('express');
const app = express();
const path = require("path");
const passport=require("./config/passport");
require('dotenv').config();
const session = require("express-session");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
db();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
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



app.use("/", userRouter); 
app.use((req, res, next) => {
    res.set(`cache-control`, `no-store`);
    next();
});

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 4200; // Fix this line (see below)
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;