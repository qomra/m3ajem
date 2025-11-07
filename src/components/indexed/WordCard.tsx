import { Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@hooks';

interface WordCardProps {
  word: string;
  root: string;
  dictionaryName: string;
  onPress: () => void;
}

export function WordCard({ word, root, dictionaryName, onPress }: WordCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      style={[styles.wordCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      onPress={onPress}
    >
      <Text style={[styles.wordText, { color: theme.colors.text, textAlign: 'right' }]}>{word}</Text>
      <Text style={[styles.wordMeta, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
        {root} • {dictionaryName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wordCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
  },
  wordMeta: {
    fontSize: 14,
    marginTop: 4,
  },
});
