import { NextRequest, NextResponse } from 'next/server';
import { getConversationById } from '@/lib/db';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// POST /api/conversations/[id]/query - Query a specific conversation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const conversation = getConversationById(params.id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Build transcript text
    const transcriptText = conversation.transcripts
      .map((t) => `${t.speaker || 'Speaker'}: ${t.content}`)
      .join('\n');

    const systemPrompt = `You are an AI assistant analyzing a conversation transcript. 
Here's the conversation:

${transcriptText}

Answer questions about this conversation accurately and concisely.`;

    const result = await streamText({
      model: openai('gpt-4-turbo'),
      system: systemPrompt,
      prompt: query,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error querying conversation:', error);
    return NextResponse.json({ error: 'Failed to query conversation' }, { status: 500 });
  }
}

