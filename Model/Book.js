const mongoose = require('mongoose');

// 1. Subject Schema (इसमें उस विषय के टॉपिक्स और सवाल होंगे)
const SubjectSchema = new mongoose.Schema({
    bookName: { type: String, required: true, index: true }, // Parent Book का नाम
    subjectName: { type: String, required: true },
    topics: [{
        topicName: String,
        questions: [{
            question: String,
            options: [String],
            ans: Number,
            explanation: String
        }]
    }]
});

// इंडेक्सिंग ताकि सर्च फ़ास्ट हो
SubjectSchema.index({ bookName: 1, subjectName: 1 });

module.exports = mongoose.model('Subject', SubjectSchema);