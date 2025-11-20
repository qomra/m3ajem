import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation, useTheme } from '@hooks';
import { SerpAPIStorage, SerpAPIConfig } from '@services/storage/serpApiStorage';

interface SerpAPIConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function SerpAPIConfigModal({ visible, onClose, onSave }: SerpAPIConfigModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (visible) {
      loadExistingConfig();
    }
  }, [visible]);

  const loadExistingConfig = async () => {
    const config = await SerpAPIStorage.getConfig();
    if (config) {
      setApiKey(config.apiKey);
    } else {
      setApiKey('');
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      Alert.alert(t('common.error'), t('settings.serpapi.apiKeyPlaceholder'));
      return;
    }

    try {
      // Get existing config to preserve enabled state
      const existingConfig = await SerpAPIStorage.getConfig();

      const config: SerpAPIConfig = {
        apiKey: apiKey.trim(),
        enabled: existingConfig?.enabled ?? true, // Preserve enabled state, default to true
      };

      await SerpAPIStorage.saveConfig(config);

      onSave();
      onClose();
      Alert.alert(t('common.success'), t('settings.serpapi.saved'));
    } catch (error) {
      console.error('Error saving SerpAPI config:', error);
      Alert.alert(t('common.error'), t('errors.unexpectedError'));
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      t('settings.serpapi.title'),
      'هل أنت متأكد من حذف تكوين SerpAPI؟',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.apply'),
          style: 'destructive',
          onPress: async () => {
            await SerpAPIStorage.deleteConfig();
            onSave();
            onClose();
            Alert.alert(t('common.success'), 'تم حذف التكوين');
          },
        },
      ]
    );
  };

  const handleGetKey = async () => {
    const url = 'https://serpapi.com/';
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <View style={[styles.modal, { backgroundColor: theme.colors.card }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {t('settings.serpapi.title')}
              </Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Description */}
              <View style={styles.section}>
                <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                  {t('settings.serpapi.description')}
                </Text>
              </View>

              {/* API Key Input */}
              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.colors.text }]}>
                  {t('settings.serpapi.apiKey')}
                </Text>
                <View style={[styles.apiKeyContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <TextInput
                    style={[styles.apiKeyInput, { color: theme.colors.text }]}
                    placeholder={t('settings.serpapi.apiKeyPlaceholder')}
                    placeholderTextColor={theme.colors.textTertiary}
                    value={apiKey}
                    onChangeText={setApiKey}
                    secureTextEntry={!showApiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable onPress={() => setShowApiKey(!showApiKey)} style={styles.eyeButton}>
                    <Ionicons name={showApiKey ? "eye-off-outline" : "eye-outline"} size={20} color={theme.colors.textTertiary} />
                  </Pressable>
                </View>
              </View>

              {/* Get Key Link */}
              <Pressable onPress={handleGetKey} style={styles.linkButton}>
                <Ionicons name="open-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                  {t('settings.serpapi.getKey')}
                </Text>
              </Pressable>

              {/* Info Box */}
              <View style={[styles.infoBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                  سيتم استخدام البحث على الإنترنت فقط إذا لم يجد المساعد الإجابة في الأدوات المحلية
                </Text>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
              <Pressable
                style={[styles.button, styles.deleteButton, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
                onPress={handleDelete}
              >
                <Text style={{ color: '#EF4444', fontWeight: '600' }}>{t('common.delete')}</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.cancelButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={onClose}
              >
                <Text style={{ color: theme.colors.textSecondary }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  styles.saveButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: !apiKey.trim() ? 0.5 : 1,
                  },
                ]}
                onPress={handleSave}
                disabled={!apiKey.trim()}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    paddingHorizontal: 20,
  },
  modal: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    paddingTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  apiKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  apiKeyInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 8,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 20,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    borderWidth: 1,
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
});
