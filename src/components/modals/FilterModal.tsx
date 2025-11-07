import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useTheme, useTranslation } from '@hooks';
import { getFlexDirection } from '@/utils/rtl';

interface FilterModalProps {
  visible: boolean;
  dictionaries: string[];
  selectedDictionaries: string[];
  onApply: (selected: string[]) => void;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function FilterModal({
  visible,
  dictionaries,
  selectedDictionaries,
  onApply,
  onClose,
}: FilterModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [selected, setSelected] = useState<string[]>(selectedDictionaries);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelected(selectedDictionaries);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleToggleAll = () => {
    if (selected.length === 0) {
      // Select all
      setSelected([]);
    } else {
      // Deselect all (which means "all" is selected)
      setSelected([]);
    }
  };

  const handleToggleDictionary = (dictionary: string) => {
    if (selected.includes(dictionary)) {
      setSelected(selected.filter(d => d !== dictionary));
    } else {
      setSelected([...selected, dictionary]);
    }
  };

  const handleApply = () => {
    onApply(selected);
    onClose();
  };

  const isAllSelected = selected.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.modalContainer,
          {
            backgroundColor: theme.colors.background,
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Dragger */}
        <View style={styles.draggerContainer}>
          <View style={[styles.dragger, { backgroundColor: theme.colors.border }]} />
        </View>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border, flexDirection: getFlexDirection() }]}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeButtonText, { color: theme.colors.primary }]}>✕</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {t('dictionaries.filterByDictionary')}
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* All Dictionaries Chip */}
          <Pressable
            style={[
              styles.chip,
              {
                backgroundColor: isAllSelected ? theme.colors.primary : theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={handleToggleAll}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: isAllSelected ? theme.colors.background : theme.colors.text,
                },
              ]}
            >
              {t('dictionaries.allDictionaries')}
            </Text>
          </Pressable>

          {/* Dictionary Chips */}
          {dictionaries.map(dictionary => {
            const isSelected = selected.includes(dictionary);
            return (
              <Pressable
                key={dictionary}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => handleToggleDictionary(dictionary)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? theme.colors.background : theme.colors.text,
                    },
                  ]}
                >
                  {dictionary}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Apply Button */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <Pressable
            style={[styles.applyButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleApply}
          >
            <Text style={[styles.applyButtonText, { color: theme.colors.background }]}>
              {t('common.apply')}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  draggerContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragger: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  applyButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
