const User = require("../models/userSchema");
const user=require("../models/userSchema");

const userAuth =(req,res,next)=>{
  if(req.session.user){
    User.findById(req.session.user)
    .then(data=>{
      if(data && !data.isBlocked){
        next();
      }else{
        req.session.destroy()
        res.redirect("/login")        
      }
    })
    .catch(error=>{
      console.log("Error in user auth middlware");
      res.status(500).send("Internal Server Error")
    })
  }else{
    // Set auth message for any protected route
    req.session.authMessage = "Please sign in to access this page";
    res.redirect("/login")
  }

  
}


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