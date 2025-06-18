const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Order = require("../../models/orderSchema");

// Load Inventory Management Page
const loadInventory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;
    
    // Search and filter parameters
    const search = req.query.search || "";
    const category = req.query.category || "";
    const stockStatus = req.query.stockStatus || "";
    const sortBy = req.query.sortBy || "productName";
    const sortOrder = req.query.sortOrder || "asc";

    // Build query object
    let query = { isDeleted: { $ne: true } };

    // Search by product name
    if (search) {
      query.productName = { $regex: search, $options: "i" };
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by stock status
    if (stockStatus === "inStock") {
      query.quantity = { $gt: 0 };
    } else if (stockStatus === "outOfStock") {
      query.quantity = { $lte: 0 };
    } else if (stockStatus === "lowStock") {
      query.quantity = { $gt: 0, $lte: 10 }; // Low stock threshold: 10 or less
    }

    // Sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get products with pagination
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Get categories for filter dropdown
    const categories = await Category.find({ isListed: true }).sort({ name: 1 });

    // Get inventory statistics
    const inventoryStats = await Product.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: "$quantity" },
          inStock: { $sum: { $cond: [{ $gt: ["$quantity", 0] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $lte: ["$quantity", 0] }, 1, 0] } },
          lowStock: { $sum: { $cond: [{ $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", 10] }] }, 1, 0] } },
          totalValue: { $sum: { $multiply: ["$quantity", "$salePrice"] } }
        }
      }
    ]);

    const stats = inventoryStats[0] || {
      totalProducts: 0,
      totalStock: 0,
      inStock: 0,
      outOfStock: 0,
      lowStock: 0,
      totalValue: 0
    };

    res.render("inventory", {
      products: products,
      categories: categories,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts,
      search: search,
      category: category,
      stockStatus: stockStatus,
      sortBy: sortBy,
      sortOrder: sortOrder,
      stats: stats,
      activePage: 'inventory'
    });
  } catch (error) {
    console.error('Error loading inventory:', error);
    res.redirect("/admin/pageerror");
  }
};

// Update Product Stock
const updateStock = async (req, res) => {
  try {
    const productId = req.params.id;
    const { quantity, action } = req.body; // action: 'set', 'add', 'subtract'

    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ success: false, message: 'Product not found' });
    }

    let newQuantity;
    if (action === 'set') {
      newQuantity = parseInt(quantity);
    } else if (action === 'add') {
      newQuantity = product.quantity + parseInt(quantity);
    } else if (action === 'subtract') {
      newQuantity = product.quantity - parseInt(quantity);
    } else {
      return res.json({ success: false, message: 'Invalid action' });
    }

    // Ensure quantity doesn't go below 0
    if (newQuantity < 0) {
      return res.json({ success: false, message: 'Stock cannot be negative' });
    }

    product.quantity = newQuantity;
    await product.save();

    res.json({ 
      success: true, 
      message: 'Stock updated successfully',
      newQuantity: newQuantity
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.json({ success: false, message: 'Failed to update stock' });
  }
};

// Bulk Stock Update
const bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body; // Array of {productId, quantity, action}

    // Validate input
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const update of updates) {
      try {
        const { productId, quantity, action } = update;

        // Validate update data
        if (!productId || quantity === undefined || !action) {
          results.push({
            productId: productId || 'unknown',
            success: false,
            message: 'Invalid update data - missing required fields'
          });
          failCount++;
          continue;
        }

        // Validate quantity
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty < 0) {
          results.push({
            productId,
            success: false,
            message: 'Invalid quantity - must be a non-negative number'
          });
          failCount++;
          continue;
        }

        // Find product
        const product = await Product.findById(productId);
        if (!product) {
          results.push({
            productId,
            success: false,
            message: 'Product not found'
          });
          failCount++;
          continue;
        }

        // Calculate new quantity
        let newQuantity;
        const oldQuantity = product.quantity;

        switch (action) {
          case 'set':
            newQuantity = qty;
            break;
          case 'add':
            newQuantity = oldQuantity + qty;
            break;
          case 'subtract':
            newQuantity = Math.max(0, oldQuantity - qty); // Prevent negative stock
            break;
          default:
            results.push({
              productId,
              success: false,
              message: 'Invalid action - must be set, add, or subtract'
            });
            failCount++;
            continue;
        }

        // Update product
        product.quantity = newQuantity;
        product.updatedAt = new Date();
        await product.save();

        results.push({
          productId,
          productName: product.productName,
          success: true,
          oldQuantity,
          newQuantity,
          action,
          message: `Stock updated from ${oldQuantity} to ${newQuantity}`
        });
        successCount++;

      } catch (error) {
        console.error(`Error updating product ${update.productId}:`, error);
        results.push({
          productId: update.productId || 'unknown',
          success: false,
          message: error.message || 'Update failed due to server error'
        });
        failCount++;
      }
    }

    // Prepare response
    let message;
    if (successCount > 0 && failCount === 0) {
      message = `Successfully updated stock for ${successCount} product${successCount > 1 ? 's' : ''}`;
    } else if (successCount > 0 && failCount > 0) {
      message = `Bulk update completed: ${successCount} successful, ${failCount} failed`;
    } else {
      message = `Bulk update failed: All ${failCount} product${failCount > 1 ? 's' : ''} failed to update`;
    }

    res.json({
      success: successCount > 0,
      message,
      stats: {
        total: updates.length,
        successful: successCount,
        failed: failCount
      },
      results
    });

  } catch (error) {
    console.error('Error in bulk stock update:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during bulk update'
    });
  }
};

// Get Low Stock Alert
const getLowStockAlert = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    
    const lowStockProducts = await Product.find({
      quantity: { $gt: 0, $lte: threshold },
      isDeleted: { $ne: true }
    })
    .populate('category', 'name')
    .sort({ quantity: 1 });

    res.json({
      success: true,
      products: lowStockProducts,
      count: lowStockProducts.length
    });
  } catch (error) {
    console.error('Error getting low stock alert:', error);
    res.json({ success: false, message: 'Failed to get low stock products' });
  }
};

// Export Inventory Report
const exportInventoryReport = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: { $ne: true } })
      .populate('category', 'name')
      .sort({ productName: 1 });

    // Create CSV content
    let csvContent = 'Product Name,Category,Current Stock,Sale Price,Regular Price,Total Value,Status\n';
    
    products.forEach(product => {
      const status = product.quantity <= 0 ? 'Out of Stock' : 
                    product.quantity <= 10 ? 'Low Stock' : 'In Stock';
      const totalValue = product.quantity * product.salePrice;
      
      csvContent += `"${product.productName}","${product.category?.name || 'N/A'}",${product.quantity},${product.salePrice},${product.regularPrice},${totalValue},"${status}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory-report.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting inventory report:', error);
    res.status(500).json({ success: false, message: 'Failed to export report' });
  }
};

module.exports = {
  loadInventory,
  updateStock,
  bulkUpdateStock,
  getLowStockAlert,
  exportInventoryReport
};
