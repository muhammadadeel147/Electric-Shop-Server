const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// Routes for inventory transactions

// Get all inventory transactions
router.get('/', inventoryController.getAllTransactions);

// Get a single inventory transaction by ID
router.get('/:id', inventoryController.getTransactionById);

// Create a new inventory transaction
router.post('/', inventoryController.createTransaction);

// Delete an inventory transaction
router.delete('/:id', inventoryController.deleteTransaction);

module.exports = router;