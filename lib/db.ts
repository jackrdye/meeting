import fs from 'fs';
import path from 'path';
import { Conversation, Message, ConversationListItem, SummaryData } from '@/types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'conversations.json');

// Ensure DB directory and file exist
function ensureDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, '[]', 'utf8');
  }
}

function readDb(): Conversation[] {
  try {
    ensureDb();
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB:', err);
    return [];
  }
}

function writeDb(data: Conversation[]) {
  try {
    ensureDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

export function createConversation(metadata: Partial<Conversation>): Conversation {
  const db = readDb();
  const newConv: Conversation = {
    id: Date.now().toString(),
    title: metadata.title || 'New Conversation',
    createdAt: new Date().toISOString(),
    status: 'active',
    transcripts: [],
    keyPoints: [],
    actionItems: [],
    ...metadata,
  };
  db.push(newConv);
  writeDb(db);
  return newConv;
}

export function addTranscript(conversationId: string, transcript: Message) {
  const db = readDb();
  const convIndex = db.findIndex((c) => c.id === conversationId);
  if (convIndex !== -1) {
    db[convIndex].transcripts.push(transcript);
    writeDb(db);
  }
}

export function endConversation(conversationId: string, summaryData?: SummaryData) {
  const db = readDb();
  const convIndex = db.findIndex((c) => c.id === conversationId);
  if (convIndex !== -1) {
    db[convIndex].endTime = new Date().toISOString();
    db[convIndex].status = 'completed';
    
    // Calculate duration if startTime exists
    const startTime = new Date(db[convIndex].createdAt);
    const endTime = new Date();
    db[convIndex].duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    if (summaryData) {
      db[convIndex].summary = summaryData.summary;
      db[convIndex].keyPoints = summaryData.keyPoints || [];
      db[convIndex].actionItems = summaryData.actionItems || [];
    }
    writeDb(db);
  }
}

export function getConversations(): ConversationListItem[] {
  const db = readDb();
  return db
    .map((c) => ({
      id: c.id,
      title: c.title,
      startTime: c.createdAt,
      endTime: c.endTime,
      summaryPreview: c.summary ? c.summary.substring(0, 100) + '...' : '',
    }))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}

export function getConversationById(id: string): Conversation | undefined {
  const db = readDb();
  return db.find((c) => c.id === id);
}

export function deleteConversation(id: string): boolean {
  const db = readDb();
  const filtered = db.filter((c) => c.id !== id);
  if (filtered.length < db.length) {
    writeDb(filtered);
    return true;
  }
  return false;
}

export function updateConversation(id: string, updates: Partial<Conversation>) {
  const db = readDb();
  const convIndex = db.findIndex((c) => c.id === id);
  if (convIndex !== -1) {
    db[convIndex] = { ...db[convIndex], ...updates };
    writeDb(db);
    return db[convIndex];
  }
  return null;
}

