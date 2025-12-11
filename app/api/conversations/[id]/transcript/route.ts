import { NextRequest, NextResponse } from 'next/server';
import { getConversationById } from '@/lib/db';

// GET /api/conversations/[id]/transcript - Get conversation transcript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversation = getConversationById(params.id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      transcripts: conversation.transcripts,
      createdAt: conversation.createdAt,
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
}

