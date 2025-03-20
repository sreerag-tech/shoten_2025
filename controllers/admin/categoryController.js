const Category = require("../../models/categorySchema");

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);
    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.error("Error in categoryInfo:", error);
    res.redirect("/pageerror");
  }
};

const addCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }
    const newCategory = new Category({
      name,
      description,
    });
    await newCategory.save();
    return res.json({ message: "Category added successfully" });
  } catch (error) {
    console.error("Error in addCategory:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
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
    const existingCategory = await Category.findOne({ 
      name: categoryName,
      _id: { $ne: id }
    });
    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: categoryName,
        description: description,
      },
      { new: true }
    );
    if (updateCategory) {
      res.redirect("/admin/category");
    } else {
      res.status(404).json({ error: "category not found" });
    }
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const deletedCategory = await Category.findByIdAndDelete(id);
    if (deletedCategory) {
      return res.json({ message: "Category deleted successfully" });
    } else {
      return res.status(404).json({ error: "Category not found" });
    }
  } catch (error) {
    console.error("Error in deleteCategory:", error);
    return res.status(500).json({ error: "Internal server error" });
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