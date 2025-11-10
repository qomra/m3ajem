import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import type { ConversationWithStats } from '@/types/chat';

interface ConversationListProps {
  conversations: ConversationWithStats[];
  currentConversationId?: string;
  onSelect: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
}

export function ConversationList({
  conversations,
  currentConversationId,
  onSelect,
  onDelete,
}: ConversationListProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const handleDelete = (conversationId: string, title: string) => {
    Alert.alert(
      t('smart.deleteConversation'),
      t('smart.confirmDeleteConversation'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.apply'),
          style: 'destructive',
          onPress: () => onDelete(conversationId),
        },
      ]
    );
  };

  if (conversations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.textTertiary} />
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          {t('smart.noMessages')}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [
            styles.item,
            {
              backgroundColor:
                item.id === currentConversationId
                  ? theme.colors.primary + '20'
                  : pressed
                  ? theme.colors.background
                  : theme.colors.card,
              borderBottomColor: theme.colors.border,
            },
          ]}
          onPress={() => onSelect(item.id)}
        >
          <View style={styles.itemContent}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.colors.text,
                    fontWeight: item.id === currentConversationId ? '600' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>

              {item.lastMessage && (
                <Text
                  style={[styles.lastMessage, { color: theme.colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.lastMessage}
                </Text>
              )}

              <Text style={[styles.metadata, { color: theme.colors.textTertiary }]}>
                {formatDate(item.updated_at)} • {item.messageCount} {t('smart.noMessages')}
              </Text>
            </View>

            <Pressable
              onPress={() => handleDelete(item.id, item.title)}
              style={styles.deleteButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
        </Pressable>
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'أمس';
  }

  return date.toLocaleDateString('ar-SA', {
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 13,
    marginBottom: 4,
  },
  metadata: {
    fontSize: 11,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});
