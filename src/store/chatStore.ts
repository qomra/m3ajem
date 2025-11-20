import { create } from 'zustand';
import * as SQLite from 'expo-sqlite';
import { ChatService } from '@services/chat/ChatService';
import { ChatRepository } from '@services/database/ChatRepository';
import { APIKeyStorage } from '@services/storage/apiKeyStorage';
import { TwoDatabaseMigrationRunner } from '@services/database/TwoDatabaseMigrationRunner';
import { OneTimeChatMigration } from '@services/database/OneTimeChatMigration';
import type {
  Conversation,
  ConversationWithStats,
  MessageWithContexts,
  ChatContext
} from '@/types/chat';
import type { APIConfig, APIProvider } from '@services/storage/apiKeyStorage';
import type { SQLiteDatabase } from 'expo-sqlite';

interface ChatState {
  // Database
  userDb: SQLiteDatabase | null;
  isUserDbInitialized: boolean;

  // Services
  chatService: ChatService | null;

  // UI State
  currentConversation: Conversation | null;
  conversations: ConversationWithStats[];
  messages: MessageWithContexts[];
  activeContexts: ChatContext[];
  isLoading: boolean;
  isSending: boolean;

  // Actions
  initializeChat: (dictionaryDb: SQLiteDatabase) => Promise<void>;
  loadConversations: () => Promise<void>;
  createNewConversation: (provider: APIProvider) => Promise<string>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  deleteAllConversations: () => Promise<void>;
  addContext: (context: ChatContext) => void;
  removeContext: (contextId: string) => void;
  clearActiveContexts: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  userDb: null,
  isUserDbInitialized: false,
  chatService: null,
  currentConversation: null,
  conversations: [],
  messages: [],
  activeContexts: [],
  isLoading: false,
  isSending: false,

  // Initialize chat service with separate user database
  initializeChat: async (dictionaryDb: SQLiteDatabase) => {
    try {
      console.log('Opening user database...');

      // Open user.db (stored in app's SQLite directory, not bundled with app)
      const userDb = await SQLite.openDatabaseAsync('user.db');

      // Run user database migrations (creates chat tables)
      console.log('Running user database migrations...');
      await TwoDatabaseMigrationRunner.runUserMigrations(userDb);

      // Run one-time migration to move chat data from dictionary.db to user.db
      // This only runs for existing users with old schema, fresh installs skip it
      await OneTimeChatMigration.migrate(dictionaryDb, userDb);

      // Create chat repository with user database
      const repository = new ChatRepository(userDb);

      // Create chat service with user db (for messages) and dictionary db (for dictionary lookups)
      const chatService = new ChatService(repository, dictionaryDb);

      set({
        userDb,
        isUserDbInitialized: true,
        chatService
      });
      console.log('✓ Chat service initialized with user database and dictionary agent');
    } catch (error) {
      console.error('Error initializing chat:', error);
      throw error;
    }
  },

  // Load all conversations
  loadConversations: async () => {
    const { chatService } = get();
    if (!chatService) return;

    set({ isLoading: true });

    try {
      const conversations = await chatService.conversationManager.getAllConversations();
      set({ conversations, isLoading: false });
      console.log(`Loaded ${conversations.length} conversations`);
    } catch (error) {
      console.error('Error loading conversations:', error);
      set({ isLoading: false });
    }
  },

  // Create a new conversation
  createNewConversation: async (provider: APIProvider) => {
    const { chatService } = get();
    if (!chatService) throw new Error('Chat service not initialized');

    try {
      // Create conversation with default title
      const conversation = await chatService.conversationManager.createConversation(
        'محادثة جديدة',
        provider
      );

      // Reload conversations list
      await get().loadConversations();

      // Select the new conversation
      await get().selectConversation(conversation.id);

      return conversation.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  },

  // Select and load a conversation
  selectConversation: async (conversationId: string) => {
    const { chatService } = get();
    if (!chatService) return;

    set({ isLoading: true });

    try {
      const conversation = await chatService.conversationManager.getConversation(conversationId);
      const messages = await chatService.getConversationMessages(conversationId);

      set({
        currentConversation: conversation,
        messages,
        isLoading: false,
        activeContexts: [],
      });
    } catch (error) {
      console.error('Error selecting conversation:', error);
      set({ isLoading: false });
    }
  },

  // Send a message
  sendMessage: async (content: string) => {
    const { chatService, currentConversation, activeContexts } = get();

    if (!chatService || !currentConversation) {
      throw new Error('No active conversation');
    }

    // Get context IDs
    const contextIds = activeContexts.map(ctx => ctx.id);

    // Create temporary user message for optimistic update
    const tempUserMessage: MessageWithContexts = {
      id: `temp_${Date.now()}`,
      conversation_id: currentConversation.id,
      role: 'user',
      content,
      timestamp: Date.now(),
      contextIds,
    };

    // Add user message to UI immediately (optimistic update)
    const currentMessages = get().messages;

    // Create temporary assistant message for progressive updates
    const tempAssistantMessage: MessageWithContexts = {
      id: `temp_assistant_${Date.now()}`,
      conversation_id: currentConversation.id,
      role: 'assistant',
      content: '', // Will be filled when complete
      timestamp: Date.now(),
      thoughts: [], // Will be updated progressively
      contextIds: [],
    };

    set({
      messages: [...currentMessages, tempUserMessage, tempAssistantMessage],
      isSending: true,
    });

    try {
      // Get API config
      const apiConfig = await APIKeyStorage.getAPIConfig();
      if (!apiConfig) {
        throw new Error('API configuration not found');
      }

      // Callback to update thoughts in real-time
      const handleThoughtUpdate = (thought: any) => {
        const currentState = get();
        const updatedMessages = currentState.messages.map(msg => {
          if (msg.id === tempAssistantMessage.id) {
            return {
              ...msg,
              thoughts: [...(msg.thoughts || []), thought],
            };
          }
          return msg;
        });
        set({ messages: updatedMessages });
      };

      // Send message (this will save user message to DB and get AI response)
      const { userMessage, assistantMessage } = await chatService.sendMessage(
        currentConversation.id,
        content,
        apiConfig,
        contextIds,
        handleThoughtUpdate // Pass the callback for real-time thought updates
      );

      // Replace temp message with real messages from DB
      const updatedMessages = [
        ...currentMessages,
        { ...userMessage, contextIds },
        { ...assistantMessage, contextIds: [] },
      ];

      // Update conversation title if this is the first message
      if (currentMessages.length === 0) {
        const title = chatService.conversationManager.generateTitle(content);
        await chatService.conversationManager.updateTitle(currentConversation.id, title);

        // Update conversation in state
        set({
          currentConversation: {
            ...currentConversation,
            title,
          },
        });
      }

      set({
        messages: updatedMessages,
        isSending: false,
        activeContexts: [], // Clear contexts after sending
      });

      // Reload conversations to update stats
      await get().loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      set({ isSending: false });
      throw error;
    }
  },

  // Delete a conversation
  deleteConversation: async (conversationId: string) => {
    const { chatService, currentConversation } = get();
    if (!chatService) return;

    try {
      await chatService.conversationManager.deleteConversation(conversationId);

      // If deleted conversation was current, clear it
      if (currentConversation?.id === conversationId) {
        set({ currentConversation: null, messages: [] });
      }

      // Reload conversations list
      await get().loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  },

  // Delete all conversations
  deleteAllConversations: async () => {
    const { chatService } = get();
    if (!chatService) return;

    try {
      await chatService.conversationManager.deleteAllConversations();

      set({
        currentConversation: null,
        conversations: [],
        messages: [],
        activeContexts: [],
      });
    } catch (error) {
      console.error('Error deleting all conversations:', error);
      throw error;
    }
  },

  // Add a context to active contexts
  addContext: (context: ChatContext) => {
    const { activeContexts } = get();

    // Check if context already exists
    if (activeContexts.some(ctx => ctx.id === context.id)) {
      return;
    }

    set({ activeContexts: [...activeContexts, context] });
  },

  // Remove a context from active contexts
  removeContext: (contextId: string) => {
    const { activeContexts } = get();
    set({ activeContexts: activeContexts.filter(ctx => ctx.id !== contextId) });
  },

  // Clear all active contexts
  clearActiveContexts: () => {
    set({ activeContexts: [] });
  },
}));
