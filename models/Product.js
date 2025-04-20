
// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // Link to the lowest level category
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  // For bulbs, switches, etc.
  type: {
    type: String,
    required: true
  },
  // For product variations (wattage, color, size)
  specifications: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  brand: {
    type: String,
    required: true
  },
  price: {
    purchasePrice: {
      type: Number,
      required: true
    },
    sellingPrice: {
      type: Number,
      required: true
    }
  },
  stock: {
    quantity: {
      type: Number,
      default: 0
    },
    minThreshold: {
      type: Number,
      default: 5
    },
    location: {
      type: String,
      trim: true
    }
  },
  supplier: {
    name: {
      type: String,
      trim: true
    },
    contactInfo: {
      type: String,
      trim: true
    }
  },
  // Track stock changes
  stockHistory: [{
    quantity: Number,
    type: {
      type: String,
      enum: ['in', 'out', 'adjustment']
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  images: [{
    type: String // URL or file path
  }]
}, { 
  timestamps: true 
});

// Index for efficient searches
productSchema.index({ name: 'text', description: 'text', sku: 'text', brand: 'text' });

// Middleware to update category aggregates when product is updated
productSchema.pre('save', async function(next) {
  if (this.isModified('stock.quantity') || this.isModified('price.sellingPrice') || this.isNew) {
    // Will be implemented in a separate function to update all parent categories
    // This ensures rolling up quantity changes to all parent categories
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
