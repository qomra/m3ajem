import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@hooks';
import { useTranslation } from '@hooks/useTranslation';
import { ResourceCard } from './ResourceCard';
import {
  ResourceManager,
  ResourceType,
  AVAILABLE_RESOURCES,
  type ResourceMetadata,
  type ResourceStatus,
} from '@services/resources/ResourceManager';
import { APIKeyStorage } from '@services/storage/apiKeyStorage';
import { SerpAPIStorage } from '@services/storage/serpApiStorage';
import { useRouter } from 'expo-router';

interface ResourceManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ResourceItem {
  metadata: ResourceMetadata;
  status: ResourceStatus;
  canDownload: boolean;
  canDownloadReason?: string;
  canUse: boolean;
  canUseReason?: string;
}

export function ResourceManagerModal({ visible, onClose }: ResourceManagerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [hasSerpAPIKey, setHasSerpAPIKey] = useState(false);

  useEffect(() => {
    if (visible) {
      loadResources();
      loadWebSearchStatus();
    }
  }, [visible]);

  const loadResources = async () => {
    try {
      setLoading(true);

      // Get current provider
      const apiConfig = await APIKeyStorage.getAPIConfig();
      const currentProvider = apiConfig?.provider;

      // Load status for all resources
      const items: ResourceItem[] = [];

      for (const [id, metadata] of Object.entries(AVAILABLE_RESOURCES)) {
        const status = await ResourceManager.getStatus(id as ResourceType);

        const canDownloadResult = await ResourceManager.canDownloadResource(
          id as ResourceType,
          currentProvider
        );

        const canUseResult = await ResourceManager.canUseResource(
          id as ResourceType,
          currentProvider
        );

        items.push({
          metadata,
          status,
          canDownload: canDownloadResult.canDownload,
          canDownloadReason: canDownloadResult.reason,
          canUse: canUseResult.canUse,
          canUseReason: canUseResult.reason,
        });
      }

      setResources(items);
    } catch (error) {
      console.error('Error loading resources:', error);
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setLoading(false);
    }
  };

  const loadWebSearchStatus = async () => {
    try {
      const serpConfig = await SerpAPIStorage.getConfig();
      setHasSerpAPIKey(!!serpConfig?.apiKey);
      setWebSearchEnabled(serpConfig?.enabled ?? false);
    } catch (error) {
      console.error('Error loading web search status:', error);
    }
  };

  const handleWebSearchToggle = async (value: boolean) => {
    try {
      const serpConfig = await SerpAPIStorage.getConfig();

      if (!serpConfig || !serpConfig.apiKey) {
        // No API key configured, show alert
        Alert.alert(
          t('smart.webSearch.title'),
          t('smart.webSearch.requiresSerpAPI'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.serpapi.title'),
              onPress: () => {
                onClose();
                // Navigate to settings after a brief delay
                setTimeout(() => {
                  router.push('/(tabs)/settings');
                }, 100);
              },
            },
          ]
        );
        return;
      }

      // Update enabled status
      await SerpAPIStorage.saveConfig({
        ...serpConfig,
        enabled: value,
      });

      setWebSearchEnabled(value);
    } catch (error) {
      console.error('Error toggling web search:', error);
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleDownload = async (resourceId: ResourceType) => {
    try {
      // Update UI to show downloading
      setResources((prev) =>
        prev.map((item) =>
          item.metadata.id === resourceId
            ? {
                ...item,
                status: {
                  ...item.status,
                  downloading: true,
                  progress: 0,
                  error: undefined,
                },
              }
            : item
        )
      );

      // Start download with progress updates
      await ResourceManager.downloadResource(resourceId, (progress) => {
        setResources((prev) =>
          prev.map((item) =>
            item.metadata.id === resourceId
              ? {
                  ...item,
                  status: {
                    ...item.status,
                    progress,
                  },
                }
              : item
          )
        );
      });

      // Reload to get final status
      await loadResources();

      Alert.alert(
        t('smart.resources.downloadComplete'),
        t('smart.resources.downloadComplete')
      );
    } catch (error) {
      console.error('Error downloading resource:', error);

      // Update with error
      setResources((prev) =>
        prev.map((item) =>
          item.metadata.id === resourceId
            ? {
                ...item,
                status: {
                  ...item.status,
                  downloading: false,
                  error: error instanceof Error ? error.message : String(error),
                },
              }
            : item
        )
      );

      Alert.alert(
        t('smart.resources.downloadError'),
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleDelete = async (resourceId: ResourceType) => {
    Alert.alert(
      t('smart.resources.confirmDelete'),
      t('smart.resources.confirmDelete'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('smart.resources.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await ResourceManager.deleteResource(resourceId);
              await loadResources();

              Alert.alert(
                t('smart.resources.deleteSuccess'),
                t('smart.resources.deleteSuccess')
              );
            } catch (error) {
              console.error('Error deleting resource:', error);
              Alert.alert(
                t('common.error'),
                error instanceof Error ? error.message : String(error)
              );
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t('smart.resources.title')}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: theme.colors.primary }]}>
              {t('common.close')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                {t('common.loading')}
              </Text>
            </View>
          ) : (
            <>
              {/* Downloadable Resources Section */}
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                الموارد القابلة للتحميل
              </Text>

              {resources.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    {t('settings.resources.noResources')}
                  </Text>
                </View>
              ) : (
                resources.map((item) => (
                  <ResourceCard
                    key={item.metadata.id}
                    metadata={item.metadata}
                    status={item.status}
                    canDownload={item.canDownload}
                    canDownloadReason={item.canDownloadReason}
                    canUse={item.canUse}
                    canUseReason={item.canUseReason}
                    onDownload={() => handleDownload(item.metadata.id)}
                    onDelete={() => handleDelete(item.metadata.id)}
                  />
                ))
              )}

              {/* Web Search Section */}
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginTop: 24 }]}>
                أدوات البحث
              </Text>

              <View style={[styles.webSearchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.webSearchHeader}>
                  <View style={styles.webSearchIcon}>
                    <Ionicons name="search-outline" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.webSearchInfo}>
                    <Text style={[styles.webSearchTitle, { color: theme.colors.text }]}>
                      {t('smart.webSearch.title')}
                    </Text>
                    <Text style={[styles.webSearchSubtitle, { color: theme.colors.textSecondary }]}>
                      {hasSerpAPIKey
                        ? webSearchEnabled
                          ? 'مفعّل'
                          : 'معطّل'
                        : t('smart.webSearch.requiresSerpAPI')}
                    </Text>
                  </View>
                  <Switch
                    value={webSearchEnabled && hasSerpAPIKey}
                    onValueChange={handleWebSearchToggle}
                    disabled={!hasSerpAPIKey}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary + '60' }}
                    thumbColor={webSearchEnabled && hasSerpAPIKey ? theme.colors.primary : theme.colors.textTertiary}
                  />
                </View>

                {!hasSerpAPIKey && (
                  <Pressable
                    style={[styles.configureButton, { backgroundColor: theme.colors.primary + '10' }]}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        router.push('/(tabs)/settings');
                      }, 100);
                    }}
                  >
                    <Ionicons name="settings-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.configureButtonText, { color: theme.colors.primary }]}>
                      تكوين SerpAPI
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
  },
  webSearchCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  webSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  webSearchIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F610',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSearchInfo: {
    flex: 1,
  },
  webSearchTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  webSearchSubtitle: {
    fontSize: 14,
  },
  configureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  configureButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
