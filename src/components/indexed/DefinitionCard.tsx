import { View, Text, StyleSheet, ScrollView, TextLayout } from 'react-native';
import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useTheme, useTranslation } from '@hooks';

interface DefinitionCardProps {
  definition: string;
  word: string;
  relatedWords?: string[];
  highlightEnabled: boolean;
  highlightMode?: 'word' | 'root'; // 'word' = highlight single word, 'root' = highlight all words
  currentOccurrenceIndex?: number;
  totalOccurrences?: number;
  scrollViewRef?: React.RefObject<ScrollView>;
  onWordPositionFound?: (y: number) => void;
  autoScroll?: boolean; // Whether to auto-scroll to word position
  allPositions?: number[]; // Pre-calculated positions from database
}

export function DefinitionCard({
  definition,
  word,
  relatedWords = [],
  highlightEnabled,
  highlightMode = 'word',
  currentOccurrenceIndex = 0,
  totalOccurrences = 0,
  scrollViewRef,
  onWordPositionFound,
  allPositions = [],
}: DefinitionCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const textLayoutLines = useRef<TextLayout['lines']>([]);
  const definitionCardRef = useRef<View>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const lastScrolledWordRef = useRef<string>('');
  const lastScrolledOccurrenceRef = useRef<number>(-1);

  // Use definition as-is - preserve all existing newlines and formatting
  const processedDefinition = useMemo(() => {
    if (!definition) return '';
    // Return definition without modification to preserve existing newlines
    return definition;
  }, [definition]);

  // Reset layout ready when definition changes (different root)
  useEffect(() => {
    setLayoutReady(false);
  }, [definition]);

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

  // Find the Y position of the current occurrence using DATABASE positions
  useEffect(() => {
    if (!layoutReady || textLayoutLines.current.length === 0 || !word || totalOccurrences === 0) {
      return;
    }

    // Clear refs when word or occurrence changes to allow position finding
    const currentKey = `${word}-${currentOccurrenceIndex}`;
    const lastKey = `${lastScrolledWordRef.current}-${lastScrolledOccurrenceRef.current}`;
    if (currentKey !== lastKey) {
      lastScrolledWordRef.current = '';
      lastScrolledOccurrenceRef.current = -1;
    }

    // USE DATABASE POSITIONS - no more regex!
    if (!allPositions || allPositions.length === 0) {
      return;
    }

    if (currentOccurrenceIndex >= allPositions.length) {
      return;
    }

    // Get character index from database
    const targetCharIndex = allPositions[currentOccurrenceIndex];

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

      // Check if we already scrolled to this word/occurrence combination
      const scrollKey = `${word}-${currentOccurrenceIndex}`;
      const lastScrollKey = `${lastScrolledWordRef.current}-${lastScrolledOccurrenceRef.current}`;

      if (scrollKey === lastScrollKey) {
        return;
      }

      // Update refs IMMEDIATELY to prevent duplicate calls (before async operation)
      lastScrolledWordRef.current = word;
      lastScrolledOccurrenceRef.current = currentOccurrenceIndex;

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
              // measureLayout failed
            }
          );
        }, 100);
      }
    }
  }, [layoutReady, currentOccurrenceIndex, word, totalOccurrences, scrollViewRef, onWordPositionFound, allPositions]);

  // Highlight the word and related words in the definition
  const highlightedDefinition = useMemo(() => {
    const parts: Array<{ text: string; type: 'none' | 'main' | 'related'; occurrenceIndex?: number }> = [];

    // In 'root' mode: highlight all related words as 'main' (green)
    // In 'word' mode: highlight only the current word as 'main', others as 'related' (yellow)
    const allWords = highlightEnabled
      ? (highlightMode === 'root'
          ? [word, ...relatedWords.filter(w => w !== word)] // All words in root mode
          : [word, ...relatedWords.filter(w => w !== word)]) // Current word + related in word mode
      : [word];

    if (allWords.length === 0) return processedDefinition;

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
      // In root mode: all words are 'main' (green)
      // In word mode: only first word (idx 0) is 'main', others are 'related' (yellow)
      const isMain = highlightMode === 'root' ? true : idx === 0;
      const variants = generateVariants(w);
      variants.forEach(variant => {
        if (!wordMap.has(variant)) {
          wordMap.set(variant, { originalWord: w, isMain });
        }
      });
    });

    // Sort variants by length (longest first)
    const sortedVariants = Array.from(wordMap.keys()).sort((a, b) => b.length - a.length);

    // Build regex pattern: optional diacritics ONLY on prefixes, exact match on core word
    const pattern = sortedVariants.map(v => {
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
    }).join('|');

    const regex = new RegExp(pattern, 'g');

    let lastIndex = 0;
    let match;
    const mainWordOccurrenceCounts = new Map<string, number>();

    while ((match = regex.exec(processedDefinition)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push({
          text: processedDefinition.substring(lastIndex, match.index),
          type: 'none',
        });
      }

      // Find which word this match corresponds to
      const matchedText = match[0];

      let matchedWordInfo: { originalWord: string; isMain: boolean } | undefined;

      // Find the variant that produced this match
      // We need to preserve diacritics on the core word, ignore only on prefix
      for (const variant of sortedVariants) {
        const حروفالجر = ['ب', 'و', 'ك', 'ف', 'ل'];
        let prefix = '';
        let coreWord = variant;

        // Extract prefix from variant (same logic as pattern building)
        for (const حرف of حروفالجر) {
          if (variant.startsWith(حرف) && variant.length > 1) {
            prefix = حرف;
            coreWord = variant.substring(1);
            break;
          }
        }

        if (!prefix) {
          if (variant.startsWith('ال') && variant.length > 2) {
            prefix = 'ال';
            coreWord = variant.substring(2);
          } else if (variant.startsWith('لل') && variant.length > 2) {
            prefix = 'لل';
            coreWord = variant.substring(2);
          } else if (variant.startsWith('وب') && variant.length > 2) {
            prefix = 'وب';
            coreWord = variant.substring(2);
          } else if (variant.startsWith('وك') && variant.length > 2) {
            prefix = 'وك';
            coreWord = variant.substring(2);
          } else if (variant.startsWith('وس') && variant.length > 2) {
            prefix = 'وس';
            coreWord = variant.substring(2);
          }
        }

        // Check if matchedText ends with exact coreWord (preserving diacritics)
        if (matchedText.endsWith(coreWord)) {
          // Check if prefix matches (ignoring diacritics on prefix only)
          const matchedPrefix = matchedText.substring(0, matchedText.length - coreWord.length);
          if (removeDiacritics(matchedPrefix) === removeDiacritics(prefix)) {
            matchedWordInfo = wordMap.get(variant);
            break;
          }
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
    if (lastIndex < processedDefinition.length) {
      parts.push({
        text: processedDefinition.substring(lastIndex),
        type: 'none',
      });
    }

    return parts;
  }, [processedDefinition, word, relatedWords, highlightEnabled, highlightMode, currentOccurrenceIndex, totalOccurrences]);

  return (
    <View
      ref={definitionCardRef}
      style={[styles.definitionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <Text style={[styles.definitionLabel, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
        {t('dictionaries.definition')}
      </Text>
      <Text
        key={definition.substring(0, 50)}
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
