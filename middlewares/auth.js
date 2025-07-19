const User = require("../models/userSchema");
const user=require("../models/userSchema");

const userAuth = (req, res, next) => {
  if (req.session.user) {
    User.findById(req.session.user)
      .then(data => {
        if (data && !data.isBlocked) {
          // Update session activity timestamp
          req.session.lastActivity = Date.now();
          next();
        } else {
          // User is blocked or doesn't exist
          req.session.destroy((err) => {
            if (err) {
              console.log("Session destruction error:", err);
            }
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
              return res.status(401).json({
                success: false,
                message: data ? "Your account has been blocked" : "User account not found",
                redirect: "/login"
              });
            }
            res.redirect("/login");
          });
        }
      })
      .catch(error => {
        console.log("Error in user auth middleware:", error);
        req.session.destroy((err) => {
          if (err) {
            console.log("Session destruction error:", err);
          }
          if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({
              success: false,
              message: "Authentication error",
              redirect: "/login"
            });
          }
          res.status(500).send("Internal Server Error");
        });
      });
  } else {
    // Set auth message for any protected route
    req.session.authMessage = "Please sign in to access this page";
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(401).json({
        success: false,
        message: "Please sign in to access this page",
        redirect: "/login"
      });
    }
    res.redirect("/login");
  }
};


const adminAuth = (req, res, next) => {
  if (req.session.admin) {
          // console.log("admin session id: ", req.session.admin);
          next();
        } else {
          res.redirect("/admin/login");
        }

};

module.exports={
  userAuth,
  adminAuth,
}