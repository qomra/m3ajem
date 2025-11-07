import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStore';
import { SearchBar } from '@components/common/SearchBar';
import { FilterModal } from '@components/modals/FilterModal';

interface GlobalSearchProps {
  onClose: () => void;
}

interface SearchResult {
  root: string;
  dictionaryName: string;
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { dictionaries, searchRoot } = useDictionaryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedDictionaries, setSelectedDictionaries] = useState<string[]>([]);

  const dictionaryNames = useMemo(() => dictionaries.map(d => d.name), [dictionaries]);

  // Search results
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const results = searchRoot(searchQuery.trim());

    // Filter by selected dictionaries if any
    if (selectedDictionaries.length > 0) {
      return results
        .filter(r => selectedDictionaries.includes(r.dictionary))
        .map(r => ({
          root: searchQuery.trim(),
          dictionaryName: r.dictionary,
        }));
    }

    return results.map(r => ({
      root: searchQuery.trim(),
      dictionaryName: r.dictionary,
    }));
  }, [searchQuery, selectedDictionaries, searchRoot]);

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleResultPress = (result: SearchResult) => {
    router.push({
      pathname: '/(tabs)/dictionaries/root',
      params: {
        root: result.root,
        dictionaryName: result.dictionaryName,
      },
    });
  };

  const handleFilterApply = (selected: string[]) => {
    setSelectedDictionaries(selected);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerActions}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeButtonText, { color: theme.colors.primary }]}>✕</Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowFilter(true)}
          >
            <Text style={[styles.filterButtonText, { color: theme.colors.background }]}>
              {t('common.filter')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('dictionaries.searchPlaceholder')}
            onClear={handleClearSearch}
            autoFocus
          />
        </View>
      </View>

      {/* Results */}
      <View style={styles.resultsContainer}>
        {searchQuery.trim() === '' ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {t('dictionaries.enterKeyword')}
            </Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>{t('common.noResults')}</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.resultsHeader, { color: theme.colors.textSecondary }]}>
              {t('dictionaries.searchResults')} ({searchResults.length})
            </Text>
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => `${item.root}-${item.dictionaryName}-${index}`}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.resultCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => handleResultPress(item)}
                >
                  <Text style={[styles.rootText, { color: theme.colors.text }]}>{item.root}</Text>
                  <Text style={[styles.dictionaryText, { color: theme.colors.textSecondary }]}>
                    {item.dictionaryName}
                  </Text>
                </Pressable>
              )}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilter}
        dictionaries={dictionaryNames}
        selectedDictionaries={selectedDictionaries}
        onApply={handleFilterApply}
        onClose={() => setShowFilter(false)}
      />
    </View>
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
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: 0,
  },
  resultsContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  resultsList: {
    padding: 16,
  },
  resultCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  rootText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dictionaryText: {
    fontSize: 14,
  },
});
