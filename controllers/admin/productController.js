const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    const error = req.query.error || null;
    res.render("product-add", { cat: category, error });
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
          const originalImagePath = req.files[i].path;
          const resizedImagePath = path.join(
            "public",
            "uploads",
            "product-images",
            "resized_" + req.files[i].filename
          );

          await sharp(originalImagePath)
            .resize({ width: 440, height: 440 })
            .toFile(resizedImagePath);

          images.push("resized_" + req.files[i].filename);

          try {
            await fs.promises.unlink(originalImagePath);
          } catch (unlinkError) {
            console.warn(`Failed to delete original image ${originalImagePath}: ${unlinkError.message}`);
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
      return res.redirect("/admin/add-products"); // Or redirect to a product list page

    } else {
      return res.redirect("/admin/add-products?error=Product+already+exists");
    }
  } catch (error) {
    console.error("Error saving product:", error);
    return res.redirect("/admin/pageerror");
  }
};
// Get Product List Page
const getProductList = async (req, res) => {
  try {
    const products = await Product.find().populate("category"); // Populate category details
    const error = req.query.error || null;
    res.render("products", { products, error });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.redirect("/admin/pageerror");
  }
};

// Delete Product
const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.redirect("/admin/products?error=Product+not+found");
    }

    // Delete associated images
    if (product.productImage && product.productImage.length > 0) {
      for (const image of product.productImage) {
        const imagePath = path.join("public", "uploads", "product-images", image);
        try {
          await fs.promises.unlink(imagePath);
        } catch (unlinkError) {
          console.warn(`Failed to delete image ${imagePath}: ${unlinkError.message}`);
        }
      }
    }

    await Product.findByIdAndDelete(productId);
    return res.redirect("/admin/products");
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.redirect("/admin/pageerror");
  }
};

// Toggle Block/Unblock Product
const toggleBlockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.redirect("/admin/products?error=Product+not+found");
    }

    product.isBlocked = !product.isBlocked; // Toggle the isBlocked status
    await product.save();

    return res.redirect("/admin/products");
  } catch (error) {
    console.error("Error toggling product block status:", error);
    return res.redirect("/admin/pageerror");
  }
};



// Get Edit Product Page
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

// Edit Product
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

    // Handle individual image updates
    const newImages = [];
    const imageFields = ['image1', 'image2', 'image3', 'image4'];
    for (let i = 0; i < imageFields.length; i++) {
      const fieldName = imageFields[i];
      const files = req.files && req.files[fieldName]; // Access field directly from object
      const file = files && files[0]; // Get the first (and only) file if it exists

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

        try {
          await fs.promises.unlink(originalImagePath);
        } catch (unlinkError) {
          console.warn(`Failed to delete original image ${originalImagePath}: ${unlinkError.message}`);
        }

        // Remove the old image at this index if it exists
        if (existingImages[i]) {
          const oldImagePath = path.join("public", "uploads", "product-images", existingImages[i]);
          try {
            await fs.promises.unlink(oldImagePath);
          } catch (unlinkError) {
            console.warn(`Failed to delete old image ${oldImagePath}: ${unlinkError.message}`);
          }
        }
      }
    }

    // Update product images array: replace only the updated indices
    product.productImage = existingImages.map((img, index) => newImages[index] || img).filter(Boolean);

    // Validate total image count
    if (product.productImage.length < 3) {
      return res.redirect(`/admin/edit-product/${productId}?error=Product+must+have+at+least+3+images`);
    }

    const categoryId = await Category.findOne({ name: products.category });
    if (!categoryId) {
      return res.redirect(`/admin/edit-product/${productId}?error=Invalid+category+name`);
    }

    // Update product fields
    product.productName = products.productName;
    product.description = products.description;
    product.category = categoryId._id;
    product.regularPrice = products.regularPrice;
    product.salePrice = products.salePrice;
    product.quantity = products.quantity;

    await product.save();
    return res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    return res.redirect(`/admin/edit-product/${req.params.id}?error=Update+failed`);
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
};
