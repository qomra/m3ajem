import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import type { ChatContext } from '@/types/chat';

interface ContextIndicatorProps {
  contexts: ChatContext[];
  onRemove: (contextId: string) => void;
  onClearAll: () => void;
}

export function ContextIndicator({ contexts, onRemove, onClearAll }: ContextIndicatorProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (contexts.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="link-outline" size={16} color={theme.colors.primary} />
          <Text style={[styles.headerText, { color: theme.colors.text }]}>
            {contexts.length} {t('smart.contextsAttached')}
          </Text>
        </View>

        <Pressable onPress={onClearAll} style={styles.clearButton}>
          <Text style={[styles.clearText, { color: theme.colors.primary }]}>
            {t('smart.clearAllContexts')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.contextsContainer}
      >
        {contexts.map((context) => (
          <View
            key={context.id}
            style={[
              styles.contextChip,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.contextType, { color: theme.colors.textSecondary }]}
                numberOfLines={1}
              >
                {getContextTypeLabel(context.type, t)}
              </Text>
              <Text style={[styles.contextContent, { color: theme.colors.text }]} numberOfLines={1}>
                {getContextLabel(context)}
              </Text>
            </View>

            <Pressable
              onPress={() => onRemove(context.id)}
              style={styles.removeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function getContextTypeLabel(type: string, t: any): string {
  switch (type) {
    case 'definition':
      return t('smart.contextType.definition');
    case 'root':
      return t('smart.contextType.root');
    case 'word':
      return t('smart.contextType.word');
    default:
      return type;
  }
}

function getContextLabel(context: ChatContext): string {
  switch (context.type) {
    case 'definition':
      return `${context.metadata.root} - ${context.metadata.dictionaryName}`;
    case 'root':
      return `${context.metadata.root} - ${context.metadata.dictionaryName}`;
    case 'word':
      return `${context.metadata.word} - ${context.metadata.root}`;
    default:
      return context.content.substring(0, 30);
  }
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  clearButton: {
    padding: 4,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contextsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 200,
  },
  contextType: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  contextContent: {
    fontSize: 13,
    fontWeight: '500',
  },
  removeButton: {
    marginLeft: 8,
  },
});
