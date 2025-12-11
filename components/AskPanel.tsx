'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';
import styles from './AskPanel.module.css';

interface AskPanelProps {
  conversationId: string;
}

export default function AskPanel({ conversationId }: AskPanelProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!query.trim()) return;

    const userMessage = { role: 'user' as const, content: query };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        throw new Error('Failed to query conversation');
      }

      // Read the streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            if (line.startsWith('0:')) {
              // Parse the data chunk
              try {
                const json = JSON.parse(line.slice(2));
                if (json) {
                  aiResponse += json;
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      }

      if (aiResponse) {
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      }
    } catch (error) {
      console.error('Error querying conversation:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error processing your question.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <p>Ask questions about this conversation</p>
            <div className={styles.suggestions}>
              <button onClick={() => setQuery('What were the main topics discussed?')}>
                What were the main topics?
              </button>
              <button onClick={() => setQuery('Summarize the key decisions made')}>
                Key decisions made?
              </button>
              <button onClick={() => setQuery('What action items were mentioned?')}>
                What action items?
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`${styles.message} ${styles[msg.role]}`}>
              <div className={styles.messageLabel}>
                {msg.role === 'user' ? 'You' : 'AI'}
              </div>
              <div className={styles.messageContent}>{msg.content}</div>
            </div>
          ))
        )}
        {isLoading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.messageLabel}>AI</div>
            <div className={styles.messageContent}>
              <span className={styles.loading}>Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          className={styles.input}
          placeholder="Ask about this conversation..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!query.trim() || isLoading}
        >
          {isLoading ? '...' : 'Ask'}
        </button>
      </form>
    </div>
  );
}

