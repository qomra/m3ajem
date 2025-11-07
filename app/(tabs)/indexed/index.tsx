import { View, Text, StyleSheet, FlatList, StatusBar } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation, useTheme } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStore';
import { IndexedHeader } from '@components/indexed/IndexedHeader';
import { RootCard } from '@components/indexed/RootCard';
import { WordCard } from '@components/indexed/WordCard';

// Separate component for the actual content - only mounts after delay
function IndexedContent() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [isGrouped, setIsGrouped] = useState(true);
  const [isReverseSearch, setIsReverseSearch] = useState(false);
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());

  const processedWords = useDictionaryStore(state => state.processedWords);
  const processedRoots = useDictionaryStore(state => state.processedRoots);
  const isLoadingIndex = useDictionaryStore(state => state.isLoadingIndex);
  const loadIndex = useDictionaryStore(state => state.loadIndex);

  // Load index data when component mounts (if not already loaded)
  useEffect(() => {
    if (processedWords.length === 0 && !isLoadingIndex) {
      console.log('[IndexedContent] Loading index data...');
      loadIndex();
    }
  }, []);

  // Filter words based on search
  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) {
      return processedWords;
    }

    const query = searchQuery.trim();

    if (isReverseSearch) {
      return processedWords.filter(item => item.word.endsWith(query));
    } else {
      return processedWords.filter(item => item.word.includes(query));
    }
  }, [processedWords, searchQuery, isReverseSearch]);

  // Filter grouped words based on search
  const filteredGroupedWords = useMemo(() => {
    if (!searchQuery.trim()) {
      return processedRoots;
    }

    const query = searchQuery.trim();

    return processedRoots
      .map(group => {
        const filteredWordList = isReverseSearch
          ? group.words.filter(word => word.endsWith(query))
          : group.words.filter(word => word.includes(query));

        return {
          ...group,
          words: filteredWordList,
          wordCount: filteredWordList.length,
        };
      })
      .filter(group => group.wordCount > 0);
  }, [processedRoots, searchQuery, isReverseSearch]);

  const handleWordPress = (word: string, root: string, dictionaryName: string) => {
    router.push({
      pathname: '/(tabs)/indexed/[word]',
      params: {
        word,
        root,
        dictionaryName,
        viewMode: isGrouped ? 'grouped' : 'flatten',
      },
    });
  };

  const toggleRootExpand = (root: string) => {
    const newExpanded = new Set(expandedRoots);
    if (newExpanded.has(root)) {
      newExpanded.delete(root);
    } else {
      newExpanded.add(root);
    }
    setExpandedRoots(newExpanded);
  };

  if (isLoadingIndex || processedWords.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

        <IndexedHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          isGrouped={isGrouped}
          onToggleGrouped={() => setIsGrouped(!isGrouped)}
          isReverseSearch={isReverseSearch}
          onToggleReverseSearch={() => setIsReverseSearch(!isReverseSearch)}
        />

        <View style={styles.centerContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <IndexedHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={() => setSearchQuery('')}
        isGrouped={isGrouped}
        onToggleGrouped={() => setIsGrouped(!isGrouped)}
        isReverseSearch={isReverseSearch}
        onToggleReverseSearch={() => setIsReverseSearch(!isReverseSearch)}
      />

      {/* Word List */}
      {isGrouped ? (
        <FlatList
          data={filteredGroupedWords}
          keyExtractor={item => `${item.dictionaryName}-${item.root}`}
          renderItem={({ item }) => (
            <RootCard
              root={item.root}
              dictionaryName={item.dictionaryName}
              words={item.words}
              wordCount={item.wordCount}
              isExpanded={expandedRoots.has(item.root)}
              onToggleExpand={() => toggleRootExpand(item.root)}
              onWordPress={word => handleWordPress(word, item.root, item.dictionaryName)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {t('common.noResults')}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredWords}
          keyExtractor={(item, index) => `${item.word}-${item.root}-${index}`}
          renderItem={({ item }) => (
            <WordCard
              word={item.word}
              root={item.root}
              dictionaryName={item.dictionaryName}
              onPress={() => handleWordPress(item.word, item.root, item.dictionaryName)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {t('common.noResults')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// Main screen component - shows loading immediately, mounts content asynchronously
export default function IndexedScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.log('[IndexedScreen] Effect running, will mount content...');
    // Mount content on next tick
    const timer = setTimeout(() => {
      console.log('[IndexedScreen] Mounting content now');
      setMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  console.log('[IndexedScreen] Rendering, mounted=', mounted);

  // Always show loading screen first - tab switches instantly
  if (!mounted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.text, textAlign: 'right' }]}>
            {t('indexed.title')}
          </Text>
        </View>

        <View style={styles.centerContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      </View>
    );
  }

  return <IndexedContent />;
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
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
