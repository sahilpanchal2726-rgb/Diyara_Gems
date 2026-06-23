
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const os = require('os');


const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/diara_gems';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.BASE_URL || '').replace(/\/$/, '');
const SAFE_MONGO_URI = MONGO_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');

// ── Middleware ──────────────────────────────────────────────
const allowedOrigins = [
  'https://diyaragems.com',
  'https://www.diyaragems.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://www.diyaragems.com'
];
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ── MongoDB Connection ──────────────────────────────────────
mongoose.set('strictQuery', true);

let retryCount = 0;
const MAX_RETRIES = 10;

function connectWithRetry() {
  mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: true
  })
    .then(() => {
      retryCount = 0;
      console.log('✅ MongoDB connected successfully');
      console.log('📍 MongoDB URI:', SAFE_MONGO_URI);
      console.log('📍 MongoDB host:', mongoose.connection.host);
    })
    .catch(err => {
      retryCount += 1;
      console.error(`❌ MongoDB connection failed (attempt ${retryCount}/${MAX_RETRIES})`);
      console.error('❌ Error message:', err.message);
      console.error('❌ MongoDB URI:', SAFE_MONGO_URI);

      if (retryCount <= MAX_RETRIES) {
        const delayMs = Math.min(30000, retryCount * 5000);
        console.warn(`🔁 Retrying MongoDB connection in ${delayMs / 1000} seconds...`);
        setTimeout(connectWithRetry, delayMs);
      } else {
        console.error('❌ MongoDB could not be reached after multiple retries. Check your DB URL and network access.');
      }
    });
}

connectWithRetry();

mongoose.connection.on('error', err => {
  console.error('⚠️ MongoDB runtime error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected');
});

// Ensure a default super user exists
try{
  const User = require('./models/User');
  mongoose.connection.once('open', async () => {
    try {
      const exists = await User.findOne({ username: 'superadmin' });
      if(!exists){
        await User.create({ username: 'superadmin', name: 'Super Admin', role: 'superadmin', email: 'admin@diyara.in', permissions: { all: true } });
        console.log('✅ Default superadmin created');
      }
    } catch (userErr) {
      console.error('❌ Failed to create default superadmin:', userErr.message);
    }
  });
}catch(e){/* ignore if models not ready yet */}

// ── Routes ─────────────────────────────────────────────────
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/movements', require('./routes/movements'));
app.use('/api/sales',     require('./routes/sales'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/users',     require('./routes/users'));
app.get('/api/host', (req, res) => {
  const origin = `${req.protocol}://${req.headers.host}`;
  const interfaces = os.networkInterfaces();
  const localIp = Object.values(interfaces)
    .flat()
    .find(addr => addr && addr.family === 'IPv4' && !addr.internal);
  const lanOrigin = localIp ? `http://${localIp.address}:${PORT}` : null;
  const publicOrigin = PUBLIC_BASE_URL || null;
  res.json({ origin, publicOrigin, lanOrigin, host: req.headers.host, port: PORT });
});

app.get('/item/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'item.html'));
});

// Health check
app.get('/', (req, res) => res.json({ status: 'Diara Gems Backend Running', time: new Date() }));

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port https://diyaragems.com`));