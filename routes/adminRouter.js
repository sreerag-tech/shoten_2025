const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin/adminController");
const { route } = require("./userRouter");
const customerController=require("../controllers/admin/customerController");
const categoryController=require("../controllers/admin/categoryController")
const {userAuth,adminAuth}=require("../middlewares/auth")
const productController=require("../controllers/admin/productController")


router.get("/pageerror",adminController.pageerror);
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/dashboard",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout);

router.get("/users",adminAuth,customerController.customerInfo); 
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);



router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
// router.post("/login",adminController.login);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);
router.post("/delete-category/:id", adminAuth, categoryController.deleteCategory);



router.get("/addProducts",adminAuth,productController.getProductAddPage);



module.exports=router;