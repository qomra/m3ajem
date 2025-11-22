import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation, useTheme } from '@hooks';
import { useChatStore } from '@store/chatStore';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import { APIKeyStorage } from '@services/storage/apiKeyStorage';
import { GatewayAuthService } from '@services/auth/GatewayAuthService';
import { MessageList } from '@components/chat/MessageList';
import { ChatInput, ChatInputRef } from '@components/chat/ChatInput';
import { ContextIndicator } from '@components/chat/ContextIndicator';
import { ChatHeader } from '@components/chat/ChatHeader';
import { ConversationsModal } from '@components/chat/ConversationsModal';
import { ProviderSelectorModal } from '@components/chat/ProviderSelectorModal';
import { ResourceManagerModal } from '@components/resources/ResourceManagerModal';
import { AuthModeSelector } from '@components/auth/AuthModeSelector';
import type { APIProvider } from '@services/storage/apiKeyStorage';
import { useRouter, useFocusEffect } from 'expo-router';

export default function SmartScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  // Database
  const { db, isInitialized } = useDictionaryStore();

  // Chat store
  const {
    chatService,
    currentConversation,
    conversations,
    messages,
    activeContexts,
    isLoading,
    isSending,
    initializeChat,
    loadConversations,
    createNewConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    removeContext,
    clearActiveContexts,
  } = useChatStore();

  // UI state
  const [showConversations, setShowConversations] = useState(false);
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [showAuthSelector, setShowAuthSelector] = useState(false);
  const [hasAPIKey, setHasAPIKey] = useState(false);
  const [hasGatewayAuth, setHasGatewayAuth] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<APIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<APIProvider>('groq');
  const [rateLimitInfo, setRateLimitInfo] = useState<{ current: number; limit: number } | null>(null);
  const inputRef = useRef<ChatInputRef>(null);

  // Initialize chat service
  useEffect(() => {
    if (db && isInitialized && !chatService) {
      initializeChat(db);
    }
  }, [db, isInitialized, chatService]);

  // Load API configuration on mount
  useEffect(() => {
    loadAPIConfig();
  }, []);

  // Reload API configuration when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadAPIConfig();
    }, [])
  );

  // Load conversations when chat service is ready
  useEffect(() => {
    if (chatService) {
      loadConversations();
    }
  }, [chatService]);

  const loadAPIConfig = async () => {
    try {
      // Get available providers
      const providers: APIProvider[] = [];

      // Check for API keys
      const allConfigs = await APIKeyStorage.getAllConfigs();

      if (allConfigs) {
        setHasAPIKey(true);
        setSelectedProvider(allConfigs.currentProvider);

        if (allConfigs.openai) providers.push('openai');
        if (allConfigs.anthropic) providers.push('anthropic');
        if (allConfigs.groq) providers.push('groq');
        if (allConfigs.google) providers.push('google');
      } else {
        setHasAPIKey(false);
      }

      // Check for gateway authentication (local check only, no network request)
      const isGatewayAuth = await GatewayAuthService.isAuthenticated();
      setHasGatewayAuth(isGatewayAuth);

      if (isGatewayAuth) {
        providers.push('gateway');
        // Don't fetch user info here - it requires network
        // Rate limit will be shown when user actually sends a message
        // or they can check it in settings
      } else {
        setRateLimitInfo(null);
      }

      setAvailableProviders(providers);

    } catch (error) {
      console.error('Error loading API config:', error);
      setHasAPIKey(false);
      setHasGatewayAuth(false);
      setRateLimitInfo(null);
    }
  };

  const handleNewConversation = async () => {
    // Check if user has either API key or gateway auth
    if (!hasAPIKey && !hasGatewayAuth) {
      setShowAuthSelector(true);
      return;
    }

    try {
      // Use gateway if authenticated, otherwise use selected provider
      const provider = hasGatewayAuth ? 'gateway' : selectedProvider;
      await createNewConversation(provider as any);
      setShowConversations(false);
      // Auto-focus input after creating conversation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert(t('common.error'), t('errors.unexpectedError'));
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    await selectConversation(conversationId);
    setShowConversations(false);
  };

  const handleInputFocus = async () => {
    // Check if user has either API key or gateway auth
    if (!hasAPIKey && !hasGatewayAuth) {
      setShowAuthSelector(true);
      return;
    }

    // Auto-create conversation if none exists and auth is configured
    if (!currentConversation && (hasAPIKey || hasGatewayAuth) && chatService) {
      try {
        const provider = hasGatewayAuth ? 'gateway' : selectedProvider;
        await createNewConversation(provider as any);
      } catch (error) {
        console.error('Error auto-creating conversation:', error);
      }
    }
  };

  const handleAuthSuccess = async () => {
    setShowAuthSelector(false);
    // Reload config to detect gateway auth
    await loadAPIConfig();
    // Auto-create conversation
    if (chatService) {
      try {
        await createNewConversation('gateway' as any);
        // Auto-focus input
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } catch (error) {
        console.error('Error creating conversation after auth:', error);
      }
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!currentConversation || (!hasAPIKey && !hasGatewayAuth)) return;

    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert(t('common.error'), t('errors.chatError'));
    }
  };

  const handleProviderSelect = async (provider: APIProvider) => {
    setSelectedProvider(provider);

    // Update current provider in storage
    try {
      const allConfigs = await APIKeyStorage.getAllConfigs();
      if (allConfigs) {
        allConfigs.currentProvider = provider;
        await APIKeyStorage.saveAllConfigs(allConfigs);
      }
    } catch (error) {
      console.error('Error updating provider:', error);
    }

    setShowProviderSelector(false);
  };

  // Show loading while initializing
  if (!isInitialized || !chatService) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ChatHeader
          currentConversation={currentConversation}
          hasAPIKey={hasAPIKey}
          availableProviders={availableProviders}
          hasMessages={messages.length > 0}
          rateLimitInfo={rateLimitInfo}
          onNewConversation={handleNewConversation}
          onShowConversations={() => setShowConversations(true)}
          onShowProviderSelector={() => setShowProviderSelector(true)}
          onShowResources={() => setShowResources(true)}
        />

        <ContextIndicator
          contexts={activeContexts}
          onRemove={removeContext}
          onClearAll={clearActiveContexts}
        />

        <MessageList messages={messages} isLoading={isLoading} isSending={isSending} />

        <ChatInput
          ref={inputRef}
          onSend={handleSendMessage}
          onFocus={handleInputFocus}
          isSending={isSending}
          disabled={!hasAPIKey && !hasGatewayAuth}
        />
      </KeyboardAvoidingView>

      <ConversationsModal
        visible={showConversations}
        conversations={conversations}
        currentConversationId={currentConversation?.id}
        onClose={() => setShowConversations(false)}
        onSelect={handleSelectConversation}
        onDelete={deleteConversation}
      />

      <ProviderSelectorModal
        visible={showProviderSelector}
        selectedProvider={selectedProvider}
        availableProviders={availableProviders}
        onClose={() => setShowProviderSelector(false)}
        onSelect={handleProviderSelect}
      />

      <ResourceManagerModal
        visible={showResources}
        onClose={() => setShowResources(false)}
      />

      <AuthModeSelector
        visible={showAuthSelector}
        onClose={() => setShowAuthSelector(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});
