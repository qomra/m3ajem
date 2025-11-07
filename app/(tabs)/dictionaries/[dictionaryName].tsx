import { View, Text, StyleSheet, Pressable, FlatList, StatusBar } from 'react-native';
import { useState, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStore';
import { SearchBar } from '@components/common/SearchBar';

export default function DictionaryDetail() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { dictionaryName } = useLocalSearchParams<{ dictionaryName: string }>();

  const { dictionaries } = useDictionaryStore();

  const [searchQuery, setSearchQuery] = useState('');

  // Find the dictionary
  const dictionary = useMemo(
    () => dictionaries.find(d => d.name === dictionaryName),
    [dictionaries, dictionaryName]
  );

  // Get all roots
  const allRoots = useMemo(() => {
    if (!dictionary) return [];
    return Object.keys(dictionary.data).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [dictionary]);

  // Filter roots based on search
  const filteredRoots = useMemo(() => {
    if (!searchQuery.trim()) {
      return allRoots;
    }
    return allRoots.filter(root => root.includes(searchQuery.trim()));
  }, [allRoots, searchQuery]);

  const handleBackPress = () => {
    router.back();
  };

  const handleRootPress = (root: string) => {
    router.push({
      pathname: '/(tabs)/dictionaries/root',
      params: {
        root,
        dictionaryName: dictionaryName || '',
      },
    });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  if (!dictionary) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
            {t('errors.notFound')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backButton} onPress={handleBackPress}>
            <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {dictionaryName}
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('dictionaries.searchPlaceholder')}
            onClear={handleClearSearch}
          />
        </View>
      </View>

      {/* Roots List */}
      <FlatList
        data={filteredRoots}
        keyExtractor={item => item}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.rootCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => handleRootPress(item)}
          >
            <Text style={[styles.rootText, { color: theme.colors.text }]}>{item}</Text>
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {t('common.noResults')}
            </Text>
          </View>
        }
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  searchContainer: {
    marginBottom: 0,
  },
  listContent: {
    padding: 16,
  },
  rootCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  rootText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});
