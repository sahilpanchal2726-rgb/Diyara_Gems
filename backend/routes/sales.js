const router    = require('express').Router();
const Sale      = require('../models/Sale');
const Inventory = require('../models/Inventory');

// GET all sales (admin reports + recent sales widget)
router.get('/', async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.json(sales);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST confirm a sale — deducts from inventory atomically
router.post('/', async (req, res) => {
  try {
    const { batchId, qr, stone, colour, qty, saleBase, saleCgst, saleSgst, saleTotal, profit } = req.body;
    if (!batchId || !qty || qty < 1) return res.status(400).json({ error: 'batchId and qty required' });

    // Find batch and check stock
    const batch = await Inventory.findById(batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (qty > batch.qty) return res.status(400).json({ error: `Insufficient stock. Available: ${batch.qty}` });

    // Deduct inventory
    batch.qty -= qty;
    await batch.save();

    // Record sale
    const sale = new Sale({ batchId, qr: qr || batch.qr, stone: stone || batch.stone, colour: colour || batch.colour, qty, saleBase: saleBase || 0, saleCgst: saleCgst || 0, saleSgst: saleSgst || 0, saleTotal: saleTotal || 0, profit: profit || 0 });
    await sale.save();

    res.status(201).json({ sale, updatedBatch: batch });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;