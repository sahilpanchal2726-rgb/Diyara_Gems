const router = require('express').Router();
const Order  = require('../models/Order');
const Notification = require('../models/Notification');

// GET all orders (admin dashboard — "Customer Orders" section)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET orders by customer name and date (must be before /:orderId)
router.get('/search/customer', async (req, res) => {
  try {
    const { name, date } = req.query;
    if (!name || !date) {
      return res.status(400).json({ error: 'Customer name and date are required' });
    }

    // Parse the date and create date range for the day
    const searchDate = new Date(date);
    const startOfDay = new Date(searchDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      'customer.name': { $regex: name, $options: 'i' },
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single order by orderId
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST place a new customer order (called from custo.html placeOrder())
router.post('/', async (req, res) => {
  try {
    const { orderId, customer, items, subtotal, gst, total } = req.body;
    if (!orderId || !customer || !items || items.length === 0)
      return res.status(400).json({ error: 'orderId, customer, and items are required' });

    const order = new Order({ orderId, customer, items, subtotal, gst, total });
    await order.save();
    res.status(201).json(order);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Order ID already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH update order status (admin action)
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const order = await Order.findOneAndUpdate({ orderId: req.params.orderId }, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Create notification for customer
    const statusMessages = {
      'pending': 'Your order is received and pending confirmation.',
      'confirmed': 'Your order has been confirmed! We will start packing it soon.',
      'shipped': 'Your order is on the way! You will receive it shortly.',
      'delivered': 'Your order has been delivered. Thank you for your purchase!',
      'cancelled': 'Your order has been cancelled. Please contact support if you have any questions.'
    };

    const notification = new Notification({
      orderId: order.orderId,
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      customerPhone: order.customer.phone,
      status: status,
      message: `Order #${order.orderId}: ${statusMessages[status]}`
    });
    
    await notification.save();
    
    res.json({ order, notification });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET notifications by email
router.get('/notifications/email/:email', async (req, res) => {
  try {
    const notifications = await Notification.find({ customerEmail: req.params.email }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET notifications by phone
router.get('/notifications/phone/:phone', async (req, res) => {
  try {
    const notifications = await Notification.find({ customerPhone: req.params.phone }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET notifications by order ID
router.get('/notifications/order/:orderId', async (req, res) => {
  try {
    const notifications = await Notification.find({ orderId: req.params.orderId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH mark notification as read
router.patch('/notifications/:notificationId/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.notificationId, { read: true }, { new: true });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
