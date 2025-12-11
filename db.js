const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'conversations.json');

// Ensure DB exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, '[]', 'utf8');
}

function readDb() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading DB:", err);
        return [];
    }
}

function writeDb(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Error writing DB:", err);
    }
}

function createConversation(metadata) {
    const db = readDb();
    const newConv = {
        id: Date.now().toString(),
        title: metadata.title || "New Conversation",
        startTime: new Date().toISOString(),
        endTime: null,
        transcripts: [],
        summary: null,
        keyPoints: [],
        ...metadata
    };
    db.push(newConv);
    writeDb(db);
    return newConv;
}

function addTranscript(conversationId, transcript) {
    const db = readDb();
    const convIndex = db.findIndex(c => c.id === conversationId);
    if (convIndex !== -1) {
        // Avoid duplicate final transcripts if possible, or just append
        // For simplicity, we just append here. Real apps might dedup.
        db[convIndex].transcripts.push(transcript);
        writeDb(db);
    }
}

function endConversation(conversationId, summaryData = null) {
    const db = readDb();
    const convIndex = db.findIndex(c => c.id === conversationId);
    if (convIndex !== -1) {
        db[convIndex].endTime = new Date().toISOString();
        if (summaryData) {
            db[convIndex].summary = summaryData.summary;
            db[convIndex].keyPoints = summaryData.keyPoints || [];
            db[convIndex].actionItems = summaryData.actionItems || [];
        }
        writeDb(db);
    }
}

function getConversations() {
    const db = readDb();
    // Return summary list (exclude full transcripts for performance if list is long)
    return db.map(c => ({
        id: c.id,
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
        summaryPreview: c.summary ? c.summary.substring(0, 100) + '...' : ''
    })).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

function getConversationById(id) {
    const db = readDb();
    return db.find(c => c.id === id);
}

module.exports = {
    createConversation,
    addTranscript,
    endConversation,
    getConversations,
    getConversationById
};
