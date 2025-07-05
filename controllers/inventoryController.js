const InventoryTransaction = require('../models/Inventory');
const Product = require('../models/Product');
const { updateCategoryAggregates } = require('./categoryController');
const mongoose = require('mongoose');

// ========== COMMON FUNCTIONS ==========

// Get transaction by ID (common function)
const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await InventoryTransaction.findById(req.params.id)
      .populate('products.product', 'name sku price')
      .populate('createdBy', 'name');
      
    if (!transaction) {
      const error = new Error('Transaction not found');
      error.statusCode = 404;
      return next(error);
    }
    
    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    next(error);
  }
};

// Delete transaction (common function)
const deleteTransaction = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await InventoryTransaction.findById(req.params.id).session(session);
    if (!transaction) {
      const error = new Error('Transaction not found');
      error.statusCode = 404;
      await session.abortTransaction();
      session.endSession();
      return next(error);
    }
    
    // Reverse stock changes
    for (const item of transaction.products) {
      const product = await Product.findById(item.product).session(session);
      if (!product) continue;

      if (transaction.type === 'purchase' || transaction.type === 'return') {
        product.stock.quantity -= item.quantity; // Reverse purchase or return
      } else if (transaction.type === 'sale' || transaction.type === 'adjustment') {
        product.stock.quantity += item.quantity; // Reverse sale or adjustment
      }

      // Add reversal entry to stock history
      product.stockHistory = product.stockHistory || [];
      product.stockHistory.push({
        quantity: item.quantity,
        type: transaction.type === 'purchase' || transaction.type === 'return' ? 'out' : 'in',
        date: new Date(),
        notes: `Reversal of ${transaction.type} transaction #${transaction._id}`,
        reference: `reversal-${transaction._id}`
      });

      await product.save({ session });
      await updateCategoryAggregates(product.category);
    }

    await transaction.deleteOne({ session });
    await session.commitTransaction();
    session.endSession();

    res.json({ 
      success: true,
      message: 'Transaction deleted successfully' 
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

const inventoryController = {
  // ========== PURCHASES ==========
  
  // Get all purchase transactions
  getAllPurchases: async (req, res, next) => {
    try {
      const { startDate, endDate, supplier } = req.query;
      
      // Build filter
      const filter = { type: 'purchase' };
      
      // Add date range if provided
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      // Add supplier filter if provided
      if (supplier) {
        filter.notes = { $regex: supplier, $options: 'i' };
      }
      
      const purchases = await InventoryTransaction.find(filter)
        .populate('products.product', 'name sku')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });
      
      // Calculate total purchase value
      const totalValue = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
      
      res.json({
        success: true,
        count: purchases.length,
        totalValue,
        purchases
      });
    } catch (error) {
      next(error);
    }
  },
  
  // Get purchase by ID
  getPurchaseById: getTransactionById,
  
  // Create purchase
  createPurchase: async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { products, totalAmount, reference, notes, createdBy } = req.body;
      
      if (!products || !Array.isArray(products) || products.length === 0) {
        const error = new Error('Products are required and must be an array');
        error.statusCode = 400;
        return next(error);
      }
      
      // Process each product
      for (const item of products) {
        const product = await Product.findById(item.product).session(session);
        
        if (!product) {
          const error = new Error(`Product with ID ${item.product} not found`);
          error.statusCode = 400;
          await session.abortTransaction();
          session.endSession();
          return next(error);
        }
        
        // Update stock - INCREASE for purchases
        product.stock.quantity += item.quantity;
        
        // Initialize stockHistory if it doesn't exist
        product.stockHistory = product.stockHistory || [];
        
        // Add entry to stock history
        product.stockHistory.push({
          quantity: item.quantity,
          type: 'in',
          date: new Date(),
          notes: notes || 'Purchase transaction',
          reference: reference || `PO-${Date.now()}`
        });
        
        await product.save({ session });
        await updateCategoryAggregates(product.category);
      }
      
      // Create the purchase transaction record
      const transaction = new InventoryTransaction({
        type: 'purchase',
        products,
        totalAmount,
        reference: reference || `PO-${Date.now()}`,
        notes,
        createdBy
      });
      
      const savedTransaction = await transaction.save({ session });
      
      await session.commitTransaction();
      session.endSession();
      
      res.status(201).json({
        success: true,
        message: 'Purchase transaction created successfully',
        transaction: savedTransaction
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  },
  
  // Delete purchase
  deletePurchase: deleteTransaction,
  
  // ========== SALES ==========
  
  // Get all sale transactions
  getAllSales: async (req, res, next) => {
    try {
      const { startDate, endDate, customer } = req.query;
      
      // Build filter
      const filter = { type: 'sale' };
      
      // Add date range if provided
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      // Add customer filter if provided
      if (customer) {
        filter.notes = { $regex: customer, $options: 'i' };
      }
      
      const sales = await InventoryTransaction.find(filter)
        .populate('products.product', 'name sku')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });
      
      // Calculate total sales value
      const totalValue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
      
      res.json({
        success: true,
        count: sales.length,
        totalValue,
        sales
      });
    } catch (error) {
      next(error);
    }
  },
  
  // Get sale by ID
  getSaleById: getTransactionById,
  
  // Create sale
  createSale: async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { products, totalAmount, reference, notes, createdBy } = req.body;
      
      if (!products || !Array.isArray(products) || products.length === 0) {
        const error = new Error('Products are required and must be an array');
        error.statusCode = 400;
        return next(error);
      }
      
      // First, check if all products have sufficient stock
      for (const item of products) {
        const product = await Product.findById(item.product).session(session);
        
        if (!product) {
          const error = new Error(`Product with ID ${item.product} not found`);
          error.statusCode = 400;
          await session.abortTransaction();
          session.endSession();
          return next(error);
        }
        
        if (product.stock.quantity < item.quantity) {
          const error = new Error(
            `Insufficient stock for product ${product.name}. Available: ${product.stock.quantity}, Requested: ${item.quantity}`
          );
          error.statusCode = 400;
          await session.abortTransaction();
          session.endSession();
          return next(error);
        }
      }
      
      // All products have sufficient stock, proceed with the sale
      for (const item of products) {
        const product = await Product.findById(item.product).session(session);
        
        // Update stock - DECREASE for sales
        product.stock.quantity -= item.quantity;
        
        // Initialize stockHistory if it doesn't exist
        product.stockHistory = product.stockHistory || [];
        
        // Add entry to stock history
        product.stockHistory.push({
          quantity: item.quantity,
          type: 'out',
          date: new Date(),
          notes: notes || 'Sale transaction',
          reference: reference || `SO-${Date.now()}`
        });
        
        await product.save({ session });
        await updateCategoryAggregates(product.category);
      }
      
      // Create the sale transaction record
      const transaction = new InventoryTransaction({
        type: 'sale',
        products,
        totalAmount,
        reference: reference || `SO-${Date.now()}`,
        notes,
        createdBy
      });
      
      const savedTransaction = await transaction.save({ session });
      
      await session.commitTransaction();
      session.endSession();
      
      res.status(201).json({
        success: true,
        message: 'Sale transaction created successfully',
        transaction: savedTransaction
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  },
  
  // Delete sale
  deleteSale: deleteTransaction,
  
  // ========== RETURNS ==========
  
  // Get all return transactions
  getAllReturns: async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Build filter
      const filter = { type: 'return' };
      
      // Add date range if provided
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      const returns = await InventoryTransaction.find(filter)
        .populate('products.product', 'name sku')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });
      
      const totalValue = returns.reduce((sum, r) => sum + r.totalAmount, 0);
      
      res.json({
        success: true,
        count: returns.length,
        totalValue,
        returns
      });
    } catch (error) {
      next(error);
    }
  },
  
  // Get return by ID
  getReturnById: getTransactionById,
  
  // Create return
  createReturn: async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { products, totalAmount, reference, notes, createdBy } = req.body;
      
      if (!products || !Array.isArray(products) || products.length === 0) {
        const error = new Error('Products are required and must be an array');
        error.statusCode = 400;
        return next(error);
      }
      
      // Process each product
      for (const item of products) {
        const product = await Product.findById(item.product).session(session);
        
        if (!product) {
          const error = new Error(`Product with ID ${item.product} not found`);
          error.statusCode = 400;
          await session.abortTransaction();
          session.endSession();
          return next(error);
        }
        
        // Update stock - INCREASE for returns
        product.stock.quantity += item.quantity;
        
        // Initialize stockHistory if it doesn't exist
        product.stockHistory = product.stockHistory || [];
        
        // Add entry to stock history
        product.stockHistory.push({
          quantity: item.quantity,
          type: 'in',
          date: new Date(),
          notes: notes || 'Return transaction',
          reference: reference || `RT-${Date.now()}`
        });
        
        await product.save({ session });
        await updateCategoryAggregates(product.category);
      }
      
      // Create the return transaction record
      const transaction = new InventoryTransaction({
        type: 'return',
        products,
        totalAmount,
        reference: reference || `RT-${Date.now()}`,
        notes,
        createdBy
      });
      
      const savedTransaction = await transaction.save({ session });
      
      await session.commitTransaction();
      session.endSession();
      
      res.status(201).json({
        success: true,
        message: 'Return transaction created successfully',
        transaction: savedTransaction
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  },
  
  // Delete return
  deleteReturn: deleteTransaction,
  
  // ========== ADJUSTMENTS ==========
  
  // Get all adjustment transactions
  getAllAdjustments: async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Build filter
      const filter = { type: 'adjustment' };
      
      // Add date range if provided
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      const adjustments = await InventoryTransaction.find(filter)
        .populate('products.product', 'name sku')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });
      
      const totalValue = adjustments.reduce((sum, a) => sum + a.totalAmount, 0);
      
      res.json({
        success: true,
        count: adjustments.length,
        totalValue,
        adjustments
      });
    } catch (error) {
      next(error);
    }
  },
  
  // Get adjustment by ID
  getAdjustmentById: getTransactionById,
  
  // Create adjustment
  createAdjustment: async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { products, totalAmount, reference, notes, createdBy } = req.body;
      
      if (!products || !Array.isArray(products) || products.length === 0) {
        const error = new Error('Products are required and must be an array');
        error.statusCode = 400;
        return next(error);
      }
      
      // Validate products and update stock
      for (const item of products) {
        const product = await Product.findById(item.product).session(session);
        
        if (!product) {
          const error = new Error(`Product with ID ${item.product} not found`);
          error.statusCode = 400;
          await session.abortTransaction();
          session.endSession();
          return next(error);
        }
        
        // For negative adjustments, check if there's enough stock
        if (item.quantity < 0 && product.stock.quantity < Math.abs(item.quantity)) {
          const error = new Error(
            `Insufficient stock for product ${product.name}. Available: ${product.stock.quantity}, Adjustment: ${Math.abs(item.quantity)}`
          );
          error.statusCode = 400;
          await session.abortTransaction();
          session.endSession();
          return next(error);
        }
        
        // Update stock
        product.stock.quantity -= item.quantity;
        
        // Initialize stockHistory if it doesn't exist
        product.stockHistory = product.stockHistory || [];
        
        // Add entry to stock history
        product.stockHistory.push({
          quantity: Math.abs(item.quantity),
          type: item.quantity >= 0 ? 'out' : 'in',
          date: new Date(),
          notes: notes || 'Stock adjustment',
          reference: reference || `ADJ-${Date.now()}`
        });
        
        await product.save({ session });
        await updateCategoryAggregates(product.category);
      }
      
      // Create the adjustment transaction record
      const transaction = new InventoryTransaction({
        type: 'adjustment',
        products,
        totalAmount,
        reference: reference || `ADJ-${Date.now()}`,
        notes,
        createdBy
      });
      
      const savedTransaction = await transaction.save({ session });
      
      await session.commitTransaction();
      session.endSession();
      
      res.status(201).json({
        success: true,
        message: 'Adjustment transaction created successfully',
        transaction: savedTransaction
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  },
  
  // Delete adjustment
  deleteAdjustment: deleteTransaction,
  
  // ========== ANALYTICS ==========
  
  // Get transaction statistics
  getTransactionStats: async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Build date filter
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
      }
      
      // Get stats for each transaction type
      const purchaseStats = await InventoryTransaction.aggregate([
        { $match: { type: 'purchase', ...dateFilter } },
        { $group: { 
          _id: null,
          totalValue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }}
      ]);
      
      const saleStats = await InventoryTransaction.aggregate([
        { $match: { type: 'sale', ...dateFilter } },
        { $group: { 
          _id: null,
          totalValue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }}
      ]);
      
      const returnStats = await InventoryTransaction.aggregate([
        { $match: { type: 'return', ...dateFilter } },
        { $group: { 
          _id: null,
          totalValue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }}
      ]);
      
      const adjustmentStats = await InventoryTransaction.aggregate([
        { $match: { type: 'adjustment', ...dateFilter } },
        { $group: { 
          _id: null,
          totalValue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }}
      ]);
      
      res.json({
        success: true,
        stats: {
          purchases: purchaseStats[0] || { totalValue: 0, count: 0 },
          sales: saleStats[0] || { totalValue: 0, count: 0 },
          returns: returnStats[0] || { totalValue: 0, count: 0 },
          adjustments: adjustmentStats[0] || { totalValue: 0, count: 0 },
          profit: (saleStats[0]?.totalValue || 0) - 
                  (purchaseStats[0]?.totalValue || 0) + 
                  (returnStats[0]?.totalValue || 0)
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = inventoryController;