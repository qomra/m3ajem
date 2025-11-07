import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme, useTranslation } from '@hooks';
import { getFlexDirection } from '@/utils/rtl';

interface DataExtractionModalProps {
  visible: boolean;
  isExtracting: boolean;
  progress: number;
  currentStep: string;
  onAgree: () => void;
  onCancel: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PROGRESS_BAR_WIDTH = SCREEN_WIDTH - 80;

export function DataExtractionModal({
  visible,
  isExtracting,
  progress,
  currentStep,
  onAgree,
  onCancel,
}: DataExtractionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const progressWidth = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    Animated.timing(progressWidth, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const progressBarWidth = progressWidth.interpolate({
    inputRange: [0, 100],
    outputRange: [0, PROGRESS_BAR_WIDTH],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity }]} />

        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.background,
              opacity,
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={[styles.icon, { color: theme.colors.primary }]}>📦</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {isExtracting ? t('extraction.extracting') : t('extraction.title')}
          </Text>

          {/* Description */}
          {!isExtracting && (
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
              {t('extraction.description')}
            </Text>
          )}

          {/* Data Size Info */}
          {!isExtracting && (
            <View style={[styles.infoBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={[styles.infoRow, { flexDirection: getFlexDirection() }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  {t('extraction.compressedSize')}
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>~26 MB</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.infoRow, { flexDirection: getFlexDirection() }]}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
                  {t('extraction.uncompressedSize')}
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>~42 MB</Text>
              </View>
            </View>
          )}

          {/* Progress Section */}
          {isExtracting && (
            <View style={styles.progressSection}>
              {/* Current Step */}
              <Text style={[styles.currentStep, { color: theme.colors.textSecondary }]}>
                {currentStep}
              </Text>

              {/* Progress Bar */}
              <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.card }]}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor: theme.colors.primary,
                      width: progressBarWidth,
                    },
                  ]}
                />
              </View>

              {/* Percentage */}
              <Text style={[styles.percentage, { color: theme.colors.text }]}>
                {Math.round(progress)}%
              </Text>
            </View>
          )}

          {/* Buttons */}
          {!isExtracting && (
            <View style={[styles.buttons, { flexDirection: getFlexDirection() }]}>
              <Pressable
                style={[styles.button, styles.agreeButton, { backgroundColor: theme.colors.primary }]}
                onPress={onAgree}
              >
                <Text style={[styles.buttonText, styles.agreeButtonText, { color: theme.colors.background }]}>
                  {t('extraction.agree')}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.button, styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={onCancel}
              >
                <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Extracting Note */}
          {isExtracting && (
            <Text style={[styles.note, { color: theme.colors.textSecondary }]}>
              {t('extraction.pleaseWait')}
            </Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  infoBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  infoRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  progressSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  currentStep: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttons: {
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  agreeButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  agreeButtonText: {
    // color set dynamically
  },
  note: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
});
