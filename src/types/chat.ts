import { APIProvider } from '@services/storage/apiKeyStorage';

export type MessageRole = 'user' | 'assistant' | 'system';
export type ContextType = 'definition' | 'root' | 'word';

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  provider: APIProvider;
  created_at: number;
  updated_at: number;
}

export interface ChatContext {
  id: string;
  conversation_id: string;
  type: ContextType;
  content: string;
  metadata: ContextMetadata;
  created_at: number;
}

export interface ContextMetadata {
  root?: string;
  word?: string;
  dictionaryName?: string;
}

export interface MessageWithContexts extends Message {
  contextIds?: string[];
}

export interface ConversationWithStats extends Conversation {
  messageCount?: number;
  lastMessage?: string;
}
