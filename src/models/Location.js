const mongoose = require ("mongoose");
const locationSchema = new mongoose.Schema({
  user_id: Number,
  latitude: Number,
  longitude: Number,
});

module.exports = exports = mongoose.model('Location', locationSchema); // export model for use
