// controllers/productController.js - Product controller
const Product = require('../models/Product');
const Category = require('../models/Category');
const { updateCategoryAggregates } = require('./categoryController'); // Import the function


const productController = {
  // Get all products
  getAllProducts: async (req, res) => {
    try {
      const { search, brand, category, minPrice, maxPrice, inStock } = req.query;
      
      // Build filter
      const filter = {};
      
      if (search) {
        filter.$text = { $search: search };
      }
      
      if (brand) {
        filter.brand = brand;
      }
      
      if (category) {
        // Find all subcategories of the given category
        const subcategories = await Category.find({ path: category });
        const categoryIds = [category, ...subcategories.map(cat => cat._id)];
        filter.category = { $in: categoryIds };
      }
      
      if (minPrice || maxPrice) {
        filter['price.sellingPrice'] = {};
        if (minPrice) filter['price.sellingPrice'].$gte = parseFloat(minPrice);
        if (maxPrice) filter['price.sellingPrice'].$lte = parseFloat(maxPrice);
      }
      
      if (inStock === 'true') {
        filter['stock.quantity'] = { $gt: 0 };
      }
      
      const products = await Product.find(filter)
        .populate('category', 'name path')
        .sort({ createdAt: -1 });
      
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  
  // Get single product
  getProductById: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id)
        .populate('category', 'name path');
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  
  // Create new product
  createProduct: async (req, res) => {
    try {
      const {
        name,
        description,
        sku,
        category,
        type,
        specifications,
        brand,
        price,
        stock,
        supplier,
        images
      } = req.body;
      
      // Check if category exists
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({ message: 'Category not found' });
      }
      const hasChildren = await Category.exists({ parent: category });
      if (hasChildren) {
        return res.status(400).json({ message: 'Products can only be added to leaf categories (categories with no subcategories).' });
      }
  
      // Check if SKU is unique
      const skuExists = await Product.findOne({ sku });
      if (skuExists) {
        return res.status(400).json({ message: 'SKU already exists' });
      }
      
      const product = new Product({
        name,
        description,
        sku,
        category,
        type,
        specifications,
        brand,
        price,
        stock,
        supplier,
        images
      });
      
      const savedProduct = await product.save();
      
      // Update category aggregates
      await updateCategoryAggregates(category);
      
      res.status(201).json(savedProduct);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  
  // Update product
  updateProduct: async (req, res) => {
    try {
      const {
        name,
        description,
        sku,
        category,
        type,
        specifications,
        brand,
        price,
        stock,
        supplier,
        images,
        isActive
      } = req.body;
      
      const product = await Product.findById(req.params.id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      // If SKU is being changed, check if new SKU is unique
      if (sku && sku !== product.sku) {
        const skuExists = await Product.findOne({ sku });
        if (skuExists) {
          return res.status(400).json({ message: 'SKU already exists' });
        }
      }
      if (category && category.toString() !== product.category.toString()) {
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
          return res.status(400).json({ message: 'Category not found' });
        }
  
        // Check if the new category is a leaf category
        const hasChildren = await Category.exists({ parent: category });
        if (hasChildren) {
          return res.status(400).json({ message: 'Products can only be associated with leaf categories (categories with no subcategories).' });
        }
      }
  
      // If SKU is being changed, check if new SKU is unique
      if (sku && sku !== product.sku) {
        const skuExists = await Product.findOne({ sku });
        if (skuExists) {
          return res.status(400).json({ message: 'SKU already exists' });
        }
      }
      // Record stock change in history if quantity changes
      if (stock && stock.quantity !== undefined && stock.quantity !== product.stock.quantity) {
        const changeType = stock.quantity > product.stock.quantity ? 'in' : 'out';
        const changeAmount = Math.abs(stock.quantity - product.stock.quantity);
        
        product.stockHistory.push({
          quantity: changeAmount,
          type: changeType,
          date: new Date(),
          notes: req.body.stockChangeNotes || 'Manual adjustment'
        });
      }
      
      const oldCategory = product.category;
      
      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        {
          name,
          description,
          sku,
          category,
          type,
          specifications,
          brand,
          price,
          stock,
          supplier,
          images,
          isActive,
          stockHistory: product.stockHistory
        },
        { new: true }
      );
      
      // Update category aggregates if category changed or stock changed
      if (category && category.toString() !== oldCategory.toString()) {
        await updateCategoryAggregates(oldCategory);
        await updateCategoryAggregates(category);
      } else if (stock && stock.quantity !== undefined) {
        await updateCategoryAggregates(oldCategory);
      }
      
      res.json(updatedProduct);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  
  // Delete product
  deleteProduct: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      const category = product.category;
      
      await Product.findByIdAndDelete(req.params.id);
      
      // Update category aggregates
      await updateCategoryAggregates(category);
      
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  
  // Update stock quantity
  updateStock: async (req, res) => {
    try {
      const { quantity, notes } = req.body;
      
      const product = await Product.findById(req.params.id);
      
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      const oldQuantity = product.stock.quantity;
      const changeType = quantity > oldQuantity ? 'in' : 'out';
      const changeAmount = Math.abs(quantity - oldQuantity);
      
      product.stock.quantity = quantity;
      product.stockHistory.push({
        quantity: changeAmount,
        type: changeType,
        date: new Date(),
        notes: notes || 'Stock adjustment'
      });
      
      await product.save();
      
      // Update category aggregates
      await updateCategoryAggregates(product.category);
      
      res.json(product);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
  searchProducts: async (req, res) => {
    try {
      const { query } = req.query;
      const products = await Product.find({
        $text: { $search: query },
      }).populate('category', 'name');
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};


module.exports = productController;