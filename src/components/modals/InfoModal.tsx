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
import { useEffect, useRef } from 'react';
import { useTheme, useTranslation } from '@hooks';

interface InfoModalProps {
  visible: boolean;
  dictionaryName: string;
  rootsCount: number;
  description?: string;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function InfoModal({ visible, dictionaryName, rootsCount, description: descriptionProp, onClose }: InfoModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
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

  // Use provided description prop if available, otherwise try to get from translations
  const description = descriptionProp || (dictionaryName
    ? t(`dictionaries.descriptions.${dictionaryName}` as any) || ''
    : '');

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
        <View style={[styles.header, { borderBottomColor: theme.colors.border, flexDirection: 'row' }]}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeButtonText, { color: theme.colors.primary }]}>✕</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text, flex: 1, textAlign: 'right' }]}>
            {t('dictionaries.dictionaryInfo')}
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.dictionaryName, { color: theme.colors.text, textAlign: 'right' }]}>{dictionaryName}</Text>

          <View style={[styles.statsRow, { flexDirection: 'row', justifyContent: 'flex-end' }]}>
            <Text style={[styles.statsValue, { color: theme.colors.primary }]}>
              {rootsCount.toLocaleString('ar-SA')}
            </Text>
            <Text style={[styles.statsLabel, { color: theme.colors.textSecondary }]}>
              {t('dictionaries.rootsCount')}:
            </Text>
          </View>

          <Text style={[styles.description, { color: theme.colors.textSecondary, textAlign: 'right' }]}>{description}</Text>
        </ScrollView>
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
    height: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  draggerContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragger: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
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
  },
  dictionaryName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsRow: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  statsLabel: {
    fontSize: 16,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    lineHeight: 28,
  },
});
