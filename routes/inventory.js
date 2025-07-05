const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const  auth  = require('../middleware/auth');

// ========== PURCHASE ROUTES ==========
router.get('/purchases', auth, inventoryController.getAllPurchases);
router.get('/purchases/:id', auth, inventoryController.getPurchaseById);
router.post('/purchases', auth, inventoryController.createPurchase);
router.delete('/purchases/:id', auth, inventoryController.deletePurchase);

// ========== SALE ROUTES ==========
router.get('/sales', auth, inventoryController.getAllSales);
router.get('/sales/:id', auth, inventoryController.getSaleById);
router.post('/sales', auth, inventoryController.createSale);
router.delete('/sales/:id', auth, inventoryController.deleteSale);

// ========== RETURN ROUTES ==========
router.get('/returns', auth, inventoryController.getAllReturns);
router.get('/returns/:id', auth, inventoryController.getReturnById);
router.post('/returns', auth, inventoryController.createReturn);
router.delete('/returns/:id', auth, inventoryController.deleteReturn);

// ========== ADJUSTMENT ROUTES ==========
router.get('/adjustments', auth, inventoryController.getAllAdjustments);
router.get('/adjustments/:id', auth, inventoryController.getAdjustmentById);
router.post('/adjustments', auth, inventoryController.createAdjustment);
router.delete('/adjustments/:id', auth, inventoryController.deleteAdjustment);

// ========== ANALYTICS ROUTES ==========
router.get('/stats', auth, inventoryController.getTransactionStats);

module.exports = router;