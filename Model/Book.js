const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    question: String,
    options: [String],
    ans: Number,
    explanation: String
});

const TopicSchema = new mongoose.Schema({
    topicName: String,
    questions: [QuestionSchema]
});

const SubjectSchema = new mongoose.Schema({
    subjectName: String,
    topics: [TopicSchema]
});

const BookSchema = new mongoose.Schema({
    bookName: { type: String, required: true, unique: true },
    subjects: [SubjectSchema]
});

module.exports = mongoose.model('Book', BookSchema);