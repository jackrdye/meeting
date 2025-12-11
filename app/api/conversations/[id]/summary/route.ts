import { NextRequest, NextResponse } from 'next/server';
import { getConversationById } from '@/lib/db';

// GET /api/conversations/[id]/summary - Get conversation summary
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
      summary: conversation.summary || 'No summary available',
      keyPoints: conversation.keyPoints || [],
      actionItems: conversation.actionItems || [],
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}

