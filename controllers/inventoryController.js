const InventoryTransaction = require('../models/Inventory');
const Product = require('../models/Product');
const { updateCategoryAggregates } = require('./categoryController'); // Import for updating category aggregates
const mongoose = require('mongoose');
const inventoryController = {
  // Get all inventory transactions
  getAllTransactions: async (req, res) => {
    try {
      const transactions = await InventoryTransaction.find()
        .populate('products.product', 'name')
        .populate('createdBy', 'name');
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get a single inventory transaction by ID
  getTransactionById: async (req, res) => {
    try {
      const transaction = await InventoryTransaction.findById(req.params.id)
        .populate('products.product', 'name')
        .populate('createdBy', 'name');
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Create a new inventory transaction
  createTransaction: async (req, res) => {
    try {
      const { type, products, totalAmount, reference, notes, createdBy } = req.body;

      // Validate products and update stock
      for (const item of products) {
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(400).json({ message: `Product with ID ${item.product} not found` });
        }

        // Update stock based on transaction type
     // Validate stock for sales or adjustments
     if ((type === 'sale' || type === 'adjustment') && product.stock.quantity < item.quantity) {
      return res.status(400).json({
        message: `Insufficient stock for product ${product.name}. Available: ${product.stock.quantity}, Requested: ${item.quantity}`,
      });
    }

    // Update stock based on transaction type
    if (type === 'purchase' || type === 'return') {
      product.stock.quantity += item.quantity;
    } else if (type === 'sale' || type === 'adjustment') {
      product.stock.quantity -= item.quantity;
    }

        await product.save();
        await updateCategoryAggregates(product.category); // Update category aggregates
      }

      // Create the inventory transaction
      const transaction = new InventoryTransaction({
        type,
        products,
        totalAmount,
        reference,
        notes,
        createdBy,
      });

      const savedTransaction = await transaction.save();
      res.status(201).json(savedTransaction);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Delete an inventory transaction
  deleteTransaction: async (req, res) => {
    const session = await mongoose.startSession(); // Start a session for the transaction
    session.startTransaction();
  
    try {
      const transaction = await InventoryTransaction.findById(req.params.id).session(session);
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }
  
      // Reverse stock changes if needed
      for (const item of transaction.products) {
        const product = await Product.findById(item.product).session(session);
        if (!product) continue;
  
        if (transaction.type === 'purchase' || transaction.type === 'return') {
          product.stock.quantity -= item.quantity; // Reverse purchase or return
        } else if (transaction.type === 'sale' || transaction.type === 'adjustment') {
          product.stock.quantity += item.quantity; // Reverse sale or adjustment
        }
  
        await product.save({ session }); // Save the updated stock within the transaction
        await updateCategoryAggregates(product.category); // Update category aggregates
      }
  
      // Delete the transaction
      await transaction.deleteOne({ session });
  
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
  
      res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
      // Abort the transaction in case of an error
      await session.abortTransaction();
      session.endSession();
  
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = inventoryController;