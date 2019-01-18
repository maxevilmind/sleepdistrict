const mongoose = require ("mongoose");
const locationSchema = new mongoose.Schema({
  user_id: Number,
  location: {
    type: { type: String },
    coordinates: []
  },
});

module.exports = exports = mongoose.model('Location', locationSchema); // export model for use
