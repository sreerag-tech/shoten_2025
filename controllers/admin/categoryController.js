const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");




const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const categoryData = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
      search: search,
    });
  } catch (error) {
    console.error("Error in categoryInfo:", error);
    res.redirect("/pageerror");
  }
};



const addCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    // Case-insensitive search using regex
    const existingCategory = await Category.findOne({
      name: { $regex: `^${name}$`, $options: 'i' } // ^ and $ ensure exact match, 'i' makes it case-insensitive
    });

    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists (case-insensitive match)" });
    }

    // Optional: Normalize name to a standard case (e.g., capitalize first letter)
    const newCategory = new Category({
      name: name.trim(),
      description
    });

    await newCategory.save();
    res.status(200).json({ message: "Category added successfully" });

  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ error: "Server error while adding category" });
  }
};




const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const getUnlistCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findOne({ _id: id });
    res.render("edit-category", { category: category });
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};
const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

    // Validate input
    if (!categoryName) {
      return res.status(400).json({ error: "Category name is required" });
    }

    // Check for existing category with the same name (case-insensitive, excluding current category)
    const existingCategory = await Category.findOne({
      name: { $regex: `^${categoryName}$`, $options: 'i' },
      _id: { $ne: id }
    });

    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(id, {
      
      name: categoryName,
      description
    }, { new: true });

    if (!updatedCategory) {
      return res.status(404).json({ error: "Category not found" });
    }


    

    res.json({ message: "Category updated successfully", category: updatedCategory });

  } catch (error) {
    console.error("Error editing category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Delete all products associated with this category
    await Product.deleteMany({ category: categoryId });

    // Delete the category
    await Category.findByIdAndDelete(categoryId);

    // Send a JSON response
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);

    // Send a JSON error response
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  categoryInfo,
  addCategory,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
  deleteCategory,
};





