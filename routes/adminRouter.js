const express = require("express");
const router = express.Router();
const { uploadsArray, uploadsFields } = require("../helpers/multer");

const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const inventoryController = require("../controllers/admin/inventoryController");
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

module.exports = router;