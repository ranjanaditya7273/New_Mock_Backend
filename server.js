const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const Book = require('./Model/Book');

const app = express();

// Middleware: Body parser with limit for large data
// https://aditya-test-mock.onrender.com/
// http://localhost:3000

const allowedOrigins = [
  'https://aditya-test-mock.onrender.com',
  'https://hoppscotch.io',                 
  'null'                             
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer setup using memoryStorage (No temporary files on disk)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Database Connection
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
    .then(() => console.log("✅ MongoDB Connected!"))
    .catch(err => console.error("❌ Connection Error:", err));

// Helper: Parse text file content into structured JSON
const parseQuizContent = (text) => {
    const questions = [];
    const rawBlocks = text.split(/Q:/).filter(Boolean);

    rawBlocks.forEach(block => {
        const lines = block.trim().split('\n');
        const questionText = lines[0].trim();
        const options = [];
        let ans = 0;
        let explanation = "";

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('A)')) options.push(trimmedLine.replace('A)', '').trim());
            if (trimmedLine.startsWith('B)')) options.push(trimmedLine.replace('B)', '').trim());
            if (trimmedLine.startsWith('C)')) options.push(trimmedLine.replace('C)', '').trim());
            if (trimmedLine.startsWith('D)')) options.push(trimmedLine.replace('D)', '').trim());
            if (trimmedLine.startsWith('ANS:')) ans = parseInt(trimmedLine.replace('ANS:', '').trim());
            if (trimmedLine.startsWith('Explanation:')) explanation = block.split('Explanation:')[1]?.trim();
        });

        questions.push({ question: questionText, options, ans, explanation });
    });
    return questions;
};

/**
 * @route   POST /api/upload-quiz
 * @desc    Process file and update the 3-tier structure
 */
app.post('/api/upload-quiz', upload.single('quizFile'), async (req, res) => {
    try {
        const { bookName, subjectName, topicName } = req.body;

        if (!req.file) return res.status(400).json({ error: "Please upload a .txt file" });

        const rawText = req.file.buffer.toString('utf-8');
        const parsedQuestions = parseQuizContent(rawText);

        // Find or create Book
        let book = await Book.findOne({ bookName });
        if (!book) book = new Book({ bookName, subjects: [] });

        // Find or create Subject
        let subject = book.subjects.find(s => s.subjectName === subjectName);
        if (!subject) {
            book.subjects.push({ subjectName, topics: [] });
            subject = book.subjects[book.subjects.length - 1];
        }

        // Add or replace Topic
        const topicIndex = subject.topics.findIndex(t => t.topicName === topicName);
        if (topicIndex > -1) {
            subject.topics[topicIndex].questions = parsedQuestions;
        } else {
            subject.topics.push({ topicName, questions: parsedQuestions });
        }

        await book.save();
        res.status(200).json({ success: true, message: "Quiz structure updated successfully!" });

    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/admin-dump
 * @desc    Fetch all data with Manual Sort to bypass MongoDB limits
 */
app.post('/api/admin-dump', async (req, res) => {
    const { email, password } = req.body;

    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (email === adminEmail && password === adminPassword) {
            
            // Step 1: Fetch data without sort using .lean() for performance
            const allData = await Book.find({}).lean();

            // Step 2: Manual Server-side Sorting (Bypasses MongoDB 32MB Sort Limit)
            allData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            return res.status(200).json({
                success: true,
                message: "Authentication successful (Manual Sort Active)",
                count: allData.length,
                data: allData
            });

        } else {
            return res.status(401).json({ success: false, error: "Invalid Credentials" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Fetch error", details: err.message });
    }
});

app.get('/', (req, res) => {
    res.send("3-Tier Quiz Backend is Running (Optimized Mode)");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));