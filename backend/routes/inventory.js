const router    = require('express').Router();
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');

// GET all batches (for admin inventory page + stock dashboard)
router.get('/', async (req, res) => {
  try {
    const items = await Inventory.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET stock summary (for stock.html dashboard)
router.get('/summary', async (req, res) => {
  try {
    const items = await Inventory.find();
    const totalQty   = items.reduce((s, b) => s + b.qty, 0);
    const totalBatch = items.length;
    const lowStock   = items.filter(b => b.qty / b.originalQty <= 0.2).length;
    const byStone    = {};
    items.forEach(b => { byStone[b.stone] = (byStone[b.stone] || 0) + b.qty; });
    res.json({ totalQty, totalBatch, lowStock, byStone, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single batch by QR code (for scanner page + stock lookup)
router.get('/qr/:qr', async (req, res) => {
  try {
    const item = await Inventory.findOne({ qr: req.params.qr.toUpperCase() });
    if (!item) return res.status(404).json({ error: 'Batch not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single batch by ID or QR code (for item page and lookup)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let item = null;
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      item = await Inventory.findById(id);
    }
    if (!item) {
      item = await Inventory.findOne({ qr: id.toUpperCase() });
    }
    if (!item) return res.status(404).json({ error: 'Batch not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add new batch with inward stock movement (from admin Add Stock page)
router.post('/', async (req, res) => {
  try {
    const { stone, colour, shape, size, plating, grade, qty, pp, sp, supplier, remarks } = req.body;
    if (!stone || !colour || !shape || !size || !plating || !grade || !qty)
      return res.status(400).json({ error: 'All attributes required' });

    // Use qr from request body if provided (e.g. DGS0001 from Stock Manager), else auto-generate
    let qr = req.body.qr || null;
    if (!qr) {
      const last = await Inventory.findOne().sort({ createdAt: -1 });
      let seq = 1001;
      if (last && last.qr) {
        const num = parseInt(last.qr.replace('GV-', ''));
        if (!isNaN(num)) seq = num + 1;
      }
      qr = 'GV-' + seq;
    }

    const item = new Inventory({ qr, stone, colour, shape, size, plating, grade, time: req.body.time || '', qty, originalQty: qty, pp: pp || 0, sp: sp || 0 });
    await item.save();

    // Record inward stock movement
    const movement = new StockMovement({
      batchId: item._id,
      qrCode: qr,
      type: 'INWARD',
      quantity: qty,
      reason: 'Purchase',
      supplier: supplier || 'Manual Entry',
      remarks: remarks || '',
      date: req.body.date ? new Date(req.body.date) : Date.now(),
      createdBy: req.body.createdBy || 'system'
    });
    await movement.save();

    res.status(201).json({ item, movement });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update quantity (used when a sale is made) - also records outward movement
router.patch('/:id/qty', async (req, res) => {
  try {
    const { qty, reason, referenceId, remarks } = req.body;
    if (qty === undefined) return res.status(400).json({ error: 'qty required' });
    
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Batch not found' });

    // Calculate the difference (positive = inward, negative = outward)
    const difference = qty - item.qty;

    // Update quantity
    item.qty = qty;
    await item.save();

    // Record movement if there's a difference
    if (difference !== 0) {
      const movement = new StockMovement({
        batchId: item._id,
        qrCode: item.qr,
        type: difference > 0 ? 'INWARD' : 'OUTWARD',
        quantity: Math.abs(difference),
        reason: reason || (difference > 0 ? 'Adjustment' : 'Sale'),
        referenceId: referenceId || '',
        remarks: remarks || '',
        date: req.body.date ? new Date(req.body.date) : Date.now(),
        createdBy: req.body.createdBy || 'system'
      });
      await movement.save();
    }

    res.json({ item, movement: difference !== 0 ? { type: difference > 0 ? 'INWARD' : 'OUTWARD', quantity: Math.abs(difference) } : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update price fields (pp / sp) — allow accountant to update purchase/sell price
router.patch('/:id', async (req, res) => {
  try {
    const updates = {};
    if (req.body.pp !== undefined) updates.pp = Number(req.body.pp);
    if (req.body.sp !== undefined) updates.sp = Number(req.body.sp);
    if (req.body.time !== undefined) updates.time = req.body.time;
    if (req.body.active !== undefined) updates.active = req.body.active === true || req.body.active === 'true';
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields provided' });
    const item = await Inventory.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!item) return res.status(404).json({ error: 'Batch not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE batch
router.delete('/:id', async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Batch not found' });
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;