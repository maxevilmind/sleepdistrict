const mongoose = require ("mongoose");
const userSchema = new mongoose.Schema({
  id: Number,
  first_name: String,
  last_name: String,
  username: String,
  location: {
    type: { type: String },
    coordinates: []
  },
  stats: {
    strength: Number,
    perception: Number,
    endurance: Number,
    charisma: Number,
    intelligence: Number,
    agility: Number,
    luck: Number
  }
});

module.exports = exports = mongoose.model('User', userSchema); // export model for use
