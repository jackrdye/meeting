'use client';

import { useState, useEffect } from 'react';
import { Conversation } from '@/types';
import styles from './ConversationDetail.module.css';
import { format } from 'date-fns';
import AskPanel from './AskPanel';

interface ConversationDetailProps {
  conversationId: string;
  onClose: () => void;
}

export default function ConversationDetail({ conversationId, onClose }: ConversationDetailProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'ask'>('transcript');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversation();
  }, [conversationId]);

  async function fetchConversation() {
    try {
      setLoading(true);
      const res = await fetch(`/api/conversations/${conversationId}`);
      const data = await res.json();
      setConversation(data);
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading conversation...</div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Conversation not found</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>{conversation.title}</h2>
          <div className={styles.meta}>
            {format(new Date(conversation.createdAt), 'PPpp')}
            {conversation.duration && ` • ${Math.floor(conversation.duration / 60)} mins`}
          </div>
        </div>
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'transcript' ? styles.active : ''}`}
          onClick={() => setActiveTab('transcript')}
        >
          Transcript
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'summary' ? styles.active : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'ask' ? styles.active : ''}`}
          onClick={() => setActiveTab('ask')}
        >
          Ask
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'transcript' && (
          <div className={styles.transcript}>
            {conversation.transcripts && conversation.transcripts.length > 0 ? (
              conversation.transcripts.map((t, i) => (
                <div key={i} className={styles.message}>
                  <div className={styles.messageHeader}>
                    <span className={styles.speaker}>{t.speaker || 'Speaker'}</span>
                    <span className={styles.timestamp}>
                      {format(new Date(t.timestamp), 'p')}
                    </span>
                  </div>
                  <div className={styles.messageContent}>{t.content}</div>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No transcript available for this conversation.</div>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className={styles.summary}>
            <div className={styles.summarySection}>
              <h3>Summary</h3>
              <p>{conversation.summary || 'No summary available yet.'}</p>
            </div>

            {conversation.keyPoints && conversation.keyPoints.length > 0 && (
              <div className={styles.summarySection}>
                <h3>Key Points</h3>
                <ul>
                  {conversation.keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {conversation.actionItems && conversation.actionItems.length > 0 && (
              <div className={styles.summarySection}>
                <h3>Action Items</h3>
                <ul>
                  {conversation.actionItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ask' && (
          <AskPanel conversationId={conversationId} />
        )}
      </div>
    </div>
  );
}

