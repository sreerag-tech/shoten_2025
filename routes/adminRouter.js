const express = require("express");
const router = express.Router();
const { uploadsArray, uploadsFields } = require("../helpers/multer");

const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const inventoryController = require("../controllers/admin/inventoryController");
const couponController = require("../controllers/admin/couponController");
const offerController = require("../controllers/admin/offerController");
const salesReportController = require("../controllers/admin/salesReportController");
const { userAuth, adminAuth } = require("../middlewares/auth");

router.get("/pageerror", adminController.pageerror);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/dashboard", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);

router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);

router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);
// router.post("/delete-category/:id", adminAuth, categoryController.deleteCategory);

router.get("/add-products", adminAuth, productController.getProductAddPage);
router.post("/add-products", adminAuth, uploadsArray, productController.addProducts);
router.get("/products", adminAuth, productController.getProductList);
router.post("/delete-product/:id", adminAuth, productController.deleteProduct);
router.post("/toggle-block-product/:id", adminAuth, productController.toggleBlockProduct);

router.get("/edit-product/:id", adminAuth, productController.getEditProductPage);
router.post(
  "/edit-product/:id",
  adminAuth,
  uploadsFields,
  productController.editProduct
);

// Order Management Routes
router.get("/orders", adminAuth, orderController.loadOrders);
router.get("/orders/:id", adminAuth, orderController.loadOrderDetail);
router.get("/api/orders/:id", adminAuth, orderController.getOrderDetailsAPI);
router.put("/orders/:id/status", adminAuth, orderController.updateOrderStatus);
router.put("/orders/:id/items/:itemIndex/status", adminAuth, orderController.updateItemStatus);
router.get("/return-requests", adminAuth, orderController.getReturnRequests);
router.post("/orders/:id/items/:itemIndex/return", adminAuth, orderController.handleReturnRequest);

// Inventory Management Routes
router.get("/inventory", adminAuth, inventoryController.loadInventory);
router.put("/inventory/:id/stock", adminAuth, inventoryController.updateStock);
router.post("/inventory/bulk-update", adminAuth, inventoryController.bulkUpdateStock);
router.get("/inventory/low-stock", adminAuth, inventoryController.getLowStockAlert);
router.get("/inventory/export", adminAuth, inventoryController.exportInventoryReport);

// Offer Management Routes
router.get("/offers", adminAuth, offerController.loadOffers);
router.get("/offers/add", adminAuth, offerController.loadAddOffer);
router.post("/offers/add", adminAuth, offerController.addOffer);
router.get("/offers/edit/:id", adminAuth, offerController.loadEditOffer);
router.put("/offers/edit/:id", adminAuth, offerController.updateOffer);
router.patch("/offers/:id/toggle-status", adminAuth, offerController.toggleOfferStatus);
router.delete("/offers/:id", adminAuth, offerController.deleteOffer);
router.get("/offers/:id/details", adminAuth, offerController.getOfferDetails);

// Coupon Management Routes
router.get("/coupons", adminAuth, couponController.loadCoupons);
router.get("/coupons/add", adminAuth, couponController.loadAddCoupon);
router.post("/coupons/create", adminAuth, couponController.createCoupon);
router.put("/coupons/toggle/:id", adminAuth, couponController.toggleCouponStatus);
router.delete("/coupons/delete/:id", adminAuth, couponController.deleteCoupon);
router.get("/coupons/api/:id", adminAuth, couponController.getCouponDetails);

// Sales Report Routes
router.get("/sales-report", adminAuth, salesReportController.loadSalesReport);
router.get("/sales-report/download-pdf", adminAuth, salesReportController.downloadPDFReport);
router.get("/sales-report/download-excel", adminAuth, salesReportController.downloadExcelReport);

module.exports = router;