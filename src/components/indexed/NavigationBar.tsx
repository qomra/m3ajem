import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { getFlexDirection } from '@/utils/rtl';
import { Ionicons } from '@expo/vector-icons';

interface NavigationBarProps {
  currentWordIndex: number;
  totalWords: number;
  onNextWord: () => void;
  onPreviousWord: () => void;
  currentInstanceIndex?: number;
  totalInstances?: number;
  currentOccurrenceIndex?: number;
  totalOccurrences?: number;
  onNextInstance?: () => void;
  onPreviousInstance?: () => void;
}

export function NavigationBar({
  currentWordIndex,
  totalWords,
  onNextWord,
  onPreviousWord,
  currentInstanceIndex,
  totalInstances,
  currentOccurrenceIndex = 0,
  totalOccurrences = 0,
  onNextInstance,
  onPreviousInstance,
}: NavigationBarProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const showInstanceNav = totalInstances && totalInstances > 1 && currentInstanceIndex !== undefined;

  // Determine if instance navigation buttons should be disabled
  const canGoToPreviousInstance = currentOccurrenceIndex > 0 || (currentInstanceIndex !== undefined && currentInstanceIndex > 0);
  const canGoToNextInstance =
    currentOccurrenceIndex < totalOccurrences - 1 ||
    (currentInstanceIndex !== undefined && totalInstances !== undefined && currentInstanceIndex < totalInstances - 1);

  return (
    <View style={[styles.navBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
      {/* Instance Navigation (only if multiple instances) */}
      {showInstanceNav && onNextInstance && onPreviousInstance && (
        <View style={[styles.navSection, { flexDirection: getFlexDirection() }]}>
          <Pressable
            style={[
              styles.navButton,
              {
                backgroundColor: theme.colors.primary + '20',
                borderColor: theme.colors.primary,
                opacity: canGoToPreviousInstance ? 1 : 0.5,
              },
            ]}
            onPress={onPreviousInstance}
            disabled={!canGoToPreviousInstance}
          >
            <Text style={[styles.navButtonText, { color: theme.colors.primary }]}>
              {t('indexed.previousInstance')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
          </Pressable>

          <Pressable
            style={[
              styles.navButton,
              {
                backgroundColor: theme.colors.primary + '20',
                borderColor: theme.colors.primary,
                opacity: canGoToNextInstance ? 1 : 0.5,
              },
            ]}
            onPress={onNextInstance}
            disabled={!canGoToNextInstance}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
            <Text style={[styles.navButtonText, { color: theme.colors.primary }]}>
              {t('indexed.nextInstance')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Word Navigation */}
      <View style={[styles.navSection, { flexDirection: getFlexDirection() }]}>
        <Pressable
          style={[
            styles.navButton,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              opacity: currentWordIndex <= 0 ? 0.5 : 1,
            },
          ]}
          onPress={onPreviousWord}
          disabled={currentWordIndex <= 0}
        >
          <Text style={[styles.navButtonText, { color: theme.colors.text }]}>{t('indexed.previousWord')}</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
        </Pressable>

        <Pressable
          style={[
            styles.navButton,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              opacity: currentWordIndex >= totalWords - 1 ? 0.5 : 1,
            },
          ]}
          onPress={onNextWord}
          disabled={currentWordIndex >= totalWords - 1}
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
          <Text style={[styles.navButtonText, { color: theme.colors.text }]}>{t('indexed.nextWord')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  navSection: {
    gap: 8,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
