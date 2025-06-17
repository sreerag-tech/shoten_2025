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
      : {};//If search is empty or not given, use an empty query, meaning no filtering — fetch all data.

    const categoryData = await Category.find(query)//Searches for all categories that match your query object.Example query: { isActive: true } — only fetches active categories.
      .sort({ createdAt: -1 })// used for pagination
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit);


    //this is the datas controllers pass to ejs
    res.render("category", {
      cat: categoryData,//Sends the category data (categoryData) to the template using the variable name cat.
      currentPage: page,//Sends the current page number so the UI knows which page is active.
      totalPages: totalPages,
      totalCategories: totalCategories,
      search: search,
    });
  } catch (error) {
    console.error("Error in categoryInfo:", error);
    res.redirect("/pageerror");
  }
};


//post request to add category
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



//get method becuase it reas query unlike post post sends data to server directly not in url like get it is connected to ejs both post and gets are
const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("/pageerror");
  }
};//This function unlists (hides) a category in your admin panel by setting its isListed field to false, based on the category's _id.



const getUnlistCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("/pageerror");
  }
};

//getEditCategory is not part of the form — it's what renders the form.check route u will understand
const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findOne({ _id: id });

    res.render("edit-category", { category: category });//Loads the edit-category.ejs template (or any view engine you use).
//Passes the fetched category object to the view so it can display its data in the form.
  } catch (error) {
    res.redirect("/admin/pageerror");
  }
};


//post method check in ejs, use of params and query check in chat gpt u will understand
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
      _id: { $ne: id }//excludes the current category being edited
//Why: To prevent two categories having the same name (e.g., "Ring" and "ring").
    });

    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    } // Update category
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


// const deleteCategory = async (req, res) => {
//   try {
//     const categoryId = req.params.id;

//     // Delete all products associated with this category
//     await Product.deleteMany({ category: categoryId });

//     // Delete the category
//     await Category.findByIdAndDelete(categoryId);

//     // Send a JSON response
//     res.status(200).json({ message: "Category deleted successfully" });
//   } catch (error) {
//     console.error("Error deleting category:", error);

//     // Send a JSON error response
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

module.exports = {
  categoryInfo,
  addCategory,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
  // deleteCategory,
};





