'use client';

import { useState, useEffect } from 'react';
import ConversationList from '@/components/ConversationList';
import InsightsPanel from '@/components/InsightsPanel';
import VoiceRecorder from '@/components/VoiceRecorder';
import ConversationDetail from '@/components/ConversationDetail';
import { ConversationListItem } from '@/types';

export default function Home() {
  const [activeView, setActiveView] = useState<'live' | 'detail'>('live');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch conversations on mount and when refreshTrigger changes
  useEffect(() => {
    fetchConversations();
  }, [refreshTrigger]);

  async function fetchConversations() {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setConversations(data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  }

  function handleConversationClick(id: string) {
    setSelectedConversationId(id);
    setActiveView('detail');
  }

  function handleNewConversation() {
    setActiveView('live');
    setSelectedConversationId(null);
  }

  function handleConversationEnd() {
    // Refresh conversation list after recording ends
    setRefreshTrigger(prev => prev + 1);
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Voice Conversation Assistant</h1>
      </header>

      {/* Left Sidebar - Conversation History */}
      <aside className="sidebar">
        <ConversationList
          conversations={conversations}
          onConversationClick={handleConversationClick}
          onNewConversation={handleNewConversation}
        />
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeView === 'live' ? (
          <VoiceRecorder onConversationEnd={handleConversationEnd} />
        ) : (
          <ConversationDetail
            conversationId={selectedConversationId!}
            onClose={handleNewConversation}
          />
        )}
      </main>

      {/* Right Sidebar - Insights */}
      <aside className="sidebar sidebar-right">
        <InsightsPanel conversationId={selectedConversationId} />
      </aside>
    </div>
  );
}

