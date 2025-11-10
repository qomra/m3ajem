import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import type { MessageWithContexts } from '@/types/chat';

interface ChatMessageProps {
  message: MessageWithContexts;
  onContextPress?: (contextId: string) => void;
}

export function ChatMessage({ message, onContextPress }: ChatMessageProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const isUser = message.role === 'user';
  const hasContexts = message.contextIds && message.contextIds.length > 0;

  return (
    <View
      style={[
        styles.container,
        {
          alignItems: isUser ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      {/* Message bubble */}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.colors.primary : theme.colors.card,
            maxWidth: '80%',
          },
        ]}
      >
        {/* Role label */}
        <Text
          style={[
            styles.roleLabel,
            {
              color: isUser ? '#FFFFFF' : theme.colors.textSecondary,
              textAlign: isUser ? 'right' : 'left',
            },
          ]}
        >
          {isUser ? t('smart.you') : t('smart.assistant')}
        </Text>

        {/* Message content */}
        <Text
          style={[
            styles.content,
            {
              color: isUser ? '#FFFFFF' : theme.colors.text,
            },
          ]}
        >
          {message.content}
        </Text>

        {/* Context indicator */}
        {hasContexts && (
          <View
            style={[
              styles.contextIndicator,
              {
                backgroundColor: isUser
                  ? 'rgba(255, 255, 255, 0.2)'
                  : theme.colors.background,
                borderColor: isUser ? 'rgba(255, 255, 255, 0.3)' : theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name="link-outline"
              size={12}
              color={isUser ? '#FFFFFF' : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.contextText,
                {
                  color: isUser ? '#FFFFFF' : theme.colors.textSecondary,
                },
              ]}
            >
              {message.contextIds!.length} {t('smart.contextsAttached')}
            </Text>
          </View>
        )}

        {/* Timestamp */}
        <Text
          style={[
            styles.timestamp,
            {
              color: isUser ? 'rgba(255, 255, 255, 0.7)' : theme.colors.textTertiary,
            },
          ]}
        >
          {formatTimestamp(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    // Show time only
    return date.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } else {
    // Show date and time
    return date.toLocaleString('ar-SA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
  },
  contextIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  contextText: {
    fontSize: 11,
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },
});
