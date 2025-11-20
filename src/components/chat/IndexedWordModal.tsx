import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import { DefinitionCard } from '@components/indexed/DefinitionCard';
import { NavigationBar } from '@components/indexed/NavigationBar';
import { WordDisplay } from '@components/indexed/WordDisplay';

interface IndexedWordModalProps {
  visible: boolean;
  word: string;
  root: string;
  dictionaryName: string;
  onClose: () => void;
}

export function IndexedWordModal({
  visible,
  word: initialWord,
  root: initialRoot,
  dictionaryName: initialDictionaryName,
  onClose,
}: IndexedWordModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { processedWords, searchRootInDictionary, loadAllWords } = useDictionaryStore();

  const [word, setWord] = useState(initialWord);
  const [root, setRoot] = useState(initialRoot);
  const [dictionaryName, setDictionaryName] = useState(initialDictionaryName);
  const [definition, setDefinition] = useState<string>('');
  const [currentOccurrenceIndex, setCurrentOccurrenceIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Helper to remove diacritics for matching
  const removeDiacritics = useCallback((text: string) => {
    return text.replace(/[\u064B-\u065F\u0670]/g, '');
  }, []);

  // Load all words from store if not loaded
  useEffect(() => {
    if (processedWords.length === 0) {
      loadAllWords();
    }
  }, [processedWords.length, loadAllWords]);

  // Load definition when modal opens or word changes
  const loadDefinition = useCallback(async () => {
    setIsLoading(true);
    try {
      const def = await searchRootInDictionary(dictionaryName, root);
      setDefinition(def || '');
      setCurrentOccurrenceIndex(0);
    } catch (error) {
      console.error('Error loading definition:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchRootInDictionary, dictionaryName, root]);

  useEffect(() => {
    if (visible) {
      loadDefinition();
    }
  }, [visible, loadDefinition]);

  // Get all words for this root from processedWords
  const allWords = useMemo(() => {
    if (!dictionaryName || !root || processedWords.length === 0) return [];
    return processedWords.filter(
      w => w.root === root && w.dictionaryName === dictionaryName
    );
  }, [processedWords, root, dictionaryName]);

  // Find current word index (use normalized matching)
  const currentWordIndex = useMemo(() => {
    const normalizedWord = removeDiacritics(word);
    return allWords.findIndex(w => removeDiacritics(w.word) === normalizedWord);
  }, [allWords, word, removeDiacritics]);

  // Get positions for current word (use normalized matching)
  const allPositions = useMemo(() => {
    const normalizedWord = removeDiacritics(word);
    const currentWordData = allWords.find(w => removeDiacritics(w.word) === normalizedWord);
    console.log('[IndexedWordModal] Finding positions for:', word, 'normalized:', normalizedWord, 'found:', !!currentWordData, 'positions:', currentWordData?.allPositions?.length || 0);
    return currentWordData?.allPositions || [];
  }, [allWords, word, removeDiacritics]);

  // Total occurrences is the length of positions array
  const totalOccurrences = allPositions.length;

  const handleNextWord = () => {
    if (currentWordIndex < allWords.length - 1) {
      const nextWord = allWords[currentWordIndex + 1];
      setWord(nextWord.word);
      setRoot(nextWord.root);
      setDictionaryName(nextWord.dictionaryName);
    }
  };

  const handlePreviousWord = () => {
    if (currentWordIndex > 0) {
      const prevWord = allWords[currentWordIndex - 1];
      setWord(prevWord.word);
      setRoot(prevWord.root);
      setDictionaryName(prevWord.dictionaryName);
    }
  };

  const handleNextOccurrence = () => {
    if (currentOccurrenceIndex < totalOccurrences - 1) {
      setCurrentOccurrenceIndex(currentOccurrenceIndex + 1);
    }
  };

  const handlePreviousOccurrence = () => {
    if (currentOccurrenceIndex > 0) {
      setCurrentOccurrenceIndex(currentOccurrenceIndex - 1);
    }
  };

  const handleWordPositionFound = useCallback((y: number) => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, y - 100),
      animated: true,
    });
  }, []);

  // Get the actual word with diacritics from database (for highlighting)
  const actualWord = useMemo(() => {
    const normalizedWord = removeDiacritics(word);
    const found = allWords.find(w => removeDiacritics(w.word) === normalizedWord);
    console.log('[IndexedWordModal] Looking for word:', word, 'normalized:', normalizedWord, 'found in DB:', found?.word || 'NOT FOUND');
    return found?.word || word;
  }, [allWords, word, removeDiacritics]);

  // Get related words (all words in same root except current word)
  const relatedWords = useMemo(() => {
    const normalizedWord = removeDiacritics(actualWord);
    return allWords
      .filter(w => removeDiacritics(w.word) !== normalizedWord)
      .map(w => w.word);
  }, [allWords, actualWord, removeDiacritics]);

  // Determine highlight mode (use normalized comparison)
  const highlightMode: 'word' | 'root' = useMemo(() => {
    const mode = removeDiacritics(actualWord) === removeDiacritics(root) ? 'root' : 'word';
    console.log('[IndexedWordModal] Highlight mode:', mode, 'ActualWord:', actualWord, 'Root:', root, 'Match:', removeDiacritics(actualWord) === removeDiacritics(root));
    return mode;
  }, [actualWord, root, removeDiacritics]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {t('indexed.title')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {isLoading || processedWords.length === 0 || !definition ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <>
            {/* Fixed Content */}
            <View style={styles.fixedContent}>
              <WordDisplay
                word={actualWord}
                root={root}
                dictionaryName={dictionaryName}
                highlightMode={highlightMode}
                onRootPress={() => {
                  setWord(root);
                  setCurrentOccurrenceIndex(0);
                }}
              />

              <NavigationBar
                currentWordIndex={currentWordIndex}
                totalWords={allWords.length}
                currentOccurrenceIndex={currentOccurrenceIndex}
                totalOccurrences={totalOccurrences}
                onNextWord={handleNextWord}
                onPreviousWord={handlePreviousWord}
                onNextOccurrence={handleNextOccurrence}
                onPreviousOccurrence={handlePreviousOccurrence}
              />
            </View>

            {/* Scrollable Definition */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.definitionScrollView}
              contentContainerStyle={styles.definitionScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <DefinitionCard
                definition={definition}
                word={actualWord}
                relatedWords={relatedWords}
                highlightEnabled={true}
                highlightMode={highlightMode}
                currentOccurrenceIndex={currentOccurrenceIndex}
                totalOccurrences={totalOccurrences}
                scrollViewRef={scrollViewRef}
                onWordPositionFound={handleWordPositionFound}
                autoScroll={true}
                allPositions={allPositions}
              />
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  definitionScrollView: {
    flex: 1,
  },
  definitionScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
});
