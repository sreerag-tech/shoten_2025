const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// ✅ ADDED: Helper function to safely delete files with delay to prevent EPERM errors
const safeDeleteFile = (filePath, delay = 1000) => {
  setTimeout(async () => {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`Successfully deleted: ${filePath}`);
      }
    } catch (error) {
      console.warn(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }, delay);
};

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const error = req.query.error || null;
    const success = req.query.success || null; // ✅ ADDED: Success message support
    res.render("product-add", { cat: category, error, success });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};

const addProducts = async (req, res) => {
  try {
    const products = req.body;
    

    const productExists = await Product.findOne({ productName: products.productName });

    if (!productExists) {
      const images = [];


if (req.files && req.files.length > 0) {
  for (let i = 0; i < req.files.length; i++) {
    const imagePath = path.join("public", "uploads", "product-images", req.files[i].filename);

    // ✅ ENHANCED: Move the uploaded file to the desired folder with better error handling
    try {
      // ✅ ADDED: Check if source file exists before trying to move it
      if (fs.existsSync(req.files[i].path)) {
        await fs.promises.rename(req.files[i].path, imagePath);
        images.push(req.files[i].filename);
      } else {
        console.warn(`Source file does not exist: ${req.files[i].path}`);
      }
    } catch (error) {
      console.error(`Error saving image: ${error.message}`);
      // ✅ ADDED: Try copying instead of moving if rename fails
      try {
        if (fs.existsSync(req.files[i].path)) {
          await fs.promises.copyFile(req.files[i].path, imagePath);
          images.push(req.files[i].filename);
          // ✅ ADDED: Delete original file after successful copy using safe delete
          safeDeleteFile(req.files[i].path, 1000);
        }
      } catch (copyError) {
        console.error(`Error copying image: ${copyError.message}`);
      }
    }
  }
}

      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
        return res.redirect("/admin/add-products?error=Invalid+category+name");
      }

      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        category: categoryId._id,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        createdOn: new Date(),
        quantity: products.quantity,
        productImage: images,
        status: "Available",
      });

      await newProduct.save();

      return res.redirect("/admin/add-products?success=Product+added+successfully"); // ✅ ADDED: Success message
      
    } else {
      return res.redirect("/admin/add-products?error=Product+already+exists");
    }
  } catch (error) {
    console.error("Error saving product:", error);
    return res.redirect("/admin/pageerror");
  }
};

const getProductList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6; // Number of products per page
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const error = req.query.error || null;
    const success = req.query.success || null; // ✅ ADDED: Success message support

    // ✅ ADDED: Build search query (exclude soft-deleted products)
    const query = search
      ? {
          isDeleted: { $ne: true }, // ✅ ADDED: Exclude soft-deleted products
          $or: [
            { productName: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } }
          ]
        }
      : { isDeleted: { $ne: true } }; // ✅ ADDED: Exclude soft-deleted products

    // Fetch products with search, pagination, and populate category
    const products = await Product.find(query)
      .populate("category")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    res.render("products", {
      products,
      error,
      success, // ✅ ADDED: Pass success message to view
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts,
      search: search,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.redirect("/admin/pageerror");
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.redirect("/admin/products?error=Product+not+found");
    }

    if (product.isDeleted) {
      return res.redirect("/admin/products?error=Product+already+deleted");
    }

    // ✅ ADDED: Soft delete: mark as deleted instead of actually deleting
    await Product.findByIdAndUpdate(productId, {
      isDeleted: true, // ✅ ADDED: Soft delete flag
      status: "Discont" // ✅ ADDED: Mark as discontinued
    });

    return res.redirect("/admin/products?success=Product+deleted+successfully"); // ✅ ADDED: Success message
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.redirect("/admin/pageerror");
  }
};

const toggleBlockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.redirect("/admin/products?error=Product+not+found");
    }

    product.isBlocked = !product.isBlocked;
    await product.save();

    return res.redirect("/admin/products");
  } catch (error) {
    console.error("Error toggling product block status:", error);
    return res.redirect("/admin/pageerror");
  }
};

const getEditProductPage = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).populate("category");
    const categories = await Category.find({ isListed: true });

    if (!product) {
      return res.redirect("/admin/products?error=Product+not+found");
    }

    const error = req.query.error || null;
    res.render("edit-product", { product, categories, error });
  } catch (error) {
    console.error("Error fetching product for edit:", error);
    return res.redirect("/admin/pageerror");
  }
};

const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const products = req.body;
    const product = await Product.findById(productId);

    if (!product) {
      return res.redirect("/admin/products?error=Product+not+found");
    }

    const existingImages = product.productImage || [];
    const validTypes = ['image/jpeg', 'image/png'];

    const newImages = [];
    const imageFields = ['image1', 'image2', 'image3', 'image4'];
    for (let i = 0; i < imageFields.length; i++) {
      const fieldName = imageFields[i];
      const files = req.files && req.files[fieldName];
      const file = files && files[0];

      if (file) {
        if (!validTypes.includes(file.mimetype)) {
          return res.redirect(`/admin/edit-product/${productId}?error=Only+JPG+or+PNG+files+are+allowed`);
        }

        const originalImagePath = file.path;
        const resizedImagePath = path.join(
          "public",
          "uploads",
          "product-images",
          "resized_" + file.filename
        );

        await sharp(originalImagePath)
          .resize({ width: 440, height: 440 })
          .toFile(resizedImagePath);

        newImages[i] = "resized_" + file.filename;

        // ✅ ADDED: Safely delete original uploaded file using helper function
        safeDeleteFile(originalImagePath, 1000);

        // ✅ ENHANCED: Safely delete old image if it exists and is not empty
        if (existingImages[i] && existingImages[i].trim() !== '') {
          const oldImagePath = path.join("public", "uploads", "product-images", existingImages[i]);
          // ✅ ADDED: Only delete if the old image file actually exists
          if (fs.existsSync(oldImagePath)) {
            safeDeleteFile(oldImagePath, 1500);
          }
        }
      }
    }

    // ✅ ADDED: Build the final image array, handling sparse arrays properly
    const finalImages = [];
    for (let i = 0; i < Math.max(existingImages.length, newImages.length, 4); i++) {
      if (newImages[i]) {
        finalImages[i] = newImages[i]; // ✅ ADDED: Use new image if available
      } else if (existingImages[i] && existingImages[i].trim() !== '') {
        finalImages[i] = existingImages[i]; // ✅ ADDED: Keep existing image if valid
      }
    }
    product.productImage = finalImages.filter(Boolean); // ✅ ADDED: Remove empty slots

    if (product.productImage.length < 3) {
      return res.redirect(`/admin/edit-product/${productId}?error=Product+must+have+at+least+3+images`);
    }

    const categoryId = await Category.findOne({ name: products.category });
    if (!categoryId) {
      return res.redirect(`/admin/edit-product/${productId}?error=Invalid+category+name`);
    }

    product.productName = products.productName;
    product.description = products.description;
    product.category = categoryId._id;
    product.regularPrice = products.regularPrice;
    product.salePrice = products.salePrice;
    product.quantity = products.quantity;

    await product.save();
    return res.redirect("/admin/products?success=Product+updated+successfully"); // ✅ ADDED: Success message
  } catch (error) {
    console.error("Error updating product:", error);
    return res.redirect(`/admin/edit-product/${req.params.id}?error=Update+failed`);
  }
};

// Get Returned Items for a Product
const getProductReturnedItems = async (req, res) => {
  try {
    const productId = req.params.productId;
    const Order = require("../../models/orderSchema");
    const mongoose = require('mongoose');

    // Find all returned items for this product
    const returnedItems = await Order.aggregate([
      { $unwind: '$orderedItems' },
      {
        $match: {
          'orderedItems.product': new mongoose.Types.ObjectId(productId),
          'orderedItems.status': 'Returned'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          orderId: 1,
          customerName: '$user.name',
          customerEmail: '$user.email',
          customerPhone: '$user.phone',
          quantity: '$orderedItems.quantity',
          price: '$orderedItems.price',
          refundAmount: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] },
          returnReason: '$orderedItems.returnReason',
          adminResponse: '$orderedItems.adminResponse',
          returnDate: '$orderedItems.updatedAt',
          orderDate: '$createdOn'
        }
      },
      { $sort: { returnDate: -1 } }
    ]);

    // Calculate statistics
    const totalReturns = returnedItems.length;
    const totalRefundAmount = returnedItems.reduce((sum, item) => sum + item.refundAmount, 0);
    const totalQuantityReturned = returnedItems.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      success: true,
      returnedItems: returnedItems,
      statistics: {
        totalReturns: totalReturns,
        totalRefundAmount: totalRefundAmount,
        totalQuantityReturned: totalQuantityReturned
      }
    });
  } catch (error) {
    res.json({ success: false, message: 'Failed to fetch returned items' });
  }
};

module.exports = {
  getProductAddPage,
  addProducts,
  getProductList,
  deleteProduct,
  toggleBlockProduct,
  getEditProductPage,
  editProduct,
  getProductReturnedItems
};