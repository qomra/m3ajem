import { View, Text, StyleSheet, ScrollView, StatusBar, InteractionManager, ActivityIndicator } from 'react-native';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import { WordHeader } from '@components/indexed/WordHeader';
import { WordDisplay } from '@components/indexed/WordDisplay';
import { DefinitionCard } from '@components/indexed/DefinitionCard';
import { RelatedWordsPanel } from '@components/indexed/RelatedWordsPanel';
import { NavigationBar } from '@components/indexed/NavigationBar';
import { Pressable } from 'react-native';

export default function WordDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const { word, root, dictionaryName, viewMode } = useLocalSearchParams<{
    word: string;
    root: string;
    dictionaryName: string;
    viewMode?: string;
  }>();

  const { processedWords, searchRootInDictionary, loadAllWords } = useDictionaryStore();

  // Load words for navigation if not already loaded
  useEffect(() => {
    if (processedWords.length === 0) {
      loadAllWords();
    }
  }, [processedWords.length, loadAllWords]);

  // Use processedWords for navigation
  const activeWordList = processedWords;

  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [showRelatedWords, setShowRelatedWords] = useState(false);
  const [currentOccurrenceIndex, setCurrentOccurrenceIndex] = useState(0);
  const [definition, setDefinition] = useState<string>('');
  const [highlightReady, setHighlightReady] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Load definition ONLY after interactions complete (navigation animation done)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      const def = await searchRootInDictionary(dictionaryName || '', root || '');
      setDefinition(def || '');
    });

    return () => task.cancel();
  }, [root, dictionaryName, searchRootInDictionary]);

  // Wait for highlighting to be ready before showing content
  // Only delay on initial load or when changing roots
  useEffect(() => {
    if (definition && processedWords.length > 0) {
      // Mark as ready immediately - highlighting is computed synchronously in useMemo
      setHighlightReady(true);
    } else {
      setHighlightReady(false);
    }
  }, [definition, word, processedWords.length]);

  const currentScrollYRef = useRef(0);
  const viewportHeightRef = useRef(0);

  // Handle word position found from DefinitionCard
  const handleWordPositionFound = useCallback((y: number) => {
    const currentScrollY = currentScrollYRef.current;
    const viewportHeight = viewportHeightRef.current;

    if (scrollViewRef.current && y > 0 && viewportHeight > 0) {
      // Account for navigation bar at bottom
      const BOTTOM_NAV_BUFFER = 150; // Navigation bar height
      const TOP_BUFFER = 50; // Small top margin

      const viewportTop = currentScrollY + TOP_BUFFER;
      const viewportBottom = currentScrollY + viewportHeight - BOTTOM_NAV_BUFFER;

      // Check if word is outside viewport (no tolerance - scroll if it's truly outside)
      const isAboveViewport = y < viewportTop;
      const isBelowViewport = y > viewportBottom;

      if (isAboveViewport || isBelowViewport) {
        // Scroll to position with offset for better visibility
        const targetY = Math.max(0, y - 100);
        scrollViewRef.current.scrollTo({
          x: 0,
          y: targetY,
          animated: true,
        });
      }
    }
  }, []);

  // Helper function to count word occurrences in a definition (using same logic as highlighting)
  const countWordOccurrences = (def: string, targetWord: string): number => {
    if (!def || !targetWord) return 0;

    // Helper: Remove diacritics
    const removeDiacritics = (str: string) => str.replace(/[\u064B-\u065F\u0670]/g, '');

    // Helper: Escape special regex characters
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Generate all possible variants for the word
    // For prefixes, we ignore diacritics, but for the core word, we match exactly
    const generateVariants = (w: string): string[] => {
      const variants: string[] = [w];
      const حروفالجر = ['ب', 'و', 'ك', 'ف', 'ل'];

      // Add variants with prefixes (diacritics will be optional only on prefixes)
      حروفالجر.forEach(حرف => {
        variants.push(حرف + w);
      });

      if (w.startsWith('ال')) {
        const withoutال = w.substring(2);
        variants.push('لل' + withoutال);
        variants.push('وب' + withoutال);
        variants.push('وك' + withoutال);
      }
      if (w.startsWith('أ') || w.startsWith('ا')) {
        const withoutHamza = w.substring(1);
        variants.push('وس' + withoutHamza);
      }

      return variants;
    };

    const variants = generateVariants(targetWord);
    const sortedVariants = variants.sort((a, b) => b.length - a.length);

    // Build regex pattern: optional diacritics ONLY on prefixes, exact match on core word
    const pattern = sortedVariants
      .map(v => {
        const escaped = escapeRegex(v);
        // Extract prefix (if any) and core word
        const حروفالجر = ['ب', 'و', 'ك', 'ف', 'ل'];
        let prefix = '';
        let coreWord = escaped;

        // Check for single-letter prefixes
        for (const حرف of حروفالجر) {
          if (v.startsWith(حرف) && v.length > 1) {
            prefix = escapeRegex(حرف);
            coreWord = escapeRegex(v.substring(1));
            break;
          }
        }

        // Check for 'ال' and its variants
        if (!prefix && v.startsWith('ال') && v.length > 2) {
          prefix = escapeRegex('ال');
          coreWord = escapeRegex(v.substring(2));
        } else if (!prefix && v.startsWith('لل') && v.length > 2) {
          prefix = escapeRegex('لل');
          coreWord = escapeRegex(v.substring(2));
        } else if (!prefix && v.startsWith('وب') && v.length > 2) {
          prefix = escapeRegex('وب');
          coreWord = escapeRegex(v.substring(2));
        } else if (!prefix && v.startsWith('وك') && v.length > 2) {
          prefix = escapeRegex('وك');
          coreWord = escapeRegex(v.substring(2));
        } else if (!prefix && v.startsWith('وس') && v.length > 2) {
          prefix = escapeRegex('وس');
          coreWord = escapeRegex(v.substring(2));
        }

        // Build pattern: optional diacritics on prefix chars, but core word matches exactly
        if (prefix) {
          const prefixWithDiacritics = prefix.split('').map(char => char + '[\\u064B-\\u065F\\u0670]*').join('');
          return prefixWithDiacritics + coreWord;
        } else {
          // No prefix, match core word exactly
          return coreWord;
        }
      })
      .join('|');

    const regex = new RegExp(pattern, 'g');
    let count = 0;
    let match;

    while ((match = regex.exec(def)) !== null) {
      count++;
    }

    return count;
  };

  // Count occurrences of the word in the definition
  const wordOccurrences = useMemo(() => {
    return countWordOccurrences(definition || '', word || '');
  }, [definition, word]);

  // Get all words for this root (related words)
  const relatedWords = useMemo(() => {
    if (!dictionaryName || !root || processedWords.length === 0) return [];
    // Filter words that belong to this root
    return processedWords
      .filter(w => w.root === root && w.dictionaryName === dictionaryName)
      .map(w => w.word);
  }, [processedWords, dictionaryName, root]);

  // Get allPositions for current word from database
  const currentWordPositions = useMemo(() => {
    if (!word || !root || !dictionaryName || processedWords.length === 0) return [];
    const currentWordData = processedWords.find(
      w => w.word === word && w.root === root && w.dictionaryName === dictionaryName
    );
    return currentWordData?.allPositions || [];
  }, [processedWords, word, root, dictionaryName]);

  // Find current word index
  const currentWordIndex = useMemo(() => {
    return activeWordList.findIndex(
      item => item.word === word && item.root === root && item.dictionaryName === dictionaryName
    );
  }, [activeWordList, word, root, dictionaryName]);

  // Find all instances of current word (same word, different roots/dictionaries)
  const wordInstances = useMemo(() => {
    if (!word) return [];
    return activeWordList.filter(item => item.word === word);
  }, [activeWordList, word]);

  const currentInstanceIndex = useMemo(() => {
    return wordInstances.findIndex(item => item.root === root && item.dictionaryName === dictionaryName);
  }, [wordInstances, root, dictionaryName]);

  const handleBackPress = () => {
    router.back();
  };

  const handleNextWord = () => {
    if (currentWordIndex < activeWordList.length - 1) {
      const nextWord = activeWordList[currentWordIndex + 1];

      const isSameRoot = nextWord.root === root && nextWord.dictionaryName === dictionaryName;

      // Only reset occurrence index for different roots
      if (!isSameRoot) {
        setCurrentOccurrenceIndex(0);
      }

      // Same root - just update params without page reload or scroll
      if (isSameRoot) {
        router.setParams({ word: nextWord.word });
      } else {
        // Different root - full navigation
        setCurrentOccurrenceIndex(0);
        router.replace({
          pathname: '/(tabs)/indexed/[word]',
          params: {
            word: nextWord.word,
            root: nextWord.root,
            dictionaryName: nextWord.dictionaryName,
            viewMode: viewMode || 'flatten',
          },
        });
      }
    }
  };

  const handlePreviousWord = () => {
    if (currentWordIndex > 0) {
      const prevWord = activeWordList[currentWordIndex - 1];
      setCurrentOccurrenceIndex(0);

      // Same root - just update params without page reload
      if (prevWord.root === root && prevWord.dictionaryName === dictionaryName) {
        router.setParams({ word: prevWord.word });
      } else {
        // Different root - full navigation
        router.replace({
          pathname: '/(tabs)/indexed/[word]',
          params: {
            word: prevWord.word,
            root: prevWord.root,
            dictionaryName: prevWord.dictionaryName,
            viewMode: viewMode || 'flatten',
          },
        });
      }
    }
  };

  const handleNextInstance = () => {
    // First check if there are more occurrences in the current definition
    if (currentOccurrenceIndex < wordOccurrences - 1) {
      setCurrentOccurrenceIndex(currentOccurrenceIndex + 1); // Scroll will happen via onWordPositionFound
    } else if (currentInstanceIndex < wordInstances.length - 1) {
      // No more occurrences in current definition, navigate to next instance
      const nextInstance = wordInstances[currentInstanceIndex + 1];
      setCurrentOccurrenceIndex(0); // Reset to first occurrence (scroll will happen via onWordPositionFound)

      router.replace({
        pathname: '/(tabs)/indexed/[word]',
        params: {
          word: nextInstance.word,
          root: nextInstance.root,
          dictionaryName: nextInstance.dictionaryName,
          viewMode: viewMode || 'flatten',
        },
      });
    }
  };

  const handlePreviousInstance = () => {
    // First check if we're not at the first occurrence in current definition
    if (currentOccurrenceIndex > 0) {
      setCurrentOccurrenceIndex(currentOccurrenceIndex - 1); // Scroll will happen via onWordPositionFound
    } else if (currentInstanceIndex > 0) {
      // At first occurrence, navigate to previous instance
      const prevInstance = wordInstances[currentInstanceIndex - 1];
      // We need to calculate occurrences in the previous instance to set the index to the last one
      const prevDefinition = searchRootInDictionary(prevInstance.dictionaryName, prevInstance.root);
      if (prevDefinition && word) {
        const prevOccurrences = countWordOccurrences(prevDefinition, word);
        setCurrentOccurrenceIndex(prevOccurrences > 0 ? prevOccurrences - 1 : 0);
      } else {
        setCurrentOccurrenceIndex(0);
      }

      router.replace({
        pathname: '/(tabs)/indexed/[word]',
        params: {
          word: prevInstance.word,
          root: prevInstance.root,
          dictionaryName: prevInstance.dictionaryName,
          viewMode: viewMode || 'flatten',
        },
      });
    }
  };

  const handleRelatedWordPress = (relatedWord: string) => {
    setCurrentOccurrenceIndex(0);
    // Related words are always in the same root, just update params
    router.setParams({ word: relatedWord });
  };

  // Show loading state while definition is being fetched, words are loading, or highlighting is processing
  if (!definition || !highlightReady || processedWords.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

        <WordHeader
          onBackPress={handleBackPress}
          highlightEnabled={highlightEnabled}
          onToggleHighlight={() => setHighlightEnabled(!highlightEnabled)}
          relatedWordsCount={relatedWords.length}
          onShowRelatedWords={() => setShowRelatedWords(!showRelatedWords)}
        />

        <View style={styles.staticInfo}>
          <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoValue, { color: theme.colors.primary, fontWeight: 'bold' }]}> {word || ''}</Text>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                {t('indexed.word')}:
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}> {root || ''}</Text>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                {t('dictionaries.root')}:
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.infoRow}>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}> {dictionaryName || ''}</Text>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                {t('dictionaries.dictionaryName')}:
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.loadingContainerFull}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <WordHeader
        onBackPress={handleBackPress}
        highlightEnabled={highlightEnabled}
        onToggleHighlight={() => setHighlightEnabled(!highlightEnabled)}
        relatedWordsCount={relatedWords.length}
        onShowRelatedWords={() => setShowRelatedWords(!showRelatedWords)}
      />

      <View style={styles.staticInfo}>
        <WordDisplay
          word={word || ''}
          root={root || ''}
          dictionaryName={dictionaryName || ''}
          currentInstance={Math.max(0, currentInstanceIndex)}
          totalInstances={Math.max(0, wordInstances.length)}
        />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        onScroll={(e) => {
          currentScrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={(e) => {
          viewportHeightRef.current = e.nativeEvent.layout.height;
        }}
        scrollEventThrottle={16}
      >
        <DefinitionCard
          definition={definition}
          word={word || ''}
          relatedWords={relatedWords}
          highlightEnabled={highlightEnabled}
          currentOccurrenceIndex={currentOccurrenceIndex}
          totalOccurrences={wordOccurrences}
          scrollViewRef={scrollViewRef}
          onWordPositionFound={handleWordPositionFound}
          allPositions={currentWordPositions}
        />
      </ScrollView>

      <NavigationBar
        currentWordIndex={Math.max(0, currentWordIndex)}
        totalWords={Math.max(0, activeWordList.length)}
        onNextWord={handleNextWord}
        onPreviousWord={handlePreviousWord}
        currentInstanceIndex={Math.max(0, currentInstanceIndex)}
        totalInstances={Math.max(0, wordInstances.length)}
        currentOccurrenceIndex={Math.max(0, currentOccurrenceIndex)}
        totalOccurrences={Math.max(0, wordOccurrences)}
        onNextInstance={handleNextInstance}
        onPreviousInstance={handlePreviousInstance}
      />

      {/* Related Words Modal */}
      {relatedWords.length > 1 && (
        <RelatedWordsPanel
          visible={showRelatedWords}
          words={relatedWords}
          currentWord={word || ''}
          onWordPress={handleRelatedWordPress}
          onClose={() => setShowRelatedWords(false)}
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flex: 1,
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  staticInfo: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
});
