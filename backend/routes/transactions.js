const router = require('express').Router();
const Transaction = require('../models/Transaction');

// GET all transactions for accountant
router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.json(transactions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET transactions by type (inward/outward)
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const transactions = await Transaction.find({ type }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create new transaction (from stock manager)
router.post('/', async (req, res) => {
  try {
    const { batchId, type, stone, colour, shape, size, grade, qty, date, time, status, vendor, customer, ref, notes, source } = req.body;

    if (!batchId || !type || !qty) {
      return res.status(400).json({ error: 'batchId, type, and qty required' });
    }

    const transaction = new Transaction({
      batchId,
      type, // 'inward' or 'outward'
      stone,
      colour,
      shape,
      size,
      grade,
      qty: Number(qty),
      date: date || new Date().toISOString().split('T')[0],
      time: time || '',
      vendor: vendor || '',
      customer: customer || '',
      ref: ref || '',
      purchasePrice: 0,
      salePrice: 0,
      gst: 0,
      discount: 0,
      notes: notes || '',
      status: status || 'pending', // pending, priced
      source: source || 'stock_manager',
      pricedBy: '',
      pricedAt: '',
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH update transaction with pricing
router.patch('/:id/price', async (req, res) => {
  try {
    const { purchasePrice, salePrice, gst, discount, notes } = req.body;
    const updates = {
      status: 'priced',
      pricedBy: 'Accountant',
      pricedAt: new Date().toISOString(),
    };
    if (purchasePrice !== undefined) updates.purchasePrice = Number(purchasePrice);
    if (salePrice !== undefined) updates.salePrice = Number(salePrice);
    if (gst !== undefined) updates.gst = Number(gst);
    if (discount !== undefined) updates.discount = Number(discount);
    if (notes !== undefined) updates.notes = notes;

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    res.json(transaction);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET pending transactions (awaiting price entry)
router.get('/pending/list', async (req, res) => {
  try {
    const transactions = await Transaction.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
