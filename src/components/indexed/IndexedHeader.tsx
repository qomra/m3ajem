import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { useTheme, useTranslation } from '@hooks';
import { SearchBar } from '@components/common/SearchBar';
import { Ionicons } from '@expo/vector-icons';

interface IndexedHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  isReverseSearch: boolean;
  onToggleReverseSearch: () => void;
  sortBy: 'alphabetical' | 'longest' | 'shortest' | 'random';
  onSortChange: (sortBy: 'alphabetical' | 'longest' | 'shortest' | 'random') => void;
}

export function IndexedHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
  isReverseSearch,
  onToggleReverseSearch,
  sortBy,
  onSortChange,
}: IndexedHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [showSort, setShowSort] = useState(false);

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

      {/* Sort Button */}
      <View style={styles.sortButtonContainer}>
        <Pressable
          style={[styles.sortButton, { backgroundColor: theme.colors.background }]}
          onPress={() => setShowSort(!showSort)}
        >
          <Text style={[styles.sortButtonText, { color: theme.colors.primary }]}>
            {t('indexed.sortBy')}
          </Text>
          <Ionicons name="swap-vertical" size={20} color={theme.colors.primary} />
        </Pressable>
      </View>

      {/* Sort Options */}
      {showSort && (
        <View style={styles.sortContainer}>
          <View style={[styles.sortOptions, { flexDirection: 'row-reverse' }]}>
            <Pressable
              style={[
                styles.sortOption,
                { backgroundColor: sortBy === 'alphabetical' ? theme.colors.primary : theme.colors.background },
              ]}
              onPress={() => onSortChange('alphabetical')}
            >
              <Text style={[
                styles.sortOptionText,
                { color: sortBy === 'alphabetical' ? '#fff' : theme.colors.text }
              ]}>
                {t('indexed.alphabetical')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.sortOption,
                { backgroundColor: sortBy === 'longest' ? theme.colors.primary : theme.colors.background },
              ]}
              onPress={() => onSortChange('longest')}
            >
              <Text style={[
                styles.sortOptionText,
                { color: sortBy === 'longest' ? '#fff' : theme.colors.text }
              ]}>
                {t('indexed.longest')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.sortOption,
                { backgroundColor: sortBy === 'shortest' ? theme.colors.primary : theme.colors.background },
              ]}
              onPress={() => onSortChange('shortest')}
            >
              <Text style={[
                styles.sortOptionText,
                { color: sortBy === 'shortest' ? '#fff' : theme.colors.text }
              ]}>
                {t('indexed.shortest')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.sortOption,
                { backgroundColor: sortBy === 'random' ? theme.colors.primary : theme.colors.background },
              ]}
              onPress={() => onSortChange('random')}
            >
              <Text style={[
                styles.sortOptionText,
                { color: sortBy === 'random' ? '#fff' : theme.colors.text }
              ]}>
                {t('indexed.random')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
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
  sortButtonContainer: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sortContainer: {
    marginTop: 12,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sortOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
