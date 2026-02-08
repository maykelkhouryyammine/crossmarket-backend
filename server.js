const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection String
// You can also set this in Render environment variables as MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://maykelyammine_db_user:970Ronaldo7cr7@cluster0.6of586y.mongodb.net/crossmarket?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  console.log('⚠️  Check your connection string in environment variables');
});

// Product Schema
const productSchema = new mongoose.Schema({
  barcode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  priceUSD: {
    type: Number,
    required: true,
    min: 0,
  },
  weight: {
    type: String,
    default: '',
  },
  exchangeRate: {
    type: Number,
    default: 89500,
  },
  priceLBP: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Calculate LBP price before saving
productSchema.pre('save', function(next) {
  this.priceLBP = this.priceUSD * this.exchangeRate;
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.model('Product', productSchema);

// API Routes

// 1. Health check
app.get('/health', async (req, res) => {
  try {
    const productsCount = await Product.countDocuments();
    res.json({ 
      status: 'ok', 
      message: 'Crossmarket Backend is running',
      productsCount: productsCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ 
      status: 'ok', 
      message: 'Server running but database not connected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 2. Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: products.length,
      exchangeRate: products.length > 0 ? products[0].exchangeRate : 89500,
      products: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

// 3. Get single product by barcode
app.get('/api/product/:barcode', async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode });
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    res.json({
      barcode: product.barcode,
      name: product.name,
      priceUSD: product.priceUSD,
      weight: product.weight,
      exchangeRate: product.exchangeRate,
      priceLBP: product.priceLBP,
      createdAt: product.createdAt
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error',
      message: error.message
    });
  }
});

// 4. Add new product
app.post('/api/product', async (req, res) => {
  try {
    const { barcode, name, priceUSD, weight, exchangeRate } = req.body;
    
    // Validation
    if (!barcode || !name || !priceUSD) {
      return res.status(400).json({ 
        success: false, 
        error: 'Barcode, name, and priceUSD are required' 
      });
    }
    
    // Check if product already exists
    const existingProduct = await Product.findOne({ barcode });
    if (existingProduct) {
      return res.status(400).json({ 
        success: false, 
        error: 'Product with this barcode already exists' 
      });
    }
    
    // Create new product
    const product = new Product({
      barcode,
      name,
      priceUSD,
      weight: weight || '',
      exchangeRate: exchangeRate || 89500
    });
    
    await product.save();
    
    console.log('✅ Product added:', product.name);
    
    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      product: {
        barcode: product.barcode,
        name: product.name,
        priceUSD: product.priceUSD,
        weight: product.weight,
        exchangeRate: product.exchangeRate,
        priceLBP: product.priceLBP
      }
    });
    
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to add product' 
    });
  }
});

// 5. Update product
app.put('/api/product/:barcode', async (req, res) => {
  try {
    const { name, priceUSD, weight, exchangeRate } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (priceUSD) updateData.priceUSD = priceUSD;
    if (weight !== undefined) updateData.weight = weight;
    if (exchangeRate) updateData.exchangeRate = exchangeRate;
    updateData.updatedAt = Date.now();
    
    const product = await Product.findOneAndUpdate(
      { barcode: req.params.barcode },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    // Recalculate LBP price
    product.priceLBP = product.priceUSD * product.exchangeRate;
    await product.save();
    
    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });
    
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update product',
      message: error.message
    });
  }
});

// 6. Delete product
app.delete('/api/product/:barcode', async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ 
      barcode: req.params.barcode 
    });
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    console.log('🗑️ Product deleted:', product.name);
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete product',
      message: error.message
    });
  }
});

// 7. Update exchange rate for all products
app.post('/api/update-exchange-rate', async (req, res) => {
  try {
    const { exchangeRate } = req.body;
    
    if (!exchangeRate || exchangeRate <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid exchange rate is required' 
      });
    }
    
    // Update all products with new exchange rate
    const products = await Product.find();
    
    for (const product of products) {
      product.exchangeRate = exchangeRate;
      product.priceLBP = product.priceUSD * exchangeRate;
      product.updatedAt = Date.now();
      await product.save();
    }
    
    console.log(`💱 Exchange rate updated to ${exchangeRate} for ${products.length} products`);
    
    res.json({
      success: true,
      message: `Exchange rate updated to ${exchangeRate} for all products`,
      productsUpdated: products.length,
      newRate: exchangeRate
    });
    
  } catch (error) {
    console.error('Error updating exchange rate:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update exchange rate',
      message: error.message
    });
  }
});

// 8. Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Crossmarket Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      products: '/api/products',
      getProduct: '/api/product/:barcode',
      addProduct: 'POST /api/product',
      updateProduct: 'PUT /api/product/:barcode',
      deleteProduct: 'DELETE /api/product/:barcode',
      updateRate: 'POST /api/update-exchange-rate'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🛒 Products API: http://localhost:${PORT}/api/products`);
  console.log(`💾 Environment: ${process.env.NODE_ENV || 'development'}`);
});
