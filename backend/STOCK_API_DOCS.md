# 📦 Stock Movement Tracking API Documentation

## Overview
The backend now has full inward/outward stock tracking with MongoDB. All stock movements are recorded with timestamps, reasons, and references.

## Base URLs
- Local: `http://localhost:3000/api`
- Production: `http://{your-domain}/api`

---

## 📥 INWARD STOCK ENTRIES (Purchases)

### Add New Stock Batch with Inward Entry
**POST** `/inventory`

Records a new inventory batch and automatically creates an INWARD movement record.

**Request Body:**
```json
{
  "stone": "Ruby",
  "colour": "Red",
  "shape": "Round",
  "size": "2.00MM",
  "plating": "Gold",
  "grade": "5A",
  "qty": 100,
  "pp": 50,
  "sp": 100,
  "supplier": "ABC Supplier",
  "remarks": "Good quality stones",
  "time": "10:30 AM",
  "date": "2026-06-11T10:30:00Z",
  "createdBy": "admin"
}
```

**Response:**
```json
{
  "item": {
    "_id": "66...",
    "qr": "GV-1001",
    "stone": "Ruby",
    "qty": 100,
    ...
  },
  "movement": {
    "_id": "67...",
    "type": "INWARD",
    "quantity": 100,
    "reason": "Purchase",
    "supplier": "ABC Supplier",
    ...
  }
}
```

### Record Inward Stock for Existing Batch
**POST** `/movements/inward`

**Request Body:**
```json
{
  "batchId": "66ce123456789abc",
  "qrCode": "GV-1001",
  "quantity": 50,
  "supplier": "XYZ Gems",
  "remarks": "Restock",
  "date": "2026-06-11T14:00:00Z",
  "createdBy": "manager"
}
```

**Response:**
```json
{
  "message": "Inward stock entry recorded",
  "movement": { ... },
  "batch": { ... }
}
```

---

## 📤 OUTWARD STOCK ENTRIES (Sales, Damage, Loss)

### Record Outward Stock
**POST** `/movements/outward`

Records stock removed for sale, damage, loss, or adjustment.

**Request Body:**
```json
{
  "batchId": "66ce123456789abc",
  "qrCode": "GV-1001",
  "quantity": 25,
  "reason": "Sale",
  "referenceId": "SALE-001",
  "remarks": "Sold to customer",
  "date": "2026-06-11T15:30:00Z",
  "createdBy": "admin"
}
```

**Reason Options:**
- `Sale` - Sold to customer
- `Damage` - Damaged stock
- `Loss` - Lost stock
- `Returned` - Customer returned
- `Adjusted` - Manual adjustment

**Response:**
```json
{
  "message": "Outward stock entry recorded",
  "movement": { ... },
  "batch": { ... }
}
```

### Update Inventory Quantity (with Movement)
**PATCH** `/inventory/:id/qty`

Updates quantity and automatically records a movement.

**Request Body:**
```json
{
  "qty": 75,
  "reason": "Sale",
  "referenceId": "INV-123",
  "remarks": "Sold 25 pieces",
  "date": "2026-06-11T16:00:00Z",
  "createdBy": "system"
}
```

---

## 📊 GET MOVEMENT HISTORY

### Get All Movements for a Batch
**GET** `/movements/history/:batchId`

Returns all inward/outward movements for a specific batch.

**Example:** `GET /movements/history/66ce123456789abc`

**Response:**
```json
[
  {
    "_id": "67...",
    "batchId": { "_id": "66...", "qr": "GV-1001", "stone": "Ruby" },
    "type": "INWARD",
    "quantity": 100,
    "reason": "Purchase",
    "supplier": "ABC Supplier",
    "date": "2026-06-11T10:30:00Z",
    "createdAt": "2026-06-11T10:30:15Z"
  },
  {
    "type": "OUTWARD",
    "quantity": 25,
    "reason": "Sale",
    "referenceId": "SALE-001",
    "date": "2026-06-11T15:30:00Z"
  }
]
```

### Get Movements by QR Code
**GET** `/movements/qr/:qrCode`

**Example:** `GET /movements/qr/GV-1001`

### Get All Inward Movements
**GET** `/movements/type/inward`

Returns all purchases recorded in the system.

### Get All Outward Movements
**GET** `/movements/type/outward`

Returns all sales, damages, and losses recorded.

### Get Movement Summary (Date Range)
**GET** `/movements/summary?startDate=2026-06-01&endDate=2026-06-30`

Returns total quantities for inward and outward movements.

**Response:**
```json
{
  "inward": {
    "total": 500,
    "count": 5
  },
  "outward": {
    "total": 150,
    "count": 12
  }
}
```

### Get Detailed Movement Report
**GET** `/movements/report`

Returns all movements with batch details.

---

## 🔄 BATCH INVENTORY OPERATIONS

### Get All Batches
**GET** `/inventory`

Returns all inventory batches with current quantities.

### Get Single Batch
**GET** `/inventory/:id` or **GET** `/inventory/qr/:qrCode`

### Get Stock Summary
**GET** `/inventory/summary`

Returns totals, by-stone breakdown, and low-stock alerts.

---

## 📱 Integration with Frontend (stock.html)

Update the frontend API calls to use the new endpoints:

```javascript
// Record inward stock entry
const recordInward = async (batchId, quantity, supplier, remarks) => {
  const res = await fetch('/api/movements/inward', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, qrCode: batch.qr, quantity, supplier, remarks })
  });
  return res.json();
};

// Record outward (sale)
const recordOutward = async (batchId, quantity, reason, referenceId) => {
  const res = await fetch('/api/movements/outward', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, qrCode: batch.qr, quantity, reason, referenceId })
  });
  return res.json();
};

// Get movement history
const getMovementHistory = async (batchId) => {
  const res = await fetch(`/api/movements/history/${batchId}`);
  return res.json();
};

// Get summary stats
const getMovementSummary = async (startDate, endDate) => {
  const res = await fetch(`/api/movements/summary?startDate=${startDate}&endDate=${endDate}`);
  return res.json();
};
```

---

## 🗄️ MongoDB Collections

### Inventory Collection
```
{
  _id: ObjectId,
  qr: String (unique),
  stone: String,
  colour: String,
  shape: String,
  size: String,
  plating: String,
  grade: String,
  qty: Number,
  originalQty: Number,
  pp: Number (purchase price),
  sp: Number (sell price),
  time: String,
  createdAt: DateTime,
  updatedAt: DateTime
}
```

### StockMovement Collection
```
{
  _id: ObjectId,
  batchId: ObjectId (ref: Inventory),
  qrCode: String,
  type: String (INWARD | OUTWARD),
  quantity: Number,
  reason: String,
  referenceId: String,
  supplier: String (for inward),
  remarks: String,
  date: DateTime,
  createdBy: String,
  createdAt: DateTime,
  updatedAt: DateTime
}
```

---

## ✅ Testing the API

Use cURL or Postman to test:

```bash
# Add new stock with inward entry
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
    "supplier": "ABC Supplier"
  }'

# Record outward (sale)
curl -X POST http://localhost:3000/api/movements/outward \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "66...",
    "qrCode": "GV-1001",
    "quantity": 25,
    "reason": "Sale",
    "referenceId": "SALE-001"
  }'

# Get movement history
curl http://localhost:3000/api/movements/history/66...

# Get movement summary
curl "http://localhost:3000/api/movements/summary?startDate=2026-06-01&endDate=2026-06-30"
```

---

## 🚀 Next Steps

1. **Update stock.html** to call these new endpoints when adding/selling stock
2. **Create admin reports** using `/movements/report` and `/movements/summary`
3. **Add movement tracking UI** to display inward/outward history
4. **Set up automated backups** for MongoDB
5. **Add user authentication** to track who made each movement

