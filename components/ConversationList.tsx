'use client';

import { ConversationListItem } from '@/types';
import styles from './ConversationList.module.css';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  conversations: ConversationListItem[];
  onConversationClick: (id: string) => void;
  onNewConversation: () => void;
}

export default function ConversationList({
  conversations,
  onConversationClick,
  onNewConversation,
}: ConversationListProps) {
  return (
    <>
      <div className="sidebar-header">
        <span>Conversations</span>
        <button className="btn-icon" onClick={onNewConversation} title="New Conversation">
          +
        </button>
      </div>
      <div className="sidebar-content">
        {conversations.length === 0 ? (
          <div className={styles.empty}>
            <p>No conversations yet</p>
            <p className={styles.emptySubtext}>Start a new conversation to begin</p>
          </div>
        ) : (
          <div className={styles.list}>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={styles.item}
                onClick={() => onConversationClick(conv.id)}
              >
                <div className={styles.title}>{conv.title}</div>
                <div className={styles.meta}>
                  {formatDistanceToNow(new Date(conv.startTime), { addSuffix: true })}
                </div>
                {conv.summaryPreview && (
                  <div className={styles.preview}>{conv.summaryPreview}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

