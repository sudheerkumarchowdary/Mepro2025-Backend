const mongoose = require('mongoose');

const pitchSchema = new mongoose.Schema({
  userId: {
    type: String, // Changed from ObjectId to String to support Azure SQL integer IDs
    required: true,
  },
  fileName: String,
  category: String,
  note: String,
  fileUrl: String,
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Pitch', pitchSchema);
