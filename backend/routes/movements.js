const router    = require('express').Router();
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');

// ── INWARD STOCK ENTRY ──────────────────────────────────────
// POST - Record inward stock entry (supplier purchase)
router.post('/inward', async (req, res) => {
  try {
    const { batchId, qrCode, quantity, supplier, remarks, date } = req.body;
    
    if (!batchId || !qrCode || !quantity || !supplier) {
      return res.status(400).json({ error: 'batchId, qrCode, quantity, supplier are required' });
    }

    // Find the batch
    const batch = await Inventory.findById(batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    // Create stock movement record
    const movement = new StockMovement({
      batchId,
      qrCode,
      type: 'INWARD',
      quantity,
      reason: 'Purchase',
      supplier,
      remarks,
      date: date ? new Date(date) : Date.now(),
      createdBy: req.body.createdBy || 'manual'
    });

    await movement.save();

    // Update batch quantity
    batch.qty = batch.qty + quantity;
    await batch.save();

    res.status(201).json({
      message: 'Inward stock entry recorded',
      movement,
      batch
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── OUTWARD STOCK ENTRY ──────────────────────────────────────
// POST - Record outward stock entry (sale, damage, loss)
router.post('/outward', async (req, res) => {
  try {
    const { batchId, qrCode, quantity, reason, referenceId, remarks, date } = req.body;
    
    if (!batchId || !qrCode || !quantity || !reason) {
      return res.status(400).json({ error: 'batchId, qrCode, quantity, reason are required' });
    }

    // Find the batch
    const batch = await Inventory.findById(batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    // Check if sufficient quantity available
    if (batch.qty < quantity) {
      return res.status(400).json({ 
        error: 'Insufficient quantity', 
        available: batch.qty, 
        requested: quantity 
      });
    }

    // Create stock movement record
    const movement = new StockMovement({
      batchId,
      qrCode,
      type: 'OUTWARD',
      quantity,
      reason,
      referenceId,
      remarks,
      date: date ? new Date(date) : Date.now(),
      createdBy: req.body.createdBy || 'manual'
    });

    await movement.save();

    // Update batch quantity
    batch.qty = batch.qty - quantity;
    await batch.save();

    res.status(201).json({
      message: 'Outward stock entry recorded',
      movement,
      batch
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET MOVEMENT HISTORY ──────────────────────────────────────
// GET - All movements for a batch
router.get('/history/:batchId', async (req, res) => {
  try {
    const movements = await StockMovement.find({ batchId: req.params.batchId })
      .sort({ date: -1 })
      .populate('batchId', 'qr stone colour shape size');
    
    res.json(movements);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET - All movements by QR code
router.get('/qr/:qrCode', async (req, res) => {
  try {
    const movements = await StockMovement.find({ qrCode: req.params.qrCode.toUpperCase() })
      .sort({ date: -1 });
    
    res.json(movements);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET - All inward movements
router.get('/type/inward', async (req, res) => {
  try {
    const movements = await StockMovement.find({ type: 'INWARD' })
      .sort({ date: -1 })
      .populate('batchId', 'qr stone colour shape size');
    
    res.json(movements);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET - All outward movements
router.get('/type/outward', async (req, res) => {
  try {
    const movements = await StockMovement.find({ type: 'OUTWARD' })
      .sort({ date: -1 })
      .populate('batchId', 'qr stone colour shape size');
    
    res.json(movements);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET - Stock movement summary for date range
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const inwardTotal = await StockMovement.aggregate([
      { $match: { ...query, type: 'INWARD' } },
      { $group: { _id: null, total: { $sum: '$quantity' }, count: { $sum: 1 } } }
    ]);

    const outwardTotal = await StockMovement.aggregate([
      { $match: { ...query, type: 'OUTWARD' } },
      { $group: { _id: null, total: { $sum: '$quantity' }, count: { $sum: 1 } } }
    ]);

    res.json({
      inward: inwardTotal.length ? inwardTotal[0] : { total: 0, count: 0 },
      outward: outwardTotal.length ? outwardTotal[0] : { total: 0, count: 0 }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET - Detailed movement report
router.get('/report', async (req, res) => {
  try {
    const movements = await StockMovement.find()
      .sort({ date: -1 })
      .populate('batchId', 'qr stone colour shape size qty');
    
    res.json(movements);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
