require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler'); // Import the error handler

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(express.json({ extended: false }));
app.use(cors());

// Define routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/category')); // Add this line
app.use('/api/products', require('./routes/product')); // Add this line
app.use('/api/inventory', require('./routes/inventory')); // Add this line

app.use(errorHandler);
// Base route
app.get('/', (req, res) => {
  res.json({ msg: 'Welcome to Electric Shop API' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));   