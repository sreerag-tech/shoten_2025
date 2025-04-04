const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require(`bcrypt`);





const pageerror= async(req,res)=>{
  res.render("admin-error")
}





const loadLogin=(req,res)=>{
  if(req.session.admin){
    return res.redirect("/admin/dashboard")
  }
  res.render("admin-login",{message:null})
}






const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin user
    const admin = await User.findOne({ email, isAdmin: true });
    
    if (!admin) {
      // Render admin login page with error message if no admin found
      return res.render('admin-login', { 
        message: 'Invalid email or password',
       
      });
    }
    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, admin.password);
    
    if (passwordMatch) {
      // Successful login
      req.session.admin = true;
      return res.redirect('/admin/dashboard');
    } else {
      // Render admin login page with error message if password doesn't match
      return res.render('admin-login', { 
        message: 'Invalid email or password',
        email // Keep email in form
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    // Render admin login page with generic error
    return res.render('admin-login', { 
      message: 'An error occurred. Please try again.',
      email: req.body.email
    });
  }
};









const loadDashboard= async(req,res)=>{
  if(req.session.admin){
    try{
      res.render("dashboard")
    }catch(error){
      res.redirect("/pageerror")
    }
  }
}









const logout = async(req,res)=>{
  try{
    req.session.destroy(err=>{
      if(err){
        console.log("error destroying session",err);
        return res.redirect("/pageerror")
      }
      res.redirect("/admin/login")
    })
  }catch(error){
    console.log(("unexpected error during logout",error));
    res.redirect("/pageerror")
  }
}






module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
}