// server.js - Backend API
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// In-memory database (you can later connect to a real database)
const products = {
  '8000500310427': { // Kinder Kinderini barcode example
    name: 'Kinder Kinderini 100g',
    priceUSD: 7.56,
    weight: '100g'
  },
  // Add more products here
};

app.get('/api/product/:barcode', (req, res) => {
  const barcode = req.params.barcode;
  const product = products[barcode];
  
  if (product) {
    const priceLBP = (product.priceUSD * 89500).toFixed(0);
    res.json({
      ...product,
      priceLBP: priceLBP,
      exchangeRate: 89500
    });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// Add product endpoint (for managing inventory)
app.post('/api/product', (req, res) => {
  const { barcode, name, priceUSD, weight } = req.body;
  products[barcode] = { name, priceUSD, weight };
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
