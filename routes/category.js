const express = require('express');
const router = express.Router();
const {categoryController} = require('../controllers/categoryController');

// Routes for categories

// Get all categories with hierarchy
router.get('/', categoryController.getAllCategories);

// Get a single category by ID with its children
router.get('/:id', categoryController.getCategoryById);

// Create a new category
router.post('/', categoryController.createCategory);

// Update an existing category
router.put('/:id', categoryController.updateCategory);

// Delete a category
router.delete('/:id', categoryController.deleteCategory);

// Get all products in a category (including subcategories)
router.get('/:id/products', categoryController.getCategoryProducts);

module.exports = router;