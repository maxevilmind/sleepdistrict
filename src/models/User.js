const mongoose = require ("mongoose");
const userSchema = new mongoose.Schema({
  id: Number,
  first_name: String,
  last_name: String,
  username: String,
});

module.exports = exports = mongoose.model('User', userSchema); // export model for use
