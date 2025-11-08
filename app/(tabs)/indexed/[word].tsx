import { View, Text, StyleSheet, ScrollView, StatusBar, InteractionManager, ActivityIndicator } from 'react-native';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStore';
import { WordHeader } from '@components/indexed/WordHeader';
import { WordDisplay } from '@components/indexed/WordDisplay';
import { DefinitionCard } from '@components/indexed/DefinitionCard';
import { RelatedWordsPanel } from '@components/indexed/RelatedWordsPanel';
import { NavigationBar } from '@components/indexed/NavigationBar';
import { getFlexDirection } from '@/utils/rtl';
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

  const { indexData, processedWords, processedWordsGrouped, searchRootInDictionary } = useDictionaryStore();

  // Use the appropriate word list based on view mode
  const activeWordList = viewMode === 'grouped' ? processedWordsGrouped : processedWords;

  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [showRelatedWords, setShowRelatedWords] = useState(false);
  const [currentOccurrenceIndex, setCurrentOccurrenceIndex] = useState(0);
  const [definition, setDefinition] = useState<string>('');

  const scrollViewRef = useRef<ScrollView>(null);

  // Load definition ONLY after interactions complete (navigation animation done)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      const def = searchRootInDictionary(dictionaryName || '', root || '');
      setDefinition(def || '');
    });

    return () => task.cancel();
  }, [root, dictionaryName, searchRootInDictionary]);

  // Handle word position found from DefinitionCard
  const handleWordPositionFound = useCallback((y: number) => {
    console.log('[WordDetailScreen] Scrolling to Y position:', y);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: 0,
        y: Math.max(0, y - 100), // Offset 100px from top for better visibility
        animated: true,
      });
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
    const generateVariants = (w: string): string[] => {
      const variants: string[] = [w];
      const حروفالجر = ['ب', 'و', 'ك', 'ف', 'ل'];

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

    // Build regex pattern with optional diacritics
    const pattern = sortedVariants
      .map(v => {
        const escaped = escapeRegex(v);
        return escaped.split('').map(char => char + '[\\u064B-\\u065F\\u0670]*').join('');
      })
      .join('|');

    const regex = new RegExp(pattern, 'g');
    let count = 0;
    let match;

    while ((match = regex.exec(def)) !== null) {
      const matchedText = match[0];
      const matchedTextNoDiacritics = removeDiacritics(matchedText);

      // Verify this is a valid match for our main word
      for (const variant of sortedVariants) {
        const variantNoDiacritics = removeDiacritics(variant);
        if (matchedTextNoDiacritics === variantNoDiacritics ||
            matchedTextNoDiacritics.startsWith(variantNoDiacritics)) {
          count++;
          break;
        }
      }
    }

    return count;
  };

  // Count occurrences of the word in the definition
  const wordOccurrences = useMemo(() => {
    return countWordOccurrences(definition || '', word || '');
  }, [definition, word]);

  // Get all words for this root (related words)
  const relatedWords = useMemo(() => {
    if (!indexData || !dictionaryName || !root) return [];
    return indexData[dictionaryName]?.[root] || [];
  }, [indexData, dictionaryName, root]);

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
      setCurrentOccurrenceIndex(0); // Reset to first occurrence (scroll will happen via onWordPositionFound)

      // Check if we're staying in the same root and dictionary
      if (nextWord.root === root && nextWord.dictionaryName === dictionaryName) {
        // Same root - just update the word parameter without router.replace
        router.setParams({ word: nextWord.word });
      } else {
        // Different root - navigate
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
      setCurrentOccurrenceIndex(0); // Reset to first occurrence (scroll will happen via onWordPositionFound)

      // Check if we're staying in the same root and dictionary
      if (prevWord.root === root && prevWord.dictionaryName === dictionaryName) {
        // Same root - just update the word parameter without router.replace
        router.setParams({ word: prevWord.word });
      } else {
        // Different root - navigate
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
    setCurrentOccurrenceIndex(0); // Reset to first occurrence (scroll will happen via onWordPositionFound)
    // Related words are always in the same root, so just update the word parameter
    router.setParams({ word: relatedWord });
  };

  // Show loading state while definition is being fetched
  if (!definition) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <View style={[styles.headerTop, { flexDirection: getFlexDirection() }]}>
            <View style={styles.headerActions} />
            <Pressable style={styles.backButton} onPress={handleBackPress}>
              <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>←</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.staticInfo}>
          <View style={[styles.wordContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.wordLabel, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
              {t('indexed.word')}
            </Text>
            <Text style={[styles.wordText, { color: theme.colors.primary, textAlign: 'center' }]}>{word || ''}</Text>
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
          currentInstance={currentInstanceIndex}
          totalInstances={wordInstances.length}
        />
      </View>

      <ScrollView ref={scrollViewRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        <DefinitionCard
          definition={definition}
          word={word || ''}
          relatedWords={relatedWords}
          highlightEnabled={highlightEnabled}
          currentOccurrenceIndex={currentOccurrenceIndex}
          totalOccurrences={wordOccurrences}
          scrollViewRef={scrollViewRef}
          onWordPositionFound={handleWordPositionFound}
        />
      </ScrollView>

      <NavigationBar
        currentWordIndex={currentWordIndex}
        totalWords={activeWordList.length}
        onNextWord={handleNextWord}
        onPreviousWord={handlePreviousWord}
        currentInstanceIndex={currentInstanceIndex}
        totalInstances={wordInstances.length}
        currentOccurrenceIndex={currentOccurrenceIndex}
        totalOccurrences={wordOccurrences}
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
  wordContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  wordLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  wordText: {
    fontSize: 32,
    fontWeight: 'bold',
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
