const mongoose = require('mongoose');

const roomExpenseSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  splits: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    share: { type: Number }
  }]
}, { timestamps: true });

module.exports = mongoose.model('RoomExpense', roomExpenseSchema);
