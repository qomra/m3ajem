import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation, useTheme } from '@hooks';
import { APIKeyStorage, APIProvider, AllAPIConfigs } from '@services/storage/apiKeyStorage';
import { GatewayAuthService } from '@services/auth/GatewayAuthService';
import { GoogleSignInButton } from '@components/auth/GoogleSignInButton';
import { AppleSignInButton } from '@components/auth/AppleSignInButton';

interface APIConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

const API_PROVIDERS = [
  { id: 'gateway' as APIProvider, name: 'معاجم', icon: 'cloud-outline' as keyof typeof Ionicons.glyphMap, color: '#8B5CF6' },
  { id: 'groq' as APIProvider, name: 'Groq', logo: require('../../../assets/images/groq.png'), color: '#F55036' },
  { id: 'openai' as APIProvider, name: 'OpenAI', logo: require('../../../assets/images/openai.png'), color: '#10A37F' },
  { id: 'anthropic' as APIProvider, name: 'Anthropic', logo: require('../../../assets/images/anthropic.png'), color: '#D97356' },
  { id: 'google' as APIProvider, name: 'Google', logo: require('../../../assets/images/google.png'), color: '#4285F4' },
];

export function APIConfigModal({ visible, onClose, onSave }: APIConfigModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [selectedProvider, setSelectedProvider] = useState<APIProvider>('groq');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, 'idle' | 'success' | 'error'>>({});
  const [showSuccessColor, setShowSuccessColor] = useState<Record<string, boolean>>({});
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasGatewayAuth, setHasGatewayAuth] = useState(false);

  const currentApiKey = apiKeys[selectedProvider] || '';
  const currentConnectionStatus = connectionStatuses[selectedProvider] || 'idle';

  useEffect(() => {
    if (visible) {
      loadExistingConfig();
    }
  }, [visible]);

  const loadExistingConfig = async () => {
    const allConfigs = await APIKeyStorage.getAllConfigs();
    const loadedApiKeys: Record<string, string> = {};
    const loadedStatuses: Record<string, 'idle' | 'success' | 'error'> = {};

    if (allConfigs) {
      if (allConfigs.openai) {
        loadedApiKeys.openai = allConfigs.openai.apiKey;
        loadedStatuses.openai = 'success';
      }
      if (allConfigs.anthropic) {
        loadedApiKeys.anthropic = allConfigs.anthropic.apiKey;
        loadedStatuses.anthropic = 'success';
      }
      if (allConfigs.groq) {
        loadedApiKeys.groq = allConfigs.groq.apiKey;
        loadedStatuses.groq = 'success';
      }
      if (allConfigs.google) {
        loadedApiKeys.google = allConfigs.google.apiKey;
        loadedStatuses.google = 'success';
      }

      setApiKeys(loadedApiKeys);
      setConnectionStatuses(loadedStatuses);
      setSelectedProvider(allConfigs.currentProvider);
    }

    // Check for gateway authentication
    const isGatewayAuth = await GatewayAuthService.isAuthenticated();
    setHasGatewayAuth(isGatewayAuth);
    if (isGatewayAuth) {
      loadedStatuses.gateway = 'success';
      setConnectionStatuses(loadedStatuses);
    }
  };

  const handleTestConnection = async () => {
    Keyboard.dismiss();

    if (!currentApiKey) {
      Alert.alert(t('common.error'), t('settings.apiConfig.pleaseEnterApiKey'));
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatuses(prev => ({ ...prev, [selectedProvider]: 'idle' }));
    setShowSuccessColor(prev => ({ ...prev, [selectedProvider]: false }));

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const isValid = APIKeyStorage.validateAPIKeyFormat(selectedProvider, currentApiKey);

      if (isValid) {
        setConnectionStatuses(prev => ({ ...prev, [selectedProvider]: 'success' }));
        setTimeout(() => {
          setShowSuccessColor(prev => ({ ...prev, [selectedProvider]: true }));
        }, 400);
      } else {
        setConnectionStatuses(prev => ({ ...prev, [selectedProvider]: 'error' }));
        Alert.alert(t('settings.apiConfig.invalidKey'), t('settings.apiConfig.checkApiKeyFormat'));
      }
    } catch {
      setConnectionStatuses(prev => ({ ...prev, [selectedProvider]: 'error' }));
      Alert.alert(t('common.error'), t('settings.apiConfig.connectionError'));
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = async () => {
    const hasAnyConfig = Object.values(connectionStatuses).some(status => status === 'success');
    if (!hasAnyConfig) {
      Alert.alert(t('common.error'), t('settings.apiConfig.pleaseConfigureProvider'));
      return;
    }

    try {
      const allConfigs: AllAPIConfigs = {
        currentProvider: selectedProvider,
      };

      for (const [provider, apiKey] of Object.entries(apiKeys)) {
        if (apiKey && connectionStatuses[provider] === 'success') {
          const model = APIKeyStorage.getModelForProvider(provider as APIProvider);
          allConfigs[provider as keyof AllAPIConfigs] = {
            provider: provider as APIProvider,
            apiKey,
            model,
          } as any;
        }
      }

      await APIKeyStorage.saveAllConfigs(allConfigs);

      onSave();
      onClose();
      Alert.alert(t('settings.apiConfig.success'), t('settings.apiConfig.configSaved'));
    } catch (error) {
      Alert.alert(t('common.error'), t('settings.apiConfig.connectionError'));
    }
  };

  if (!visible) return null;

  const provider = API_PROVIDERS.find(p => p.id === selectedProvider);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <View style={[styles.modal, { backgroundColor: theme.colors.card }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {t('settings.apiConfig.title')}
              </Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Provider Selection */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                  {t('settings.apiConfig.provider')}
                </Text>
                <View style={styles.providerGrid}>
                  {API_PROVIDERS.map((prov) => (
                    <Pressable
                      key={prov.id}
                      style={[
                        styles.providerCard,
                        {
                          backgroundColor: selectedProvider === prov.id
                            ? theme.colors.primary + '20'
                            : theme.colors.background,
                          borderColor: selectedProvider === prov.id
                            ? theme.colors.primary
                            : theme.colors.border,
                          borderWidth: selectedProvider === prov.id ? 2 : 1,
                        },
                      ]}
                      onPress={() => setSelectedProvider(prov.id)}
                    >
                      {connectionStatuses[prov.id] === 'success' && (
                        <View style={styles.providerBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        </View>
                      )}
                      <View style={[styles.providerIcon, { backgroundColor: prov.color + '20' }]}>
                        {'icon' in prov ? (
                          <Ionicons name={prov.icon} size={24} color={prov.color} />
                        ) : (
                          <Image source={prov.logo} style={styles.providerLogo} resizeMode="contain" />
                        )}
                      </View>
                      <Text style={[styles.providerName, { color: theme.colors.text }]}>{prov.name}</Text>
                      <Text style={[styles.providerModel, { color: theme.colors.textSecondary }]}>
                        {t(`settings.apiConfig.model.${prov.id}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* API Key Input or Gateway Auth */}
              {selectedProvider === 'gateway' ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                    {t('smart.auth.signInToM3ajem')}
                  </Text>
                  {hasGatewayAuth ? (
                    <View style={[styles.gatewayStatus, { backgroundColor: theme.colors.background, borderColor: '#10B981' }]}>
                      <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                      <Text style={[styles.gatewayStatusText, { color: theme.colors.text }]}>
                        {t('smart.auth.signedInSuccessfully')}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <GoogleSignInButton
                        onSuccess={() => {
                          setHasGatewayAuth(true);
                          setConnectionStatuses(prev => ({ ...prev, gateway: 'success' }));
                          loadExistingConfig();
                          // Close modal and notify parent to reload
                          setTimeout(() => {
                            onClose();
                          }, 1000); // Give user time to see success message
                        }}
                      />
                      {Platform.OS === 'ios' && (
                        <AppleSignInButton
                          onSuccess={() => {
                            setHasGatewayAuth(true);
                            setConnectionStatuses(prev => ({ ...prev, gateway: 'success' }));
                            loadExistingConfig();
                            // Close modal and notify parent to reload
                            setTimeout(() => {
                              onClose();
                            }, 1000); // Give user time to see success message
                          }}
                        />
                      )}
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                    {t('settings.apiConfig.apiKey')}
                  </Text>
                  <View style={[styles.apiKeyContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <TextInput
                      style={[styles.apiKeyInput, { color: theme.colors.text }]}
                      placeholder={t('settings.apiConfig.enterApiKey')}
                      placeholderTextColor={theme.colors.textTertiary}
                      value={currentApiKey}
                      onChangeText={(text) => {
                        setApiKeys(prev => ({ ...prev, [selectedProvider]: text }));
                        setConnectionStatuses(prev => ({ ...prev, [selectedProvider]: 'idle' }));
                        setShowSuccessColor(prev => ({ ...prev, [selectedProvider]: false }));
                      }}
                      secureTextEntry={!showApiKey}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable onPress={() => setShowApiKey(!showApiKey)} style={styles.eyeButton}>
                      <Ionicons name={showApiKey ? "eye-off-outline" : "eye-outline"} size={20} color={theme.colors.textTertiary} />
                    </Pressable>
                    <Pressable
                      style={[
                        styles.testButton,
                        {
                          backgroundColor:
                            currentConnectionStatus === 'success' && showSuccessColor[selectedProvider]
                              ? '#10B981'
                              : currentConnectionStatus === 'error'
                              ? '#EF4444'
                              : theme.colors.primary,
                          opacity: !currentApiKey ? 0.5 : 1,
                        },
                      ]}
                      onPress={handleTestConnection}
                      disabled={isTestingConnection || !currentApiKey}
                    >
                      {isTestingConnection ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons
                          name={
                            currentConnectionStatus === 'success'
                              ? 'checkmark'
                              : currentConnectionStatus === 'error'
                              ? 'close'
                              : 'flash'
                          }
                          size={18}
                          color="#FFFFFF"
                        />
                      )}
                    </Pressable>
                  </View>
                  <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
                    {currentConnectionStatus === 'success'
                      ? t('settings.apiConfig.connectionSuccess')
                      : currentConnectionStatus === 'error'
                      ? t('settings.apiConfig.connectionError')
                      : t('settings.apiConfig.testConnection')}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
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
                    opacity: !Object.values(connectionStatuses).some(status => status === 'success') ? 0.5 : 1,
                  },
                ]}
                onPress={handleSave}
                disabled={!Object.values(connectionStatuses).some(status => status === 'success')}
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
    maxHeight: '90%',
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  providerCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  providerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  providerLogo: {
    width: 24,
    height: 24,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  providerModel: {
    fontSize: 11,
    textAlign: 'center',
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
  testButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
  },
  gatewayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  gatewayStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
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
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
});
