import { View, Text, StyleSheet, FlatList, StatusBar } from 'react-native';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation, useTheme } from '@hooks';
import { useAudioStore, AUDIO_BOOKS } from '@store/audioStore';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import { AudioHeader } from '@components/audio/AudioHeader';
import { AudioRootCard } from '@components/audio/AudioRootCard';
import { AudioPlayer } from '@components/audio/AudioPlayer';
import { useLocalSearchParams, usePathname } from 'expo-router';

export default function AudioEntryList() {
  const { dictionaryName } = useLocalSearchParams<{ dictionaryName: string }>();
  const pathname = usePathname();
  const { t } = useTranslation();
  const theme = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [randomSeed, setRandomSeed] = useState(() => Date.now());

  const sortBy = useAudioStore(state => state.currentSortBy);
  const filterDownloaded = useAudioStore(state => state.currentFilter);
  const isPlayerStateLoaded = useAudioStore(state => state.isPlayerStateLoaded);
  const setCurrentSortAndFilter = useAudioStore(state => state.setCurrentSortAndFilter);

  const setSortBy = (newSort: 'alphabetical' | 'longest' | 'shortest' | 'random') => {
    setCurrentSortAndFilter(newSort, filterDownloaded);
  };
  const setFilterDownloaded = (newFilter: 'all' | 'downloaded' | 'not-downloaded') => {
    setCurrentSortAndFilter(sortBy, newFilter);
  };

  const availableRoots = useAudioStore(state => state.availableRoots);
  const setCurrentRootsList = useAudioStore(state => state.setCurrentRootsList);
  const setAvailableRoots = useAudioStore(state => state.setAvailableRoots);
  const isDownloaded = useAudioStore(state => state.isDownloaded);
  const currentWord = useAudioStore(state => state.currentWord);
  const audioMap = useAudioStore(state => state.audioMap);

  const { getRootsForDictionary } = useDictionaryStore();
  const [dbRoots, setDbRoots] = useState<string[]>([]);
  const [isLoadingRoots, setIsLoadingRoots] = useState(true);

  // Find the book config for this dictionary
  const book = useMemo(
    () => AUDIO_BOOKS.find(b => b.dictionaryName === dictionaryName),
    [dictionaryName]
  );

  // Load roots from database for this dictionary
  useEffect(() => {
    if (!dictionaryName) return;
    setIsLoadingRoots(true);
    getRootsForDictionary(dictionaryName).then(roots => {
      setDbRoots(roots);
      setIsLoadingRoots(false);
    });
  }, [dictionaryName, getRootsForDictionary]);

  // Set available roots in audioStore when roots are loaded
  useEffect(() => {
    if (dbRoots.length > 0) {
      setAvailableRoots(dbRoots);
    }
  }, [dbRoots, setAvailableRoots]);

  const handleSortChange = (newSort: 'alphabetical' | 'longest' | 'shortest' | 'random') => {
    if (newSort === 'random') {
      setRandomSeed(prev => prev + 1);
    }
    setSortBy(newSort);
  };

  const removeDiacritics = (str: string) => str.replace(/[\u064B-\u065F\u0670]/g, '');

  const allRootsWithAudio = useMemo(() => {
    return availableRoots.map(root => ({
      root,
      dictionaryName: dictionaryName || '',
    }));
  }, [availableRoots, dictionaryName]);

  const searchedRoots = useMemo(() => {
    if (!searchQuery.trim()) {
      return allRootsWithAudio;
    }
    const query = removeDiacritics(searchQuery.trim());
    return allRootsWithAudio.filter(root =>
      removeDiacritics(root.root).includes(query)
    );
  }, [allRootsWithAudio, searchQuery]);

  const filteredRoots = useMemo(() => {
    if (filterDownloaded === 'all') {
      return searchedRoots;
    }
    return searchedRoots.filter(root => {
      const downloaded = isDownloaded(root.root);
      return filterDownloaded === 'downloaded' ? downloaded : !downloaded;
    });
  }, [searchedRoots, filterDownloaded, isDownloaded]);

  const sortedRoots = useMemo(() => {
    const sorted = [...filteredRoots];

    if (sortBy === 'alphabetical') {
      sorted.sort((a, b) => a.root.localeCompare(b.root, 'ar'));
    } else if (sortBy === 'longest' || sortBy === 'shortest') {
      sorted.sort((a, b) => {
        const aSize = audioMap[a.root]?.size || 0;
        const bSize = audioMap[b.root]?.size || 0;
        const diff = bSize - aSize;
        return sortBy === 'longest' ? diff : -diff;
      });
    } else if (sortBy === 'random') {
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
  }, [filteredRoots, sortBy, randomSeed, audioMap]);

  useEffect(() => {
    if (!isPlayerStateLoaded) return;

    const rootsList = sortedRoots.map(item => item.root);
    setCurrentRootsList(rootsList);
  }, [sortedRoots, isPlayerStateLoaded]);

  useEffect(() => {
    if (currentWord && flatListRef.current) {
      const index = sortedRoots.findIndex(item => item.root === currentWord);
      if (index !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5,
          });
        }, 100);
      }
    }
  }, [currentWord, sortedRoots]);

  const isLoading = isLoadingRoots || !isPlayerStateLoaded;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <AudioHeader
        bookName={dictionaryName || ''}
        driveFolderUrl={book?.driveFolderUrl || ''}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
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
