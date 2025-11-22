import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import { Source, SourceType, DictionarySource, WebSource, IndexedSource, SemanticSource } from '@/types/sources';

interface SourceBottomSheetProps {
  visible: boolean;
  sources: Source[];
  onClose: () => void;
  onNavigateToSource?: (source: Source) => void;
}

export function SourceBottomSheet({
  visible,
  sources,
  onClose,
  onNavigateToSource,
}: SourceBottomSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();


  const handleOpenURL = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const renderSource = (source: Source) => {
    console.log('Rendering source:', source.id, source.type);
    switch (source.type) {
      case SourceType.DICTIONARY: {
        const dictSource = source as DictionarySource;
        console.log('Dictionary source:', dictSource.root, dictSource.dictionaryName);
        return (
          <Pressable
            style={[styles.sourceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => onNavigateToSource?.(source)}
          >
            <View style={styles.sourceHeader}>
              <View style={[styles.sourceIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sourceTitle, { color: theme.colors.text }]}>
                  {dictSource.root}
                </Text>
                <Text style={[styles.sourceSubtitle, { color: theme.colors.textSecondary }]}>
                  {dictSource.dictionaryName}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
            </View>
            {dictSource.snippet && (
              <Text style={[styles.sourceSnippet, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                {dictSource.snippet}
              </Text>
            )}
          </Pressable>
        );
      }

      case SourceType.WEB: {
        const webSource = source as WebSource;
        return (
          <View
            style={[styles.sourceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          >
            <View style={styles.sourceHeader}>
              <View style={[styles.sourceIcon, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="globe-outline" size={20} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sourceTitle, { color: theme.colors.text }]} numberOfLines={2}>
                  {webSource.title}
                </Text>
                <Pressable onPress={() => handleOpenURL(webSource.url)}>
                  <Text style={[styles.sourceLink, { color: theme.colors.primary }]} numberOfLines={1}>
                    {webSource.url}
                  </Text>
                </Pressable>
              </View>
            </View>
            {webSource.snippet && (
              <Text style={[styles.sourceSnippet, { color: theme.colors.textSecondary }]} numberOfLines={3}>
                {webSource.snippet}
              </Text>
            )}
          </View>
        );
      }

      case SourceType.INDEXED: {
        const indexedSource = source as IndexedSource;
        return (
          <Pressable
            style={[styles.sourceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => onNavigateToSource?.(source)}
          >
            <View style={styles.sourceHeader}>
              <View style={[styles.sourceIcon, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="search-outline" size={20} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sourceTitle, { color: theme.colors.text }]}>
                  {indexedSource.word} → {indexedSource.root}
                </Text>
                <Text style={[styles.sourceSubtitle, { color: theme.colors.textSecondary }]}>
                  {indexedSource.dictionaryName}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
            </View>
          </Pressable>
        );
      }

      case SourceType.SEMANTIC: {
        const semanticSource = source as SemanticSource;
        return (
          <Pressable
            style={[styles.sourceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => onNavigateToSource?.(source)}
          >
            <View style={styles.sourceHeader}>
              <View style={[styles.sourceIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="bulb-outline" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sourceTitle, { color: theme.colors.text }]}>
                  {semanticSource.root}
                </Text>
                <Text style={[styles.sourceSubtitle, { color: theme.colors.textSecondary }]}>
                  {t('smart.sources.meaning')}: {semanticSource.meaning}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
            </View>
          </Pressable>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              {t('smart.sources.title')} ({sources.length})
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Sources List */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
          >
            {!sources || sources.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={48} color={theme.colors.textTertiary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  {t('smart.sources.noSources')}
                </Text>
              </View>
            ) : (
              <>
                {sources.map((source, index) => {
                  return (
                    <React.Fragment key={source.id}>
                      {renderSource(source)}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    flexGrow: 1,
  },
  sourceCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  sourceSubtitle: {
    fontSize: 14,
  },
  sourceLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  sourceSnippet: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});
