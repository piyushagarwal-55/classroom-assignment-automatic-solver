const mongoose = require('mongoose');

const solutionSchema = new mongoose.Schema({
  // User who requested the solution
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Assignment details
  assignmentId: {
    type: String,
    required: true
  },
  
  assignmentTitle: {
    type: String,
    required: true
  },
  
  courseId: {
    type: String,
    required: true
  },
  
  courseName: {
    type: String,
    required: true
  },
  
  // Solution content
  solutionText: {
    type: String,
    required: false,
    default: null
  },
  
  // PDF storage
  solutionPdf: {
    type: Buffer,
    required: false,
    default: null
  },
  
  // Metadata
  solvedAt: {
    type: Date,
    default: Date.now
  },
  
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  
  // Processing time and stats
  processingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  
  // Original assignment materials info
  materials: [{
    fileId: String,
    fileName: String,
    fileUrl: String
  }]
}, {
  timestamps: true
});

// Indexes for efficient querying
solutionSchema.index({ userId: 1, assignmentId: 1 });
solutionSchema.index({ userId: 1, solvedAt: -1 });
solutionSchema.index({ courseId: 1 });

// Instance method to get solution summary
solutionSchema.methods.getSummary = function() {
  return {
    id: this._id,
    assignmentTitle: this.assignmentTitle,
    courseName: this.courseName,
    solvedAt: this.solvedAt,
    status: this.status,
    processingTime: this.processingTime
  };
};

// Static method to find user solutions
solutionSchema.statics.findUserSolutions = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ solvedAt: -1 })
    .limit(limit)
    .select('-solutionPdf'); // Exclude PDF data for listing
};

// Static method to check if assignment already solved
solutionSchema.statics.isAssignmentSolved = function(userId, assignmentId) {
  return this.findOne({ 
    userId, 
    assignmentId, 
    status: 'completed' 
  });
};

module.exports = mongoose.model('Solution', solutionSchema);
