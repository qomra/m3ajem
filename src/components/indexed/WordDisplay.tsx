import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, useTranslation } from '@hooks';

interface WordDisplayProps {
  word: string;
  root: string;
  dictionaryName: string;
  currentInstance?: number;
  totalInstances?: number;
  highlightMode?: 'word' | 'root';
  onRootPress?: () => void;
}

export function WordDisplay({ word, root, dictionaryName, currentInstance, totalInstances, highlightMode, onRootPress }: WordDisplayProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <>
      {/* Combined Word, Root & Dictionary Info */}
      <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoValue, { color: theme.colors.primary, fontWeight: 'bold' }]}> {word}</Text>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
            {t('indexed.word')}:
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <Pressable onPress={onRootPress} style={styles.infoRow}>
          <Text
            style={[
              styles.infoValue,
              {
                color: highlightMode === 'root' ? theme.colors.primary : theme.colors.text,
                fontWeight: highlightMode === 'root' ? 'bold' : 'normal',
              }
            ]}
          >
            {' '}{root}
          </Text>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
            {t('dictionaries.root')}:
          </Text>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.infoRow}>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}> {dictionaryName}</Text>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
            {t('dictionaries.dictionaryName')}:
          </Text>
        </View>
      </View>

      {/* Instance Counter (if multiple instances) */}
      {totalInstances && totalInstances > 1 && currentInstance !== undefined ? (
        <View style={[styles.instanceCounter, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.instanceText, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
            {`${currentInstance + 1} / ${totalInstances}`}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wordContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  wordLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  wordText: {
    fontSize: 32,
    fontWeight: 'bold',
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
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  instanceCounter: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 16,
  },
  instanceText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
