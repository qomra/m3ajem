import { View, Text, StyleSheet, FlatList, StatusBar } from 'react-native';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation, useTheme } from '@hooks';
import { useAudioStore } from '@store/audioStore';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import { AudioHeader } from '@components/audio/AudioHeader';
import { AudioRootCard } from '@components/audio/AudioRootCard';
import { AudioPlayer } from '@components/audio/AudioPlayer';
import { usePathname } from 'expo-router';

export default function AudioTab() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const theme = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'longest' | 'shortest' | 'random'>('alphabetical');
  const [filterDownloaded, setFilterDownloaded] = useState<'all' | 'downloaded' | 'not-downloaded'>('all');
  const [randomSeed, setRandomSeed] = useState(0);

  const availableRoots = useAudioStore(state => state.availableRoots);
  const loadDownloadedFiles = useAudioStore(state => state.loadDownloadedFiles);
  const setCurrentRootsList = useAudioStore(state => state.setCurrentRootsList);
  const setCurrentSortAndFilter = useAudioStore(state => state.setCurrentSortAndFilter);
  const setAvailableRoots = useAudioStore(state => state.setAvailableRoots);
  const isDownloaded = useAudioStore(state => state.isDownloaded);
  const currentWord = useAudioStore(state => state.currentWord);
  const searchRootInDictionary = useDictionaryStore(state => state.searchRootInDictionary);
  const processedRoots = useDictionaryStore(state => state.processedRoots);
  const loadAllRoots = useDictionaryStore(state => state.loadAllRoots);
  const isLoadingRoots = useDictionaryStore(state => state.isLoadingRoots);

  // Load roots from database when component mounts
  useEffect(() => {
    loadDownloadedFiles();
    if (processedRoots.length === 0) {
      loadAllRoots();
    }
  }, []);

  // When processedRoots from database changes, update audioStore's availableRoots
  useEffect(() => {
    if (processedRoots.length > 0) {
      // Extract unique roots from the database (لسان العرب)
      const roots = processedRoots.map(item => item.root);
      setAvailableRoots(roots);
    }
  }, [processedRoots, setAvailableRoots]);

  // Handle sort change - increment randomSeed when switching to random
  const handleSortChange = (newSort: 'alphabetical' | 'longest' | 'shortest' | 'random') => {
    if (newSort === 'random') {
      setRandomSeed(prev => prev + 1);
    }
    setSortBy(newSort);
  };

  // Update current roots list for navigation whenever sorted/filtered list changes
  // This ensures navigation (next/prev) respects the current sort order and filters
  useEffect(() => {
    const rootsList = sortedRoots.map(item => item.root);
    setCurrentRootsList(rootsList);
    setCurrentSortAndFilter(sortBy, filterDownloaded);
    console.log('[Audio] Updated currentRootsList:', {
      count: rootsList.length,
      sortBy,
      filterDownloaded,
      searchQuery: searchQuery ? 'active' : 'none',
    });
  }, [sortedRoots, sortBy, filterDownloaded, searchQuery]);

  // Auto-scroll to current word when it changes
  useEffect(() => {
    if (currentWord && flatListRef.current) {
      const index = sortedRoots.findIndex(item => item.root === currentWord);
      if (index !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5, // Center the item
          });
        }, 100);
      }
    }
  }, [currentWord, sortedRoots]);

  // Helper: Remove diacritics for search matching
  const removeDiacritics = (str: string) => str.replace(/[\u064B-\u065F\u0670]/g, '');

  // All roots with audio (pre-computed, all from لسان العرب)
  const allRootsWithAudio = useMemo(() => {
    return availableRoots.map(root => ({
      root,
      dictionaryName: 'لسان العرب',
    }));
  }, [availableRoots]);

  // Apply search filter
  const searchedRoots = useMemo(() => {
    if (!searchQuery.trim()) {
      return allRootsWithAudio;
    }
    const query = removeDiacritics(searchQuery.trim());
    return allRootsWithAudio.filter(root =>
      removeDiacritics(root.root).includes(query)
    );
  }, [allRootsWithAudio, searchQuery]);

  // Apply download filter
  const filteredRoots = useMemo(() => {
    if (filterDownloaded === 'all') {
      return searchedRoots;
    }
    return searchedRoots.filter(root => {
      const downloaded = isDownloaded(root.root);
      return filterDownloaded === 'downloaded' ? downloaded : !downloaded;
    });
  }, [searchedRoots, filterDownloaded, isDownloaded]);

  // Apply sort - ONLY when on main list to avoid expensive calculations
  const sortedRoots = useMemo(() => {
    // Skip expensive sorting when not on main list
    if (pathname !== '/audio') {
      return [];
    }

    const sorted = [...filteredRoots];

    if (sortBy === 'alphabetical') {
      sorted.sort((a, b) => a.root.localeCompare(b.root, 'ar'));
    } else if (sortBy === 'longest' || sortBy === 'shortest') {
      // Sort by content length
      sorted.sort((a, b) => {
        const aContent = searchRootInDictionary(a.dictionaryName, a.root) || '';
        const bContent = searchRootInDictionary(b.dictionaryName, b.root) || '';
        const diff = bContent.length - aContent.length;
        return sortBy === 'longest' ? diff : -diff;
      });
    } else if (sortBy === 'random') {
      // Shuffle using seeded random
      const seededRandom = (seed: number) => {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };

      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(randomSeed + i) * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
    }

    return sorted;
  }, [filteredRoots, sortBy, randomSeed, searchRootInDictionary, pathname]);

  // Only render the expensive FlatList when on the main audio list view
  const isOnMainList = pathname === '/audio';

  // Show loading state while roots are being fetched from database
  const isLoading = isLoadingRoots || (processedRoots.length === 0 && availableRoots.length === 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {isOnMainList && (
        <>
          <AudioHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            filterDownloaded={filterDownloaded}
            onFilterChange={setFilterDownloaded}
            totalCount={allRootsWithAudio.length}
            filteredCount={sortedRoots.length}
          />

          {isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {t('common.loading')}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={sortedRoots}
              keyExtractor={(item) => `${item.dictionaryName}-${item.root}`}
              keyboardShouldPersistTaps='handled'
              renderItem={({ item }) => (
                <AudioRootCard
                  root={item.root}
                  dictionaryName={item.dictionaryName}
                  isCurrentlyPlaying={currentWord === item.root}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onScrollToIndexFailed={(info) => {
                // Handle scroll failure gracefully
                setTimeout(() => {
                  flatListRef.current?.scrollToOffset({
                    offset: info.averageItemLength * info.index,
                    animated: true,
                  });
                }, 100);
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    {t('common.noResults')}
                  </Text>
                </View>
              }
            />
          )}

          {currentWord && <AudioPlayer />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Space for audio player
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
