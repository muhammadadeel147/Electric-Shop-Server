const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Routes for products

// Get all products
router.get('/', productController.getAllProducts);

// Get a single product by ID
router.get('/:id', productController.getProductById);

// Create a new product
router.post('/', productController.createProduct);

// Update an existing product
router.put('/:id', productController.updateProduct);

// Delete a product
router.delete('/:id', productController.deleteProduct);

// Update stock quantity for a product
router.patch('/:id/stock', productController.updateStock);

// Search products by name, description, or SKU
router.get('/search', productController.searchProducts);

module.exports = router;