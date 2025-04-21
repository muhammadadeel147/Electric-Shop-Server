const InventoryTransaction = require('../models/Inventory');
const Product = require('../models/Product');
const { updateCategoryAggregates } = require('./categoryController'); // Import for updating category aggregates
const mongoose = require('mongoose');
const inventoryController = {
  // Get all inventory transactions
  getAllTransactions: async (req, res, next) => {
    try {
      const transactions = await InventoryTransaction.find()
        .populate('products.product', 'name')
        .populate('createdBy', 'name');
      res.json(transactions);
    } catch (error) {
      next(error); 
    }
  },

  // Get a single inventory transaction by ID
  getTransactionById: async (req, res, next) => {
    try {
      const transaction = await InventoryTransaction.findById(req.params.id)
        .populate('products.product', 'name')
        .populate('createdBy', 'name');
        if (!transaction) {
          const error = new Error('Transaction not found');
          error.statusCode = 404;
          return next(error);
        }
      res.json(transaction);
    } catch (error) {
      next(error);
    }
  },

  // Create a new inventory transaction
  createTransaction: async (req, res, next) => {
    try {
      const { type, products, totalAmount, reference, notes, createdBy } = req.body;

      // Validate products and update stock
      for (const item of products) {
        const product = await Product.findById(item.product);
        if (!product) {
          const error = new Error(`Product with ID ${item.product} not found`);
          error.statusCode = 400;
          return next(error);
        }

        // Update stock based on transaction type
     // Validate stock for sales or adjustments
     if ((type === 'sale' || type === 'adjustment') && product.stock.quantity < item.quantity) {
      const error = new Error(
        `Insufficient stock for product ${product.name}. Available: ${product.stock.quantity}, Requested: ${item.quantity}`
      );
      error.statusCode = 400;
      return next(error);
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
      next(error); 
    }
  },

  // Delete an inventory transaction
  deleteTransaction: async (req, res, next) => {
    const session = await mongoose.startSession(); // Start a session for the transaction
    session.startTransaction();
  
    try {
      const transaction = await InventoryTransaction.findById(req.params.id).session(session);
      if (!transaction) {
        const error = new Error('Transaction not found');
        error.statusCode = 404;
        return next(error);
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
  
      next(error);
    }
  },
};

module.exports = inventoryController;