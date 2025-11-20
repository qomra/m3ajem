import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { SearchBar } from '@components/common/SearchBar';
import { Ionicons } from '@expo/vector-icons';

interface IndexedHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  isReverseSearch: boolean;
  onToggleReverseSearch: () => void;
}

export function IndexedHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
  isReverseSearch,
  onToggleReverseSearch,
}: IndexedHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.title, { color: theme.colors.text, textAlign: 'right' }]}>
        {t('indexed.title')}
      </Text>

      {/* Search Bar with Rhyme Search Button */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          {/* Reverse Search Toggle - on the left */}
          <Pressable
            style={[
              styles.rhymeButton,
              {
                backgroundColor: isReverseSearch ? theme.colors.primary : theme.colors.card,
                borderColor: theme.colors.primary,
              },
            ]}
            onPress={onToggleReverseSearch}
          >
            <Text
              style={[
                styles.rhymeButtonText,
                { color: isReverseSearch ? theme.colors.background : theme.colors.primary },
              ]}
            >
              {t('indexed.rhymeSearch')}
            </Text>
            <Ionicons
              name="swap-horizontal"
              size={18}
              color={isReverseSearch ? theme.colors.background : theme.colors.primary}
            />
          </Pressable>

          {/* Search Bar - on the right */}
          <View style={styles.searchBarWrapper}>
            <SearchBar
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder={t('indexed.searchPlaceholder')}
              onClear={onClearSearch}
            />
          </View>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 0,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchBarWrapper: {
    flex: 1,
  },
  rhymeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  rhymeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
