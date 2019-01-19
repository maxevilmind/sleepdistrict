const mongoose = require ("mongoose");
const damageLedgerSchema = new mongoose.Schema({
  from: Number,
  to: Number,
  amount: Number,
  created_at: Date,
});

module.exports = exports = mongoose.model('DamageLedger', damageLedgerSchema); // export model for use
