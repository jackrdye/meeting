import { NextRequest, NextResponse } from 'next/server';
import { getConversationById, endConversation } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/summarize - Generate conversation summary
export async function POST(request: NextRequest) {
  try {
    const { conversationId } = await request.json();
    
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const conversation = getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Build transcript text
    let fullText = '';
    if (conversation.transcripts && conversation.transcripts.length > 0) {
      fullText = conversation.transcripts
        .map((t) => `${t.speaker || 'Speaker'}: ${t.content}`)
        .join('\n');
    } else {
      // Mock for demo if no transcript
      fullText = '[Mock Transcript] User: We discussed the project timeline. AI: Agreed, let me summarize the key points.';
    }

    console.log('Generating summary for:', conversationId);

    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      console.warn('Missing OPENAI_API_KEY, using mock summary');
      const mockSummary = {
        summary: 'Mock Summary: The conversation covered various topics including project updates and action items.',
        keyPoints: ['Project timeline discussion', 'Resource allocation', 'Next steps identified'],
        actionItems: ['Add OPENAI_API_KEY to environment variables', 'Review project timeline'],
      };
      endConversation(conversationId, mockSummary);
      return NextResponse.json(mockSummary);
    }

    // Generate real summary with OpenAI
    const systemPrompt = `You are an expert Minute Taker.
Analyze the following transcript and return a JSON object with:
- summary: A concise paragraph summary (2-3 sentences).
- keyPoints: Array of strings (max 5) highlighting key discussion topics.
- actionItems: Array of strings (max 5) listing clear, actionable tasks derived from the conversation.

Transcript:
${fullText}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs JSON.' },
        { role: 'user', content: systemPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    const summaryData = {
      summary: result.summary || 'No summary generated',
      keyPoints: result.keyPoints || [],
      actionItems: result.actionItems || [],
    };

    // Save summary to database
    endConversation(conversationId, summaryData);

    return NextResponse.json(summaryData);
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}

