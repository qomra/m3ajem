import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { getFlexDirection } from '@/utils/rtl';
import { Ionicons } from '@expo/vector-icons';

interface RootCardProps {
  root: string;
  dictionaryName: string;
  words: string[];
  wordCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onWordPress: (word: string) => void;
}

export function RootCard({
  root,
  wordCount,
  words,
  isExpanded,
  onToggleExpand,
  onWordPress,
}: RootCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      <Pressable
        style={[styles.rootCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        onPress={onToggleExpand}
      >
        <View style={[styles.rootHeader, { flexDirection: getFlexDirection() }]}>
          <View style={styles.rootInfo}>
            <Text style={[styles.rootText, { color: theme.colors.text, textAlign: 'right' }]}>{root}</Text>
            <Text style={[styles.wordCount, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
              {wordCount} {t('indexed.wordsInRoot')}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={theme.colors.primary}
          />
        </View>
      </Pressable>

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
    paddingLeft: 36,
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
