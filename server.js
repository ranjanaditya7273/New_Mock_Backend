const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

// पुराने Book मॉडल की जगह नया Subject मॉडल इम्पोर्ट करें
// सुनिश्चित करें कि आपका मॉडल फ़ाइल का नाम और पाथ सही है
const Subject = require('./Model/Subject'); 

const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
  'https://aditya-test-mock.onrender.com',
  'https://hoppscotch.io',
//   'http://localhost:3000', // लोकल टेस्टिंग के लिए खुला रखा है 
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

// --- Multer Configuration ---
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// --- Database Connection ---
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
    .then(() => console.log("✅ MongoDB Connected (Subject-Wise Mode)"))
    .catch(err => console.error("❌ Connection Error:", err));

// --- Helper: Parse Quiz Content ---
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
            if (trimmedLine.startsWith('E)')) options.push(trimmedLine.replace('E)', '').trim());
            
            if (trimmedLine.startsWith('ANS:')) {
                ans = parseInt(trimmedLine.replace('ANS:', '').trim());
            }
            
            if (trimmedLine.toLowerCase().includes('explanation:')) {
                const parts = block.split(/explanation:/i);
                if (parts[1]) explanation = parts[1].trim();
            }
        });

        questions.push({ question: questionText, options, ans, explanation });
    });
    return questions;
};

// --- ROUTES ---

/**
 * @route   POST /api/upload-quiz
 * @desc    विषय के आधार पर डॉक्यूमेंट बनाना (16MB समस्या का समाधान)
 */
app.post('/api/upload-quiz', upload.single('quizFile'), async (req, res) => {
    try {
        const { bookName, subjectName, topicName } = req.body;

        if (!req.file) return res.status(400).json({ error: "Please upload a .txt file" });

        const rawText = req.file.buffer.toString('utf-8');
        const parsedQuestions = parseQuizContent(rawText);

        // अब हम पूरी बुक नहीं, सिर्फ 'Book Name' + 'Subject Name' का यूनिक डॉक्यूमेंट ढूंढेंगे
        let subject = await Subject.findOne({ bookName, subjectName });

        if (!subject) {
            subject = new Subject({ bookName, subjectName, topics: [] });
        }

        // टॉपिक अपडेट या ऐड करें
        const topicIndex = subject.topics.findIndex(t => t.topicName === topicName);
        if (topicIndex > -1) {
            subject.topics[topicIndex].questions = parsedQuestions;
        } else {
            subject.topics.push({ topicName, questions: parsedQuestions });
        }

        await subject.save();
        res.status(200).json({ 
            success: true, 
            message: `${subjectName} - ${topicName} सफलतापूर्वक अपडेट हो गया है!` 
        });

    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/book/:bookName
 * @desc    किताब के नाम से सारा डेटा रिट्रीव करना (Frontend के लिए आसान)
 */
app.get('/api/book/:bookName', async (req, res) => {
    try {
        const { bookName } = req.params;
        
        // उस बुक के सभी सब्जेक्ट्स डाक्यूमेंट्स को एक साथ लाएं
        const subjectsData = await Subject.find({ bookName }).lean();

        if (!subjectsData.length) {
            return res.status(404).json({ message: "कोई डेटा नहीं मिला।" });
        }

        // डेटा को पुराने "Book" स्ट्रक्चर में बदलें ताकि फ्रंटेंड न टूटे
        const response = {
            bookName: bookName,
            subjects: subjectsData.map(s => ({
                subjectName: s.subjectName,
                topics: s.topics
            }))
        };

        res.status(200).json(response);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/admin-dump
 * @desc    Admin के लिए सारा डेटा (विषय-वार)
 */
app.post('/api/admin-dump', async (req, res) => {
    const { email, password } = req.body;

    try {
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            
            // सभी सब्जेक्ट्स का डेटा लाएं
            const allData = await Subject.find({}).lean();

            // मैन्युअल सॉर्टिंग
            allData.sort((a, b) => b.subjectName.localeCompare(a.subjectName));

            return res.status(200).json({
                success: true,
                message: "Authentication successful",
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
    res.send("Subject-Wise Quiz Backend is Running 🚀 (No 16MB Limit)");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));