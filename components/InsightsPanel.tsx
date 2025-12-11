'use client';

import { useState, useEffect } from 'react';
import { Conversation } from '@/types';
import styles from './InsightsPanel.module.css';

interface InsightsPanelProps {
  conversationId?: string | null;
}

interface GlobalInsights {
  totalConversations: number;
  completedConversations: number;
  activeTopics: string[];
  recentHighlights: Array<{
    id: string;
    title: string;
    preview: string;
  }>;
}

export default function InsightsPanel({ conversationId }: InsightsPanelProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [globalInsights, setGlobalInsights] = useState<GlobalInsights | null>(null);

  useEffect(() => {
    if (conversationId) {
      fetchConversation(conversationId);
    } else {
      fetchGlobalInsights();
    }
  }, [conversationId]);

  async function fetchConversation(id: string) {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      setConversation(data);
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    }
  }

  async function fetchGlobalInsights() {
    try {
      const res = await fetch('/api/insights');
      const data = await res.json();
      setGlobalInsights(data);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    }
  }

  return (
    <>
      <div className="sidebar-header">Insights</div>
      <div className="sidebar-content">
        {conversationId && conversation ? (
          // Show conversation-specific insights
          <div className={styles.insights}>
            <div className={styles.card}>
              <h4>Summary</h4>
              <p className={styles.summary}>
                {conversation.summary || 'Select a conversation to see summary.'}
              </p>
            </div>

            {conversation.keyPoints && conversation.keyPoints.length > 0 && (
              <div className={styles.card}>
                <h4>Key Points</h4>
                <ul className={styles.list}>
                  {conversation.keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {conversation.actionItems && conversation.actionItems.length > 0 && (
              <div className={styles.card}>
                <h4>Action Items</h4>
                <ul className={styles.list}>
                  {conversation.actionItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          // Show global insights
          <div className={styles.insights}>
            <div className={styles.card}>
              <h4>Statistics</h4>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <div className={styles.statValue}>
                    {globalInsights?.totalConversations || 0}
                  </div>
                  <div className={styles.statLabel}>Total Conversations</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statValue}>
                    {globalInsights?.completedConversations || 0}
                  </div>
                  <div className={styles.statLabel}>Completed</div>
                </div>
              </div>
            </div>

            {globalInsights?.activeTopics && globalInsights.activeTopics.length > 0 && (
              <div className={styles.card}>
                <h4>Active Topics</h4>
                <div className={styles.topics}>
                  {globalInsights.activeTopics.map((topic, i) => (
                    <span key={i} className={styles.topic}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {globalInsights?.recentHighlights && globalInsights.recentHighlights.length > 0 && (
              <div className={styles.card}>
                <h4>Recent Highlights</h4>
                <ul className={styles.highlights}>
                  {globalInsights.recentHighlights.map((highlight) => (
                    <li key={highlight.id}>
                      <div className={styles.highlightTitle}>{highlight.title}</div>
                      <div className={styles.highlightPreview}>{highlight.preview}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!globalInsights && (
              <div className={styles.empty}>
                <p>Loading insights...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

