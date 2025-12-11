import { NextResponse } from 'next/server';
import { getConversations } from '@/lib/db';

// GET /api/insights - Get global insights across all conversations
export async function GET() {
  try {
    const conversations = getConversations();
    
    // Calculate basic insights
    const totalConversations = conversations.length;
    const completedConversations = conversations.filter(c => c.endTime).length;
    
    // Extract themes from conversation titles (simple version)
    const themes = new Set<string>();
    conversations.forEach(conv => {
      const words = conv.title.toLowerCase().split(' ');
      words.forEach(word => {
        if (word.length > 4) themes.add(word);
      });
    });

    return NextResponse.json({
      totalConversations,
      completedConversations,
      activeTopics: Array.from(themes).slice(0, 5),
      recentHighlights: conversations.slice(0, 3).map(c => ({
        id: c.id,
        title: c.title,
        preview: c.summaryPreview || 'No summary available',
      })),
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

