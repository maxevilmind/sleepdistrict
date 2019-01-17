const mongoose = require ("mongoose");
const itemSchema = new mongoose.Schema({
  carried_by: Number,
  location: {
    type: { type: String },
    coordinates: []
  },
  type: String,
  description: String,
  cost: Number,
  name: String,
  stats: {
    attack: Number,
    defence: Number,
  }
});

module.exports = exports = mongoose.model('Item', itemSchema); // export model for use
