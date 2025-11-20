import { APIProvider } from '@services/storage/apiKeyStorage';
import type { Source } from './sources';
import type { AgentThought } from '@agents/BaseAgent';

export type MessageRole = 'user' | 'assistant' | 'system';
export type ContextType = 'definition' | 'root' | 'word';

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  sources?: Source[]; // Sources referenced in this message
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
  thoughts?: AgentThought[]; // LLM reasoning steps (stored in DB as JSON)
  duration?: number; // Response duration in milliseconds (stored in DB)
}

export interface ConversationWithStats extends Conversation {
  messageCount?: number;
  lastMessage?: string;
}
