import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@hooks';
import { useTranslation } from '@hooks/useTranslation';
import type { ResourceMetadata, ResourceStatus } from '@services/resources/ResourceManager';

interface ResourceCardProps {
  metadata: ResourceMetadata;
  status: ResourceStatus;
  canDownload: boolean;
  canDownloadReason?: string;
  canUse: boolean;
  canUseReason?: string;
  onDownload: () => void;
  onDelete: () => void;
}

export function ResourceCard({
  metadata,
  status,
  canDownload,
  canDownloadReason,
  canUse,
  canUseReason,
  onDownload,
  onDelete,
}: ResourceCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const formatSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const getStatusColor = () => {
    if (status.downloaded) return theme.colors.success;
    if (status.downloading) return theme.colors.primary;
    return theme.colors.textSecondary;
  };

  const getStatusText = () => {
    if (status.downloading) {
      return `${t('smart.resources.downloading')} ${status.progress}%`;
    }
    if (status.downloaded) {
      return t('smart.resources.downloaded');
    }
    return t('smart.resources.notDownloaded');
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {metadata.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
        {metadata.description}
      </Text>

      {/* Info Row */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
            {t('smart.resources.size')}
          </Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}>
            {formatSize(metadata.size)}
          </Text>
        </View>

        {metadata.requiredProvider && (
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              {t('smart.resources.requires')}
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {metadata.requiredProvider === 'openai' ? 'OpenAI' : 'Google'}
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      {status.downloading && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: theme.colors.primary, width: `${status.progress}%` },
            ]}
          />
        </View>
      )}

      {/* Error Message */}
      {status.error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {status.error}
        </Text>
      )}

      {/* Cannot Download Warning */}
      {!status.downloaded && !canDownload && canDownloadReason && (
        <Text style={[styles.warningText, { color: theme.colors.warning }]}>
          ⚠️ {canDownloadReason}
        </Text>
      )}

      {/* Cannot Use Warning */}
      {status.downloaded && !canUse && canUseReason && (
        <Text style={[styles.warningText, { color: theme.colors.warning }]}>
          ⚠️ {canUseReason}
        </Text>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        {!status.downloaded && !status.downloading && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.downloadButton,
              { backgroundColor: theme.colors.primary },
              !canDownload && styles.buttonDisabled,
            ]}
            onPress={onDownload}
            disabled={!canDownload || status.downloading}
          >
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
              {t('smart.resources.download')}
            </Text>
          </TouchableOpacity>
        )}

        {status.downloading && (
          <View style={[styles.button, styles.downloadingButton, { backgroundColor: theme.colors.surface }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.buttonText, { color: theme.colors.text, marginLeft: 8 }]}>
              {t('smart.resources.downloading')}
            </Text>
          </View>
        )}

        {status.downloaded && (
          <TouchableOpacity
            style={[styles.button, styles.deleteButton, { backgroundColor: theme.colors.error + '15' }]}
            onPress={onDelete}
          >
            <Text style={[styles.buttonText, { color: theme.colors.error }]}>
              {t('smart.resources.delete')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  downloadButton: {
    // Primary button
  },
  downloadingButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  deleteButton: {
    // Error button with light background
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
