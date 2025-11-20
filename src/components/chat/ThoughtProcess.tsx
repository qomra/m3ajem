import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import type { AgentThought } from '@agents/BaseAgent';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ThoughtProcessProps {
  thoughts: AgentThought[];
  duration?: number;
}

export function ThoughtProcess({ thoughts, duration }: ThoughtProcessProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (thoughts.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((prev) => !prev);
  };

  // Get tool name in Arabic
  const getToolNameArabic = (toolName: string): string => {
    const toolNames: Record<string, string> = {
      search_dictionary: 'البحث في معجم',
      search_all_dictionaries: 'البحث في جميع المعاجم',
      search_word_by_meaning: 'البحث الدلالي',
      search_web: 'البحث في الإنترنت',
    };
    return toolNames[toolName] || toolName;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
      {/* Header - clickable to expand/collapse all */}
      <Pressable style={styles.header} onPress={toggleExpanded}>
        <View style={styles.headerLeft}>
          <Ionicons name="list-outline" size={16} color={theme.colors.primary} />
          <Text style={[styles.headerText, { color: theme.colors.text }]}>
            {t('smart.thoughtProcess.title')} ({thoughts.length})
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textSecondary}
        />
      </Pressable>

      {/* Thoughts */}
      {isExpanded && thoughts.map((thought, index) => {
        return (
          <View
            key={index}
            style={[
              styles.thoughtContainer,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Thought Header */}
            <View style={styles.thoughtHeader}>
              <View style={styles.thoughtHeaderLeft}>
                <View
                  style={[
                    styles.iterationBadge,
                    { backgroundColor: theme.colors.primary + '20' },
                  ]}
                >
                  <Text style={[styles.iterationText, { color: theme.colors.primary }]}>
                    {thought.iteration}
                  </Text>
                </View>
                <Text
                  style={[styles.toolsText, { color: theme.colors.textSecondary }]}
                >
                  {thought.toolCalls.map((tool) => getToolNameArabic(tool)).join(' • ')}
                </Text>
              </View>
            </View>

            {/* Thought Content */}
            <Text
              style={[
                styles.thoughtContent,
                { color: theme.colors.textSecondary, borderTopColor: theme.colors.border, fontStyle: 'italic' },
              ]}
            >
              {thought.content}
            </Text>
          </View>
        );
      })}

      {/* Duration */}
      {duration !== undefined && (
        <View style={styles.durationContainer}>
          <Ionicons name="time-outline" size={12} color={theme.colors.textTertiary} />
          <Text style={[styles.durationText, { color: theme.colors.textTertiary }]}>
            المدة: {(duration / 1000).toFixed(2)} ثانية
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  thoughtContainer: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  thoughtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  thoughtHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  iterationBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iterationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toolsText: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  thoughtContent: {
    padding: 10,
    paddingTop: 8,
    fontSize: 12,
    lineHeight: 18,
    borderTopWidth: 1,
    textAlign: 'right',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  durationText: {
    fontSize: 11,
  },
});
