import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { Ionicons } from '@expo/vector-icons';

interface RootCardProps {
  root: string;
  dictionaryName: string;
  words: string[];
  wordCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onWordPress: (word: string) => void;
  onRootPress?: () => void; // Navigate to root mode
}

export function RootCard({
  root,
  wordCount,
  words,
  isExpanded,
  onToggleExpand,
  onWordPress,
  onRootPress,
}: RootCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      <View
        style={[styles.rootCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      >
        <View style={[styles.rootHeader, { flexDirection: 'row' }]}>
          {/* Chevron - Click to expand/collapse */}
          <Pressable onPress={onToggleExpand} style={styles.chevronButton}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={theme.colors.primary}
            />
          </Pressable>

          {/* Root Info - Click to navigate to root mode */}
          <Pressable style={styles.rootInfo} onPress={onRootPress}>
            <Text style={[styles.rootText, { color: theme.colors.text, textAlign: 'right' }]}>{root}</Text>
            <Text style={[styles.wordCount, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
              {wordCount} {t('indexed.wordsInRoot')}
            </Text>
          </Pressable>
        </View>
      </View>

      {isExpanded && (
        <View style={styles.wordsList}>
          {words.map((word, index) => (
            <Pressable
              key={index}
              style={[
                styles.wordItem,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
              ]}
              onPress={() => onWordPress(word)}
            >
              <Text style={[styles.wordText, { color: theme.colors.text, textAlign: 'right' }]}>{word}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  rootHeader: {
    alignItems: 'center',
    gap: 12,
  },
  chevronButton: {
    padding: 4,
  },
  rootInfo: {
    flex: 1,
  },
  rootText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 14,
  },
  wordsList: {
    marginTop: 12,
    marginBottom: 12,
    paddingRight: 36,
    gap: 6,
  },
  wordItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
