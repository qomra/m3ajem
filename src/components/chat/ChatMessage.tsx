import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import type { MessageWithContexts } from '@/types/chat';
import { SourceBottomSheet } from './SourceBottomSheet';
import { ThoughtProcess } from './ThoughtProcess';
import { IndexedWordModal } from './IndexedWordModal';
import { DictionaryRootModal } from './DictionaryRootModal';
import type { Source, SourceType } from '@/types/sources';

interface ChatMessageProps {
  message: MessageWithContexts;
  onContextPress?: (contextId: string) => void;
}

export function ChatMessage({ message, onContextPress }: ChatMessageProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { checkRootExists, checkWordExists } = useDictionaryStore();

  const isUser = message.role === 'user';
  const hasContexts = message.contextIds && message.contextIds.length > 0;
  const hasSources = message.sources && message.sources.length > 0;

  const [showSources, setShowSources] = useState(false);
  const [showIndexedWord, setShowIndexedWord] = useState(false);
  const [showDictionaryRoot, setShowDictionaryRoot] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  const handleNavigateToSource = async (source: Source) => {
    // Close the source modal first
    setShowSources(false);

    try {
      // Open modal based on source type (stay within chat context)
      switch (source.type) {
        case 'dictionary': {
          if (!('root' in source) || !('dictionaryName' in source)) return;

          // Check if root still exists in dictionary
          const exists = await checkRootExists(source.dictionaryName, source.root);

          if (!exists) {
            Alert.alert(
              t('smart.sources.sourceUnavailable'),
              t('smart.sources.sourceUnavailableMessage'),
              [{ text: t('common.ok'), style: 'default' }]
            );
            return;
          }

          // Show dictionary root modal (stays in chat)
          setSelectedSource(source);
          setShowDictionaryRoot(true);
          break;
        }

        case 'indexed': {
          if (!('word' in source) || !('root' in source) || !('dictionaryName' in source)) return;

          // Show indexed word modal (stays in chat)
          setSelectedSource(source);
          setShowIndexedWord(true);
          break;
        }

        case 'semantic': {
          if (!('root' in source)) return;

          // Check if root still exists (semantic search is only for Lisan al-Arab)
          const exists = await checkRootExists('لسان العرب', source.root);

          if (!exists) {
            Alert.alert(
              t('smart.sources.sourceUnavailable'),
              t('smart.sources.sourceUnavailableMessage'),
              [{ text: t('common.ok'), style: 'default' }]
            );
            return;
          }

          // Show dictionary root modal for semantic source
          // Create a minimal source object with required fields
          setSelectedSource({
            ...source,
            type: 'dictionary',
            dictionaryName: 'لسان العرب',
            definition: '', // Will be loaded by modal
          } as any);
          setShowDictionaryRoot(true);
          break;
        }

        // Web sources don't navigate (they're handled by Linking.openURL in SourceBottomSheet)
        default:
          break;
      }
    } catch (error) {
      console.error('Error navigating to source:', error);
      Alert.alert(
        t('common.error'),
        t('smart.sources.navigationError'),
        [{ text: t('common.ok'), style: 'default' }]
      );
    }
  };

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

        {/* Message content or loading indicator */}
        {message.content ? (
          <Text
            style={[
              styles.content,
              {
                color: isUser ? '#FFFFFF' : theme.colors.text,
                textAlign: 'right', // Both user and assistant messages are RTL (Arabic)
              },
            ]}
          >
            {message.content}
          </Text>
        ) : !isUser && message.thoughts && message.thoughts.length > 0 ? (
          // Show thinking indicator when no content yet but thoughts are streaming
          <View style={styles.thinkingContainer}>
            <Ionicons name="search-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.thinkingText, { color: theme.colors.textSecondary }]}>
              {t('smart.thinking')}...
            </Text>
          </View>
        ) : !isUser ? (
          // Show loading dots when no content and no thoughts yet
          <View style={styles.loadingDots}>
            <View style={[styles.dot, { backgroundColor: theme.colors.textSecondary }]} />
            <View style={[styles.dot, { backgroundColor: theme.colors.textSecondary }]} />
            <View style={[styles.dot, { backgroundColor: theme.colors.textSecondary }]} />
          </View>
        ) : null}

        {/* Thought Process (for assistant messages with thoughts) */}
        {!isUser && message.thoughts && message.thoughts.length > 0 && (
          <ThoughtProcess thoughts={message.thoughts} duration={message.duration} />
        )}

        {/* Sources indicator */}
        {hasSources && (
          <Pressable
            style={[
              styles.sourcesBadge,
              {
                backgroundColor: isUser
                  ? 'rgba(255, 255, 255, 0.2)'
                  : theme.colors.background,
                borderColor: isUser ? 'rgba(255, 255, 255, 0.3)' : theme.colors.border,
              },
            ]}
            onPress={() => setShowSources(true)}
          >
            <Ionicons
              name="document-text-outline"
              size={12}
              color={isUser ? '#FFFFFF' : theme.colors.primary}
            />
            <Text
              style={[
                styles.sourcesText,
                {
                  color: isUser ? '#FFFFFF' : theme.colors.primary,
                },
              ]}
            >
              {message.sources!.length} {message.sources!.length === 1 ? t('smart.sources.source') : t('smart.sources.sources')}
            </Text>
          </Pressable>
        )}

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

      {/* Sources Bottom Sheet */}
      {hasSources && (
        <SourceBottomSheet
          visible={showSources}
          sources={message.sources!}
          onClose={() => setShowSources(false)}
          onNavigateToSource={handleNavigateToSource}
        />
      )}

      {/* Indexed Word Modal */}
      {selectedSource && selectedSource.type === 'indexed' && 'word' in selectedSource && (
        <IndexedWordModal
          visible={showIndexedWord}
          word={selectedSource.word}
          root={selectedSource.root}
          dictionaryName={selectedSource.dictionaryName}
          onClose={() => {
            setShowIndexedWord(false);
            setSelectedSource(null);
          }}
        />
      )}

      {/* Dictionary Root Modal */}
      {selectedSource &&
        (selectedSource.type === 'dictionary' || selectedSource.type === 'semantic') &&
        'root' in selectedSource &&
        'dictionaryName' in selectedSource && (
        <DictionaryRootModal
          visible={showDictionaryRoot}
          root={selectedSource.root}
          dictionaryName={selectedSource.dictionaryName}
          onClose={() => {
            setShowDictionaryRoot(false);
            setSelectedSource(null);
          }}
        />
      )}
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
  sourcesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sourcesText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
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
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  thinkingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.6,
  },
});
