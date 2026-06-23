const router    = require('express').Router();
const Inventory = require('../models/Inventory');
const Sale      = require('../models/Sale');
const Order     = require('../models/Order');

// GET aggregated dashboard stats (admin homepage)
router.get('/', async (req, res) => {
  try {
    const [inventory, sales, orders] = await Promise.all([
      Inventory.find(),
      Sale.find().sort({ createdAt: -1 }),
      Order.find().sort({ createdAt: -1 }),
    ]);

    // Stock stats
    const totalStock  = inventory.reduce((s, b) => s + b.qty, 0);
    const totalBatches = inventory.length;

    // Sales stats
    const totalSold = sales.reduce((s, sl) => s + sl.qty, 0);

    // Order stats
    const pendingOrders   = orders.filter(o => o.status === 'pending').length;
    const totalOrders     = orders.length;

    // Recent items
    const recentBatches = inventory.slice(0, 5);
    const recentSales   = sales.slice(0, 5);
    const recentOrders  = orders.slice(0, 10);

    // Sales last 7 days (for chart)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const salesByDay = {};
    sales.filter(s => new Date(s.createdAt) >= sevenDaysAgo).forEach(s => {
      const d = new Date(s.createdAt).toISOString().split('T')[0];
      salesByDay[d] = (salesByDay[d] || 0) + s.qty;
    });

    // Stock by stone type (for chart)
    const byStone = {};
    inventory.forEach(b => { byStone[b.stone] = (byStone[b.stone] || 0) + b.qty; });

    res.json({
      totalStock, totalBatches, totalSold,
      pendingOrders, totalOrders,
      recentBatches, recentSales, recentOrders,
      salesByDay, byStone,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;