import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@hooks';
import { Ionicons } from '@expo/vector-icons';

interface WordHeaderProps {
  onBackPress: () => void;
  highlightEnabled: boolean;
  onToggleHighlight: () => void;
  relatedWordsCount: number;
  onShowRelatedWords: () => void;
}

export function WordHeader({
  onBackPress,
  highlightEnabled,
  onToggleHighlight,
  relatedWordsCount,
  onShowRelatedWords,
}: WordHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
      <View style={[styles.headerTop, { flexDirection: 'row' }]}>
        <Pressable style={styles.backButton} onPress={onBackPress}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>←</Text>
        </Pressable>

        <View style={styles.headerActions}>
          {/* Related Words */}
          {relatedWordsCount > 1 && (
            <Pressable
              style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}
              onPress={onShowRelatedWords}
            >
              <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
            </Pressable>
          )}

          {/* Toggle Highlight */}
          <Pressable
            style={[
              styles.iconButton,
              {
                backgroundColor: highlightEnabled ? theme.colors.primary : theme.colors.card,
                borderColor: theme.colors.primary,
              },
            ]}
            onPress={onToggleHighlight}
          >
            <Ionicons
              name="color-wand-outline"
              size={20}
              color={highlightEnabled ? theme.colors.background : theme.colors.primary}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTop: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
});
