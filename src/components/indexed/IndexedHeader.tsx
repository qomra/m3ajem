import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { SearchBar } from '@components/common/SearchBar';
import { getFlexDirection } from '@/utils/rtl';
import { Ionicons } from '@expo/vector-icons';

interface IndexedHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  isGrouped: boolean;
  onToggleGrouped: () => void;
  isReverseSearch: boolean;
  onToggleReverseSearch: () => void;
}

export function IndexedHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
  isGrouped,
  onToggleGrouped,
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

      {/* Controls */}
      <View style={[styles.controls, { flexDirection: getFlexDirection() }]}>
        {/* View Mode Toggle */}
        <Pressable
          style={[styles.toggleButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          onPress={onToggleGrouped}
        >
          <Ionicons name={isGrouped ? 'list' : 'apps'} size={20} color={theme.colors.primary} />
          <Text style={[styles.toggleText, { color: theme.colors.text }]}>
            {isGrouped ? t('indexed.groupedByRoot') : t('indexed.ungrouped')}
          </Text>
        </Pressable>

        {/* Reverse Search Toggle */}
        <Pressable
          style={[
            styles.toggleButton,
            {
              backgroundColor: isReverseSearch ? theme.colors.primary : theme.colors.card,
              borderColor: theme.colors.primary,
            },
          ]}
          onPress={onToggleReverseSearch}
        >
          <Ionicons
            name="swap-horizontal"
            size={20}
            color={isReverseSearch ? theme.colors.background : theme.colors.primary}
          />
          <Text
            style={[
              styles.toggleText,
              { color: isReverseSearch ? theme.colors.background : theme.colors.text },
            ]}
          >
            {t('indexed.rhymeSearch')}
          </Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={t('indexed.searchPlaceholder')}
          onClear={onClearSearch}
        />
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
  controls: {
    gap: 8,
    marginBottom: 12,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: 0,
  },
});
