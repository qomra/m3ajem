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
import { GatewayAuthService } from '@services/auth/GatewayAuthService';
import type { GatewayUser } from '@services/auth/GatewayAuthService';
import { useAudioStore } from '@store/audioStore';
import { useChatStore } from '@store/chatStore';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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
  const [gatewayUser, setGatewayUser] = useState<GatewayUser | null>(null);

  // Get store methods
  const { deleteAll: deleteAllAudio, downloadAll: downloadAllAudio, getDownloadedCount, getTotalSize } = useAudioStore();
  const { deleteAllConversations, chatService, userDb } = useChatStore();

  useEffect(() => {
    loadAPIStatus();
    loadSerpAPIStatus();
    loadGatewayUser();
  }, []);

  const loadAPIStatus = async () => {
    const apiConfig = await APIKeyStorage.getAPIConfig();
    setHasAPIKey(!!apiConfig?.apiKey);
  };

  const loadSerpAPIStatus = async () => {
    const serpConfig = await SerpAPIStorage.getConfig();
    setHasSerpAPI(!!serpConfig?.apiKey);
  };

  const loadGatewayUser = async () => {
    const user = await GatewayAuthService.getCurrentUser();
    setGatewayUser(user);
  };

  const handleAPIConfigSaved = () => {
    loadAPIStatus();
  };

  const handleSerpAPIConfigSaved = () => {
    loadSerpAPIStatus();
  };

  const handleDeleteAllAudio = () => {
    const downloadedCount = getDownloadedCount();

    if (downloadedCount === 0) {
      Alert.alert(t('common.info'), t('audio.noFilesToDelete'));
      return;
    }

    Alert.alert(
      t('audio.deleteAll'),
      t('audio.confirmDeleteAll'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.apply'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllAudio();
              Alert.alert(t('common.success'), `${t('audio.deleteAll')} (${downloadedCount} ${t('audio.filesDownloaded')})`);
            } catch (error) {
              console.error('Error deleting audio:', error);
              Alert.alert(t('common.error'), String(error));
            }
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
            try {
              await deleteAllConversations();
              Alert.alert(t('common.success'), t('settings.deleteChat'));
            } catch (error) {
              console.error('Error deleting chat:', error);
              Alert.alert(t('common.error'), String(error));
            }
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
            try {
              await Promise.all([
                deleteAllAudio(),
                deleteAllConversations()
              ]);
              Alert.alert(t('common.success'), t('settings.deleteAllData'));
            } catch (error) {
              console.error('Error deleting all data:', error);
              Alert.alert(t('common.error'), String(error));
            }
          },
        },
      ]
    );
  };

  const handleDownloadAllData = async () => {
    if (!userDb) {
      Alert.alert(t('common.error'), t('settings.databaseNotInitialized'));
      return;
    }

    try {
      // Get the database file path
      const dbPath = `${FileSystem.documentDirectory}SQLite/user.db`;

      // Check if database file exists
      const dbInfo = await FileSystem.getInfoAsync(dbPath);
      if (!dbInfo.exists) {
        Alert.alert(t('common.error'), t('settings.databaseFileNotFound'));
        return;
      }

      // Copy database to a shareable location
      const fileName = `user-data-${Date.now()}.db`;
      const exportPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({
        from: dbPath,
        to: exportPath,
      });

      // Share the database file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(exportPath, {
          dialogTitle: t('settings.downloadAllData'),
          mimeType: 'application/octet-stream',
        });
      } else {
        Alert.alert(t('common.success'), `${t('settings.downloadAllData')}: ${exportPath}`);
      }
    } catch (error) {
      console.error('Error exporting database:', error);
      Alert.alert(t('common.error'), String(error));
    }
  };

  const handleDownloadAllAudio = async () => {
    Alert.alert(
      t('audio.downloadAll'),
      t('audio.confirmDownloadAll'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.apply'),
          onPress: async () => {
            try {
              // Show loading message
              Alert.alert(t('common.info'), t('audio.downloading'));
              await downloadAllAudio();
              Alert.alert(t('common.success'), t('audio.downloadAll'));
            } catch (error) {
              console.error('Error downloading all audio:', error);
              Alert.alert(t('common.error'), String(error));
            }
          },
        },
      ]
    );
  };

  const handleDownloadChatHistory = async () => {
    if (!chatService) {
      Alert.alert(t('common.error'), t('settings.chatServiceNotInitialized'));
      return;
    }

    try {
      // Get all conversations with their messages
      const conversations = await chatService.conversationManager.getAllConversations();

      if (conversations.length === 0) {
        Alert.alert(t('common.info'), t('settings.noChatHistoryToExport'));
        return;
      }

      // Get full conversation details including messages
      const fullConversations = await Promise.all(
        conversations.map(async (conv) => {
          const messages = await chatService.getConversationMessages(conv.id);
          return {
            ...conv,
            messages,
          };
        })
      );

      // Create JSON export
      const exportData = {
        exportDate: new Date().toISOString(),
        conversationsCount: fullConversations.length,
        conversations: fullConversations,
      };

      // Write to file
      const fileName = `chat-history-${Date.now()}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(exportData, null, 2));

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          dialogTitle: t('settings.exportChat'),
          mimeType: 'application/json',
        });
      } else {
        Alert.alert(t('common.success'), `${t('settings.exportChat')}: ${filePath}`);
      }
    } catch (error) {
      console.error('Error exporting chat history:', error);
      Alert.alert(t('common.error'), String(error));
    }
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

  const handleLogout = () => {
    Alert.alert(
      t('smart.auth.signOut'),
      t('settings.confirmLogout'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('smart.auth.signOut'),
          style: 'destructive',
          onPress: async () => {
            await GatewayAuthService.clearToken();
            setGatewayUser(null);
            Alert.alert(t('common.success'), t('settings.logoutSuccess'));
          },
        },
      ]
    );
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
            title={t('settings.apiConfig.title')}
            subtitle={hasAPIKey || gatewayUser ? t('settings.apiKeyConfigured') : t('settings.enterApiKey')}
            onPress={() => setShowAPIModal(true)}
          />
          <SettingsItem
            icon="search-outline"
            title={t('settings.serpapi.title')}
            subtitle={hasSerpAPI ? t('settings.serpapi.enabled') : t('settings.serpapi.description')}
            onPress={() => setShowSerpAPIModal(true)}
          />
          {gatewayUser && (
            <SettingsItem
              icon="log-out-outline"
              title={t('smart.auth.signOut')}
              subtitle={`${t('smart.auth.signedInAs')} ${gatewayUser.email} • ${gatewayUser.daily_requests}/${gatewayUser.daily_limit} ${t('smart.rateLimit')}`}
              onPress={handleLogout}
              danger
            />
          )}
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
