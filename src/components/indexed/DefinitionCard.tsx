import { View, Text, StyleSheet, ScrollView, TextLayout } from 'react-native';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useTheme, useTranslation } from '@hooks';

interface DefinitionCardProps {
  definition: string;
  word: string;
  relatedWords?: string[];
  highlightEnabled: boolean;
  currentOccurrenceIndex?: number;
  totalOccurrences?: number;
  scrollViewRef?: React.RefObject<ScrollView>;
  onWordPositionFound?: (y: number) => void;
}

export function DefinitionCard({
  definition,
  word,
  relatedWords = [],
  highlightEnabled,
  currentOccurrenceIndex = 0,
  totalOccurrences = 0,
  scrollViewRef,
  onWordPositionFound,
}: DefinitionCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const textLayoutLines = useRef<TextLayout['lines']>([]);
  const definitionCardRef = useRef<View>(null);
  const [layoutReady, setLayoutReady] = useState(false);

  // Reset layout ready when word changes
  useEffect(() => {
    setLayoutReady(false);
  }, [word, definition]);

  // Handle text layout to get line positions
  const handleTextLayout = useCallback((event: { nativeEvent: TextLayout }) => {
    textLayoutLines.current = event.nativeEvent.lines;
    // Use setTimeout to ensure state updates after render completes
    setTimeout(() => {
      setLayoutReady(true); // Trigger position finding
    }, 0);
  }, [word]);

  // Helper: Remove diacritics for text matching
  const removeDiacritics = useCallback((str: string) =>
    str.replace(/[\u064B-\u065F\u0670]/g, ''),
  []);

  // Find the Y position of the current occurrence
  useEffect(() => {
    if (!layoutReady || textLayoutLines.current.length === 0 || !word || totalOccurrences === 0) {

      return;
    }


    // Build the full text from lines to find character positions
    const fullText = textLayoutLines.current.map(line => line.text).join('');
    const fullTextNoDiacritics = removeDiacritics(fullText);

    // Generate word variants (same logic as highlighting)
    const generateVariants = (w: string): string[] => {
      const variants: string[] = [w];
      const حروفالجر = ['ب', 'و', 'ك', 'ف', 'ل'];
      حروفالجر.forEach(حرف => variants.push(حرف + w));
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

    const variants = generateVariants(word);
    const sortedVariants = variants.sort((a, b) => b.length - a.length);

    // Find all occurrences
    let occurrenceCount = 0;
    let targetCharIndex = -1;

    for (let i = 0; i < fullTextNoDiacritics.length; i++) {
      for (const variant of sortedVariants) {
        const variantNoDiacritics = removeDiacritics(variant);
        if (fullTextNoDiacritics.substring(i, i + variantNoDiacritics.length) === variantNoDiacritics) {
          if (occurrenceCount === currentOccurrenceIndex) {
            targetCharIndex = i;
            break;
          }
          occurrenceCount++;
          break;
        }
      }
      if (targetCharIndex !== -1) break;
    }

    if (targetCharIndex === -1) {
      return;
    }

    // Find which line contains this character index
    let charCount = 0;
    let targetLineIndex = -1;

    for (let i = 0; i < textLayoutLines.current.length; i++) {
      const lineLength = textLayoutLines.current[i].text.length;
      if (targetCharIndex < charCount + lineLength) {
        targetLineIndex = i;
        break;
      }
      charCount += lineLength;
    }

    if (targetLineIndex !== -1) {
      const targetY = textLayoutLines.current[targetLineIndex].y;

      // Measure the DefinitionCard's position relative to the ScrollView
      if (definitionCardRef.current && scrollViewRef?.current) {
        // Add delay to ensure layout is stable
        setTimeout(() => {
          definitionCardRef.current?.measureLayout(
            scrollViewRef.current as any,
            (x, cardY, width, height) => {
              const absoluteY = cardY + targetY;
              if (onWordPositionFound) {
                onWordPositionFound(absoluteY);
              }
            },
            () => {
              console.log('[DefinitionCard] measureLayout failed');
            }
          );
        }, 100);
      } else {
        console.log('[DefinitionCard] Refs not available:', {
          cardRef: !!definitionCardRef.current,
          scrollRef: !!scrollViewRef?.current,
        });
      }
    }
  }, [layoutReady, currentOccurrenceIndex, word, totalOccurrences, scrollViewRef, onWordPositionFound, removeDiacritics]);

  // Highlight the word and related words in the definition
  const highlightedDefinition = useMemo(() => {
    const parts: Array<{ text: string; type: 'none' | 'main' | 'related'; occurrenceIndex?: number }> = [];

    // Create a combined list of words (main word always, related words only if enabled)
    const allWords = highlightEnabled
      ? [word, ...relatedWords.filter(w => w !== word)]
      : [word];

    if (allWords.length === 0) return definition;

    // Helper: Remove diacritics
    const removeDiacritics = (str: string) =>
      str.replace(/[\u064B-\u065F\u0670]/g, '');

    // Helper: Escape special regex characters
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Generate all possible variants for a word
    const generateVariants = (w: string): string[] => {
      const variants: string[] = [w]; // Original word

      const حروفالجر = ['ب', 'و', 'ك', 'ف', 'ل'];

      // Add variants with حروف الجر prefix
      حروفالجر.forEach(حرف => {
        variants.push(حرف + w);
      });

      // Handle لل -> ال conversion (if word starts with ال, also match لل variant)
      if (w.startsWith('ال')) {
        const withoutال = w.substring(2);
        variants.push('لل' + withoutال);
      }

      // Handle rare وب، وك، وس cases
      if (w.startsWith('ال')) {
        const withoutال = w.substring(2);
        variants.push('وب' + withoutال);
        variants.push('وك' + withoutال);
      }
      if (w.startsWith('أ') || w.startsWith('ا')) {
        const withoutHamza = w.substring(1);
        variants.push('وس' + withoutHamza);
      }

      return variants;
    };

    // Build word map: each variant -> original word info
    const wordMap = new Map<string, { originalWord: string; isMain: boolean }>();

    allWords.forEach((w, idx) => {
      const isMain = idx === 0;
      const variants = generateVariants(w);
      variants.forEach(variant => {
        if (!wordMap.has(variant)) {
          wordMap.set(variant, { originalWord: w, isMain });
        }
      });
    });

    // Sort variants by length (longest first)
    const sortedVariants = Array.from(wordMap.keys()).sort((a, b) => b.length - a.length);

    // Build regex pattern with optional diacritics
    const pattern = sortedVariants.map(v => {
      const escaped = escapeRegex(v);
      // Allow optional diacritics after each letter
      return escaped.split('').map(char => char + '[\\u064B-\\u065F\\u0670]*').join('');
    }).join('|');

    const regex = new RegExp(pattern, 'g');

    let lastIndex = 0;
    let match;
    const mainWordOccurrenceCounts = new Map<string, number>();

    while ((match = regex.exec(definition)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push({
          text: definition.substring(lastIndex, match.index),
          type: 'none',
        });
      }

      // Find which word this match corresponds to
      const matchedText = match[0];
      const matchedTextNoDiacritics = removeDiacritics(matchedText);

      let matchedWordInfo: { originalWord: string; isMain: boolean } | undefined;

      for (const variant of sortedVariants) {
        const variantNoDiacritics = removeDiacritics(variant);
        if (matchedTextNoDiacritics === variantNoDiacritics ||
            matchedTextNoDiacritics.startsWith(variantNoDiacritics)) {
          matchedWordInfo = wordMap.get(variant);
          break;
        }
      }

      if (!matchedWordInfo) {
        matchedWordInfo = { originalWord: word, isMain: true };
      }

      const isMainWord = matchedWordInfo.isMain;
      const originalWord = matchedWordInfo.originalWord;

      // Track occurrence count for main word
      let occurrenceIdx: number | undefined;
      if (isMainWord) {
        const count = mainWordOccurrenceCounts.get(originalWord) || 0;
        occurrenceIdx = count;
        mainWordOccurrenceCounts.set(originalWord, count + 1);
      }

      // Add highlighted match
      parts.push({
        text: matchedText,
        type: isMainWord ? 'main' : 'related',
        occurrenceIndex: occurrenceIdx,
      });

      lastIndex = match.index + matchedText.length;
    }

    // Add remaining text
    if (lastIndex < definition.length) {
      parts.push({
        text: definition.substring(lastIndex),
        type: 'none',
      });
    }

    return parts;
  }, [definition, word, relatedWords, highlightEnabled, currentOccurrenceIndex, totalOccurrences]);

  return (
    <View
      ref={definitionCardRef}
      style={[styles.definitionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <Text style={[styles.definitionLabel, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
        {t('dictionaries.definition')}
      </Text>
      <Text
        key={`${word}-${definition.substring(0, 50)}`}
        style={[styles.definitionText, { color: theme.colors.text, textAlign: 'right' }]}
        onTextLayout={handleTextLayout}
      >
        {typeof highlightedDefinition === 'string'
          ? highlightedDefinition
          : highlightedDefinition.map((part, index) => {
              if (part.type === 'main') {
                const isCurrentOccurrence = part.occurrenceIndex === currentOccurrenceIndex && totalOccurrences > 1;
                return (
                  <Text
                    key={index}
                    style={[
                      styles.highlighted,
                      {
                        backgroundColor: theme.colors.primary + '30',
                        color: theme.colors.primary,
                        borderWidth: isCurrentOccurrence ? 2 : 0,
                        borderColor: isCurrentOccurrence ? theme.colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {part.text}
                  </Text>
                );
              } else if (part.type === 'related') {
                return (
                  <Text
                    key={index}
                    style={[
                      styles.highlighted,
                      { backgroundColor: theme.colors.accent + '30', color: theme.colors.accent },
                    ]}
                  >
                    {part.text}
                  </Text>
                );
              } else {
                return <Text key={index}>{part.text}</Text>;
              }
            })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  definitionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  definitionLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  definitionText: {
    fontSize: 18,
    lineHeight: 32,
  },
  highlighted: {
    fontWeight: 'bold',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
});
