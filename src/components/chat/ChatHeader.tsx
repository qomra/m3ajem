import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import type { Conversation } from '@/types/chat';
import type { APIProvider } from '@services/storage/apiKeyStorage';

interface ChatHeaderProps {
  currentConversation: Conversation | null;
  hasAPIKey: boolean;
  availableProviders: APIProvider[];
  hasMessages: boolean;
  onNewConversation: () => void;
  onShowConversations: () => void;
  onShowProviderSelector: () => void;
  onShowResources: () => void;
}

export function ChatHeader({
  currentConversation,
  hasAPIKey,
  availableProviders,
  hasMessages,
  onNewConversation,
  onShowConversations,
  onShowProviderSelector,
  onShowResources,
}: ChatHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {currentConversation?.title || t('smart.title')}
        </Text>
        {currentConversation && (
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {t(`settings.apiConfig.model.${currentConversation.provider}`)}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {/* Resources button */}
        <Pressable onPress={onShowResources} style={styles.headerButton}>
          <Ionicons name="cube-outline" size={24} color={theme.colors.text} />
        </Pressable>

        {/* Provider selector button */}
        {hasAPIKey && availableProviders.length > 1 && (
          <Pressable onPress={onShowProviderSelector} style={styles.headerButton}>
            <Ionicons name="swap-horizontal-outline" size={24} color={theme.colors.text} />
          </Pressable>
        )}

        {/* Conversations list button */}
        <Pressable onPress={onShowConversations} style={styles.headerButton}>
          <Ionicons name="chatbubbles-outline" size={24} color={theme.colors.text} />
        </Pressable>

        {/* New conversation button - disabled if current conversation has no messages */}
        <Pressable
          onPress={onNewConversation}
          style={styles.headerButton}
          disabled={!hasMessages}
        >
          <Ionicons
            name="add-outline"
            size={24}
            color={hasMessages ? theme.colors.text : theme.colors.textTertiary}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerButton: {
    padding: 4,
  },
});
