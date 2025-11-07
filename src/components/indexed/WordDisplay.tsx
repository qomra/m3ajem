import { View, Text, StyleSheet } from 'react-native';
import { useTheme, useTranslation } from '@hooks';

interface WordDisplayProps {
  word: string;
  root: string;
  dictionaryName: string;
  currentInstance?: number;
  totalInstances?: number;
}

export function WordDisplay({ word, root, dictionaryName, currentInstance, totalInstances }: WordDisplayProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <>
      {/* Word Display */}
      <View style={[styles.wordContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Text style={[styles.wordLabel, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
          {t('indexed.word')}
        </Text>
        <Text style={[styles.wordText, { color: theme.colors.primary, textAlign: 'center' }]}>{word}</Text>
      </View>

      {/* Root & Dictionary Info */}
      <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}> {root}</Text>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
            {t('dictionaries.root')}:
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.infoRow}>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}> {dictionaryName}</Text>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
            {t('dictionaries.dictionaryName')}:
          </Text>
        </View>
      </View>

      {/* Instance Counter (if multiple instances) */}
      {totalInstances && totalInstances > 1 && currentInstance !== undefined && (
        <View style={[styles.instanceCounter, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.instanceText, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
            {currentInstance + 1} / {totalInstances}
          </Text>
        </View>
      )}
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
