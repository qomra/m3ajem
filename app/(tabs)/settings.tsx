import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation, useTheme } from '@hooks';
import { useSettingsStore } from '@store/settingsStore';
import { APIConfigModal } from '@components/settings/APIConfigModal';
import { SerpAPIConfigModal } from '@components/settings/SerpAPIConfigModal';
import { APIKeyStorage } from '@services/storage/apiKeyStorage';
import { SerpAPIStorage } from '@services/storage/serpApiStorage';

// Settings Section Component
const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
};

// Settings Item Component
const SettingsItem = ({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = true,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  danger?: boolean;
}) => {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsItem,
        {
          backgroundColor: theme.colors.card,
          borderBottomColor: theme.colors.border,
          opacity: pressed && onPress ? 0.7 : 1,
        },
      ]}
      disabled={!onPress}
    >
      <View style={styles.settingsItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: danger ? '#FEE2E2' : theme.colors.background }]}>
          <Ionicons name={icon} size={20} color={danger ? '#EF4444' : theme.colors.primary} />
        </View>
        <View style={styles.settingsItemText}>
          <Text style={{ fontSize: 16, fontWeight: '500', color: danger ? '#EF4444' : theme.colors.text }}>{title}</Text>
          {subtitle && <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>}
        </View>
      </View>

      {rightElement || (showChevron && onPress && (
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
      ))}
    </Pressable>
  );
};

export default function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { theme: themePreference, setTheme } = useSettingsStore();

  const [showAPIModal, setShowAPIModal] = useState(false);
  const [showSerpAPIModal, setShowSerpAPIModal] = useState(false);
  const [hasAPIKey, setHasAPIKey] = useState(false);
  const [hasSerpAPI, setHasSerpAPI] = useState(false);

  useEffect(() => {
    loadAPIStatus();
    loadSerpAPIStatus();
  }, []);

  const loadAPIStatus = async () => {
    const apiConfig = await APIKeyStorage.getAPIConfig();
    setHasAPIKey(!!apiConfig?.apiKey);
  };

  const loadSerpAPIStatus = async () => {
    const serpConfig = await SerpAPIStorage.getConfig();
    setHasSerpAPI(!!serpConfig?.apiKey);
  };

  const handleAPIConfigSaved = () => {
    loadAPIStatus();
  };

  const handleSerpAPIConfigSaved = () => {
    loadSerpAPIStatus();
  };

  const handleDeleteAllAudio = () => {
    Alert.alert(
      t('audio.deleteAll'),
      t('audio.confirmDeleteAll'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.apply'),
          style: 'destructive',
          onPress: async () => {
            // TODO: Implement audio deletion
            Alert.alert(t('common.info'), t('audio.noFilesToDelete'));
          },
        },
      ]
    );
  };

  const handleDeleteChat = () => {
    Alert.alert(
      t('settings.deleteChat'),
      t('settings.confirmDelete'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.apply'),
          style: 'destructive',
          onPress: async () => {
            // TODO: Implement chat deletion
            Alert.alert(t('common.info'), 'سيتم تنفيذ هذه الميزة لاحقاً');
          },
        },
      ]
    );
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      t('settings.deleteAllData'),
      t('settings.confirmDeleteAllData'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.apply'),
          style: 'destructive',
          onPress: async () => {
            // TODO: Implement all data deletion (audio + chat)
            Alert.alert(t('common.info'), 'سيتم تنفيذ هذه الميزة لاحقاً');
          },
        },
      ]
    );
  };

  const handleDownloadAllData = async () => {
    Alert.alert(t('common.info'), 'سيتم تنفيذ هذه الميزة لاحقاً');
    // TODO: Implement database export to ZIP
  };

  const handleDownloadAllAudio = async () => {
    Alert.alert(t('common.info'), 'سيتم تنفيذ هذه الميزة لاحقاً');
    // TODO: Implement bulk audio download
  };

  const handleDownloadChatHistory = async () => {
    Alert.alert(t('common.info'), 'سيتم تنفيذ هذه الميزة لاحقاً');
    // TODO: Implement chat history export
  };

  const handleOpenAudioFolder = async () => {
    const url = 'https://drive.google.com/drive/folders/YOUR_FOLDER_ID'; // TODO: Replace with actual folder ID
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(t('common.error'), 'لا يمكن فتح الرابط');
    }
  };

  const handleAbout = () => {
    Alert.alert(
      t('settings.about'),
      t('settings.aboutContent') + '\n\n' + t('settings.version') + ': ' + t('settings.versionNumber'),
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {t('settings.title')}
          </Text>
        </View>

        {/* Appearance Section */}
        <SettingsSection title={t('settings.sections.appearance')}>
          <SettingsItem
            icon="color-palette-outline"
            title={t('settings.theme')}
            subtitle={
              themePreference === 'light'
                ? t('settings.themeLight')
                : themePreference === 'dark'
                ? t('settings.themeDark')
                : t('settings.themeAuto')
            }
            rightElement={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setTheme('light')}
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor: themePreference === 'light' ? theme.colors.primary : theme.colors.background,
                      borderWidth: 1,
                      borderColor: themePreference === 'light' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="sunny-outline"
                    size={16}
                    color={themePreference === 'light' ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setTheme('dark')}
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor: themePreference === 'dark' ? theme.colors.primary : theme.colors.background,
                      borderWidth: 1,
                      borderColor: themePreference === 'dark' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="moon-outline"
                    size={16}
                    color={themePreference === 'dark' ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setTheme('auto')}
                  style={[
                    styles.themeButton,
                    {
                      backgroundColor: themePreference === 'auto' ? theme.colors.primary : theme.colors.background,
                      borderWidth: 1,
                      borderColor: themePreference === 'auto' ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={16}
                    color={themePreference === 'auto' ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                </Pressable>
              </View>
            }
            showChevron={false}
          />
        </SettingsSection>

        {/* AI Section */}
        <SettingsSection title={t('settings.sections.ai')}>
          <SettingsItem
            icon="key-outline"
            title={t('settings.apiKey')}
            subtitle={hasAPIKey ? t('settings.apiKeyConfigured') : t('settings.enterApiKey')}
            onPress={() => setShowAPIModal(true)}
          />
          <SettingsItem
            icon="search-outline"
            title={t('settings.serpapi.title')}
            subtitle={hasSerpAPI ? t('settings.serpapi.enabled') : t('settings.serpapi.description')}
            onPress={() => setShowSerpAPIModal(true)}
          />
        </SettingsSection>

        {/* Data Section */}
        <SettingsSection title={t('settings.sections.data')}>
          <SettingsItem
            icon="trash-outline"
            title={t('audio.deleteAll')}
            subtitle={t('audio.confirmDeleteAll')}
            onPress={handleDeleteAllAudio}
            danger
          />
          <SettingsItem
            icon="chatbubbles-outline"
            title={t('settings.deleteChat')}
            subtitle={t('settings.confirmDelete')}
            onPress={handleDeleteChat}
            danger
          />
          <SettingsItem
            icon="nuclear-outline"
            title={t('settings.deleteAllData')}
            subtitle={t('settings.confirmDeleteAllData')}
            onPress={handleDeleteAllData}
            danger
          />
          <SettingsItem
            icon="download-outline"
            title={t('settings.downloadAllData')}
            subtitle={t('settings.downloadAllDataSubtitle')}
            onPress={handleDownloadAllData}
          />
          <SettingsItem
            icon="musical-notes-outline"
            title={t('settings.downloadAllAudio')}
            subtitle={t('settings.downloadAllAudioSubtitle')}
            onPress={handleDownloadAllAudio}
          />
          <SettingsItem
            icon="folder-open-outline"
            title={t('settings.openAudioFolder')}
            subtitle={t('settings.openAudioFolderSubtitle')}
            onPress={handleOpenAudioFolder}
          />
          <SettingsItem
            icon="chatbox-ellipses-outline"
            title={t('settings.exportChat')}
            subtitle={t('settings.chatHistory')}
            onPress={handleDownloadChatHistory}
          />
        </SettingsSection>

        {/* About Section */}
        <SettingsSection title={t('settings.about')}>
          <SettingsItem
            icon="information-circle-outline"
            title={t('settings.about')}
            subtitle={t('settings.version') + ' ' + t('settings.versionNumber')}
            onPress={handleAbout}
          />
        </SettingsSection>
      </ScrollView>

      {/* API Configuration Modal */}
      <APIConfigModal
        visible={showAPIModal}
        onClose={() => setShowAPIModal(false)}
        onSave={handleAPIConfigSaved}
      />

      {/* SerpAPI Configuration Modal */}
      <SerpAPIConfigModal
        visible={showSerpAPIModal}
        onClose={() => setShowSerpAPIModal(false)}
        onSave={handleSerpAPIConfigSaved}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsItemText: {
    flex: 1,
  },
  themeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
