// backend/models/Category.js
const mongoose = require('mongoose');

// Support for multiple levels of categories
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Parent category reference (null for top-level categories)
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  // Track path for efficient querying of hierarchy
  path: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  level: {
    type: Number,
    default: 0 // 0 for top-level categories, increases with depth
  },
  // Calculated fields for aggregated totals
  totalProducts: {
    type: Number,
    default: 0
  },
  totalStockValue: {
    type: Number,
    default: 0
  },
  // For active/inactive categories
  isActive: {
    type: Boolean,
    default: true
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for child categories
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Middleware to update path when parent changes
categorySchema.pre('save', async function(next) {
  if (this.isModified('parent')) {
    if (!this.parent) {
      this.path = [];
      this.level = 0;
    } else {
      const parent = await this.constructor.findById(this.parent);
      if (!parent) return next(new Error('Parent category not found'));
      
      this.path = [...parent.path, parent._id];
      this.level = parent.level + 1;
    }
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
