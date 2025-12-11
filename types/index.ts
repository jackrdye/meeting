export interface Conversation {
  id: string
  userId?: string
  title: string
  createdAt: string
  endTime?: string
  duration?: number
  status: 'active' | 'completed'
  transcripts: Message[]
  summary?: string
  keyPoints?: string[]
  actionItems?: string[]
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  audioUrl?: string
  timestamp: string
  isFinal?: boolean
  speaker?: string
}

export interface Insight {
  id: string
  userId?: string
  content: string
  type: 'action' | 'theme' | 'highlight'
  conversationIds: string[]
  createdAt: string
}

export interface SummaryData {
  summary: string
  keyPoints: string[]
  actionItems: string[]
}

export interface ConversationListItem {
  id: string
  title: string
  startTime: string
  endTime?: string
  summaryPreview?: string
}

