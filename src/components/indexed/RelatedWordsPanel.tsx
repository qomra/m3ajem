import { View, Text, StyleSheet, Pressable, Modal, TouchableWithoutFeedback } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { Ionicons } from '@expo/vector-icons';

interface RelatedWordsPanelProps {
  visible: boolean;
  words: string[];
  currentWord: string;
  onWordPress: (word: string) => void;
  onClose: () => void;
}

export function RelatedWordsPanel({ visible, words, currentWord, onWordPress, onClose }: RelatedWordsPanelProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </Pressable>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {t('indexed.relatedWords')}
                </Text>
              </View>

              {/* Words List */}
              <View style={styles.relatedWordsList}>
                {words.map((word, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.relatedWordChip,
                      {
                        backgroundColor: word === currentWord ? theme.colors.primary : theme.colors.background,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => {
                      onWordPress(word);
                      onClose();
                    }}
                    disabled={word === currentWord}
                  >
                    <Text
                      style={[
                        styles.relatedWordText,
                        { color: word === currentWord ? theme.colors.background : theme.colors.text },
                      ]}
                    >
                      {word}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  relatedWordsList: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
  },
  relatedWordChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  relatedWordText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
