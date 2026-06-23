# 🚀 Backend MongoDB Setup Guide

## Prerequisites

Before starting, ensure you have:
- Node.js installed
- MongoDB installed locally OR MongoDB Atlas account (cloud)
- npm packages installed in backend folder

## 1️⃣ Install Dependencies

```bash
cd "c:\Users\Gaurav\Desktop\Diyara Gems\backend"
npm install
```

If `npm install` fails, ensure you have a `package.json`. Create one if missing:

```bash
npm init -y
npm install express mongoose cors dotenv
```

## 2️⃣ MongoDB Setup Options

### Option A: Local MongoDB (Recommended for Development)

**Install MongoDB:**
- Download from: https://www.mongodb.com/try/download/community
- Run the installer and follow setup
- MongoDB will run on `mongodb://localhost:27017`

**Verify MongoDB is running:**
```bash
mongosh
# Should connect to MongoDB shell
exit
```

### Option B: MongoDB Atlas (Cloud)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create a cluster
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/dbname`

## 3️⃣ Create .env File

Create file: `c:\Users\Gaurav\Desktop\Diyara Gems\backend\.env`

**For Local MongoDB:**
```
PORT=3000
MONGO_URI=mongodb://localhost:27017/diara_gems
NODE_ENV=development
```

**For MongoDB Atlas:**
```
PORT=3000
MONGO_URI=mongodb+srv://username:password@cluster-name.mongodb.net/diara_gems?retryWrites=true&w=majority
NODE_ENV=development
```

## 4️⃣ Verify Backend Structure

Your backend folder should look like this:

```
backend/
├── models/
│   ├── Customer.js
│   ├── Inventory.js        ✅ Already exists
│   ├── Notification.js
│   ├── Order.js
│   ├── Sale.js
│   ├── StockMovement.js    ✅ NEW - Created for tracking
│   ├── Transaction.js
│   └── User.js
├── routes/
│   ├── customers.js
│   ├── dashboard.js
│   ├── inventory.js         ✅ UPDATED - Now records movements
│   ├── movements.js         ✅ NEW - Stock tracking API
│   ├── orders.js
│   ├── sales.js
│   ├── transactions.js
│   └── users.js
├── server.js                ✅ UPDATED - Added movements route
├── package.json
├── .env                     ✅ CREATE THIS
└── STOCK_API_DOCS.md        ✅ NEW - API Documentation
```

## 5️⃣ Start the Server

```bash
# Navigate to backend folder
cd "c:\Users\Gaurav\Desktop\Diyara Gems\backend"

# Start server
node server.js
```

**Expected output:**
```
✅ MongoDB connected: mongodb://localhost:27017/diara_gems
✅ Default superadmin created
Server running on http://localhost:3000
```

If you see errors, check:
- MongoDB is running
- .env file has correct MONGO_URI
- Port 3000 is available

## 6️⃣ Test API Endpoints

### Test 1: Add New Stock (with inward movement)

```bash
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "stone": "Ruby",
    "colour": "Red",
    "shape": "Round",
    "size": "2.00MM",
    "plating": "Gold",
    "grade": "5A",
    "qty": 100,
    "pp": 50,
    "sp": 100,
    "supplier": "ABC Gems",
    "remarks": "First batch"
  }'
```

**Success Response:**
```json
{
  "item": {
    "_id": "66...",
    "qr": "GV-1001",
    "stone": "Ruby",
    "qty": 100,
    "createdAt": "2026-06-11T..."
  },
  "movement": {
    "_id": "67...",
    "type": "INWARD",
    "quantity": 100,
    "reason": "Purchase",
    "supplier": "ABC Gems"
  }
}
```

### Test 2: Get All Batches

```bash
curl http://localhost:3000/api/inventory
```

### Test 3: Record Sale (Outward)

```bash
# First, get a batch ID from Test 2 response
curl -X POST http://localhost:3000/api/movements/outward \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "66...",
    "qrCode": "GV-1001",
    "quantity": 25,
    "reason": "Sale",
    "referenceId": "SALE-001",
    "remarks": "Sold to customer"
  }'
```

### Test 4: Get Movement History

```bash
curl http://localhost:3000/api/movements/history/66...
```

### Test 5: Get Movement Summary

```bash
curl "http://localhost:3000/api/movements/summary?startDate=2026-06-01&endDate=2026-06-30"
```

## 7️⃣ MongoDB Commands (Using mongosh)

```bash
# Connect to MongoDB
mongosh

# Use the database
use diara_gems

# View all inventory
db.inventories.find()

# View all stock movements
db.stockmovements.find()

# Get inward movements only
db.stockmovements.find({ type: "INWARD" })

# Get outward movements only
db.stockmovements.find({ type: "OUTWARD" })

# Count total entries
db.inventories.countDocuments()
db.stockmovements.countDocuments()

# Exit
exit
```

## 8️⃣ Frontend Integration (stock.html)

Add this to your frontend to use the new API:

```javascript
// Record inward stock entry
async function recordInwardStock(batchId, qrCode, quantity, supplier) {
  const response = await fetch('/api/movements/inward', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batchId,
      qrCode,
      quantity,
      supplier,
      remarks: 'Manual entry',
      createdBy: loggedInUser
    })
  });
  const data = await response.json();
  if (response.ok) {
    console.log('✅ Inward entry recorded:', data);
    return data;
  } else {
    console.error('❌ Error:', data.error);
    return null;
  }
}

// Record outward stock (sale)
async function recordOutwardStock(batchId, qrCode, quantity, reason, referenceId) {
  const response = await fetch('/api/movements/outward', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batchId,
      qrCode,
      quantity,
      reason,
      referenceId,
      createdBy: loggedInUser
    })
  });
  const data = await response.json();
  if (response.ok) {
    console.log('✅ Outward entry recorded:', data);
    return data;
  } else {
    console.error('❌ Error:', data.error);
    return null;
  }
}

// Get movement history for a batch
async function getMovementHistory(batchId) {
  const response = await fetch(`/api/movements/history/${batchId}`);
  const movements = await response.json();
  return movements;
}
```

## 9️⃣ Troubleshooting

### ❌ MongoDB Connection Error
**Problem:** `MongoServerError: connect ECONNREFUSED`
- **Solution:** Start MongoDB service or check Atlas credentials in .env

### ❌ Port 3000 Already in Use
**Problem:** `EADDRINUSE: address already in use :::3000`
- **Solution:** Change PORT in .env or kill process using port 3000

### ❌ Missing Dependencies
**Problem:** `Cannot find module 'mongoose'`
- **Solution:** Run `npm install` in backend folder

### ❌ Batch Not Found
**Problem:** API returns `Batch not found`
- **Solution:** Ensure batchId is correct 24-character MongoDB ObjectId

### ❌ Insufficient Quantity
**Problem:** Cannot record outward movement
- **Solution:** Check current quantity - requested quantity exceeds available

## 🔟 Database Backups

### Backup Local MongoDB
```bash
mongodump --db diara_gems --out /path/to/backup
```

### Restore from Backup
```bash
mongorestore --db diara_gems /path/to/backup/diara_gems
```

### Atlas Backups
- Automatic backups every 12 hours (free tier)
- Snapshots available in Atlas dashboard

## ✅ Quick Checklist

- [ ] Node.js installed
- [ ] MongoDB installed or Atlas account created
- [ ] .env file created with MONGO_URI
- [ ] `npm install` completed
- [ ] Server starts with `node server.js`
- [ ] API endpoints respond to test requests
- [ ] MongoDB stores data in Collections

## 📞 Support

If you encounter issues:
1. Check MongoDB is running: `mongosh`
2. Verify .env file exists and MONGO_URI is correct
3. Check server console for error messages
4. Run API tests with curl/Postman
5. Check MongoDB collections with mongosh

