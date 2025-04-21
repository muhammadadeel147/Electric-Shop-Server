// backend/controllers/categoryController.js
const Category = require('../models/Category');
const Product = require('../models/Product');

// Helper function to update category aggregates
const updateCategoryAggregates = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) return;

  // Get all child categories
  const childCategories = await Category.find({ parent: categoryId });
  
  // Get direct products in this category
  const products = await Product.find({ category: categoryId });
  
  // Calculate direct product totals
  let directTotalProducts = products.length;
  let directTotalStockValue = products.reduce((sum, product) => {
    return sum + (product.stock.quantity * product.price.sellingPrice);
  }, 0);
  
  // Add totals from child categories
  let totalProducts = directTotalProducts;
  let totalStockValue = directTotalStockValue;
  
  for (const child of childCategories) {
    totalProducts += child.totalProducts || 0;
    totalStockValue += child.totalStockValue || 0;
  }
  
  // Update this category
  await Category.findByIdAndUpdate(categoryId, {
    totalProducts,
    totalStockValue
  });
  
  // If this category has a parent, update up the chain
  if (category.parent) {
    await updateCategoryAggregates(category.parent);
  }
};

// Controller methods
const categoryController = {
  // Get all categories with hierarchy
  getAllCategories: async (req, res, next) => {
    try {
      const topCategories = await Category.find({ parent: null }).populate({
        path: 'children',
        populate: {
          path: 'children',
          populate: {
            path: 'children',
          },
        },
      });

      res.json(topCategories);
    } catch (error) {
      next(error); // Pass the error to the centralized error handler
    }
  },
  
  // Get single category with its children
  getCategoryById: async (req, res,next) => {
    try {
      const category = await Category.findById(req.params.id)
        .populate({
          path: 'children',
          populate: {
            path: 'children'
          }
        });
      
      if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        return next(error);
      }
      
      res.json(category);
    } catch (error) {
      next(error);
    }
  },
  
  // Create new category
  // Create new category
createCategory: async (req, res, next) => {
  try {
    const { name, description, parent } = req.body;

    // If a parent category is specified, validate it
    if (parent) {
      const parentCategory = await Category.findById(parent);

      if (!parentCategory) {
        const error = new Error('Parent category not found');
        error.statusCode = 404;
        return next(error);
      }

      // Check if the parent category has products
      const hasProducts = await Product.exists({ category: parent });
      if (hasProducts) {
        const error = new Error(
          'Cannot create a subcategory for a category that already has products. Products can only belong to leaf categories.'
        );
        error.statusCode = 400;
        return next(error);
      }
    }

    // Create the new category
    const category = new Category({
      name,
      description,
      parent,
    });

    const savedCategory = await category.save();

    // Update parent aggregates if needed
    if (parent) {
      await updateCategoryAggregates(parent);
    }

    res.status(201).json(savedCategory);
  } catch (error) {
    next(error);
  }
},
  
  // Update category
  updateCategory: async (req, res,next) => {
    try {
      const { name, description, parent, isActive } = req.body;
      const oldCategory = await Category.findById(req.params.id);
      
      if (!oldCategory) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        return next(error);
      }
      
      const oldParent = oldCategory.parent;
      
      const updatedCategory = await Category.findByIdAndUpdate(
        req.params.id,
        { name, description, parent, isActive },
        { new: true }
      );
      
      // If parent changed, update aggregates for both old and new parent chains
      if (parent !== oldParent) {
        if (oldParent) await updateCategoryAggregates(oldParent);
        if (parent) await updateCategoryAggregates(parent);
      }
      
      res.json(updatedCategory);
    } catch (error) {
      next(error);
    }
  },
  
  // Delete category
  deleteCategory: async (req, res,next) => {
    try {
      const category = await Category.findById(req.params.id);
      
      if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        return next(error);
      }
      
      // Check if category has children
      const hasChildren = await Category.exists({ parent: req.params.id });
      if (hasChildren) {
        const error = new Error(
          'Cannot delete category with subcategories. Delete subcategories first.'
        );
        error.statusCode = 400;
        return next(error);
      }
      // Check if category has products
      const hasProducts = await Product.exists({ category: req.params.id });
      if (hasProducts) {
        const error = new Error(
          'Cannot delete category with products. Move or delete products first.'
        );
        error.statusCode = 400;
        return next(error);
      }
      
      const parent = category.parent;
      
      await Category.findByIdAndDelete(req.params.id);
      
      // Update parent aggregates
      if (parent) {
        await updateCategoryAggregates(parent);
      }
      
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
  
  // Get products in a category
  getCategoryProducts: async (req, res,next) => {
    try {
      const category = await Category.findById(req.params.id);
      
     
      if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        return next(error);
      }
      // Find all subcategories at any level
      const subcategoryIds = [req.params.id];
      const findAllSubcategories = async (parentId) => {
        const children = await Category.find({ parent: parentId });
        for (const child of children) {
          subcategoryIds.push(child._id);
          await findAllSubcategories(child._id);
        }
      };
      
      await findAllSubcategories(req.params.id);
      
      // Find products in this category and all subcategories
      const products = await Product.find({ category: { $in: subcategoryIds } });
  
      res.json(products);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = {categoryController,updateCategoryAggregates};