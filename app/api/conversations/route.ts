import { NextRequest, NextResponse } from 'next/server';
import { getConversations, createConversation } from '@/lib/db';

// GET /api/conversations - Get all conversations
export async function GET() {
  try {
    const conversations = getConversations();
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

// POST /api/conversations - Create new conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newConversation = createConversation(body);
    return NextResponse.json(newConversation, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

