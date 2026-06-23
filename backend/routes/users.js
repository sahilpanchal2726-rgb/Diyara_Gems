const router = require('express').Router();
const User   = require('../models/User');

// GET all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single user
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if(!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create user
router.post('/', async (req, res) => {
  try {
    const { username, name, email, role, permissions } = req.body;
    if(!username || !name) return res.status(400).json({ error: 'username and name required' });
    const exists = await User.findOne({ username });
    if(exists) return res.status(409).json({ error: 'username exists' });
    const user = new User({ username, name, email, role: role||'staff', permissions: permissions||{} });
    await user.save();
    res.status(201).json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update permissions
router.patch('/:id/permissions', async (req, res) => {
  try {
    const perms = req.body.permissions;
    if(typeof perms !== 'object') return res.status(400).json({ error: 'permissions object required' });
    const user = await User.findByIdAndUpdate(req.params.id, { permissions: perms }, { new: true });
    if(!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
