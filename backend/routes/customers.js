const router = require('express').Router();
const Customer = require('../models/Customer');

// GET all saved customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create a new customer profile
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, city, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (email) {
      const exists = await Customer.findOne({ email: email.trim().toLowerCase() });
      if (exists) {
        return res.status(409).json({ error: 'Customer with this email already exists' });
      }
    }

    const customer = new Customer({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      city: city.trim(),
      address: address.trim(),
    });

    await customer.save();
    res.status(201).json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
