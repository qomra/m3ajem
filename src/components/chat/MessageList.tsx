import React, { useRef, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { ChatMessage } from './ChatMessage';
import { EmptyState } from './EmptyState';
import type { MessageWithContexts } from '@/types/chat';

interface MessageListProps {
  messages: MessageWithContexts[];
  isLoading?: boolean;
  isSending?: boolean;
  onContextPress?: (contextId: string) => void;
}

export function MessageList({
  messages,
  isLoading = false,
  isSending = false,
  onContextPress,
}: MessageListProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new messages arrive or thoughts update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  if (isLoading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} onContextPress={onContextPress} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
