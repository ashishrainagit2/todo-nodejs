const mongoose = require('mongoose');

const TaskSchema = mongoose.Schema({
    title: {
        type : String,
        required : true
    },
    description: {
        type: String,
        required: false
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'in-progress'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    dueDate: {
        type: Date,
        required: false
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    startReminder: {
        type: Date,
        required: false
    },
    tags: {
        type: [String],
        required: false
    },
    attachments: {
        type: [String],
        required: false
    },
    comments: {
        type: [String],
        required: false
    },
    subTasks: {
        type: [String],
        required: false
    },
    parentTask: {
        type: String,
        required: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
})

// collection name is task
// Mongoose takes the model name 'Task' and automatically:
// Lowercases it → task
// Pluralizes it → tasks
module.exports = mongoose.model('Task', TaskSchema);