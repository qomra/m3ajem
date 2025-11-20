import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';

interface DictionaryRootModalProps {
  visible: boolean;
  root: string;
  dictionaryName: string;
  onClose: () => void;
}

export function DictionaryRootModal({
  visible,
  root,
  dictionaryName,
  onClose,
}: DictionaryRootModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { searchRootInDictionary } = useDictionaryStore();

  const [definition, setDefinition] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Load definition when modal opens
  useEffect(() => {
    if (visible) {
      loadDefinition();
    }
  }, [visible, root, dictionaryName]);

  const loadDefinition = async () => {
    setIsLoading(true);
    try {
      const def = await searchRootInDictionary(dictionaryName, root);
      setDefinition(def || '');
    } catch (error) {
      console.error('Error loading definition:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {t('dictionaries.title')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Fixed Content */}
        <View style={styles.fixedContent}>
          <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoValue, { color: theme.colors.primary, fontWeight: 'bold' }]}>
                {' '}{root}
              </Text>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                {t('dictionaries.root')}:
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {' '}{dictionaryName}
              </Text>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                {t('dictionaries.dictionaryName')}:
              </Text>
            </View>
          </View>
        </View>

        {/* Scrollable Definition */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.definitionScrollView}
            contentContainerStyle={styles.definitionScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.definitionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.definitionLabel, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
                {t('dictionaries.definition')}
              </Text>
              <Text style={[styles.definitionText, { color: theme.colors.text, textAlign: 'right' }]}>
                {definition.split('.').map((sentence, index, array) => {
                  const trimmed = sentence.trim();
                  return trimmed ? (index < array.length - 1 ? trimmed + '.\n\n' : trimmed) : '';
                }).join('')}
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  fixedContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  definitionScrollView: {
    flex: 1,
  },
  definitionScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  definitionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  definitionLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  definitionText: {
    fontSize: 18,
    lineHeight: 32,
  },
});
