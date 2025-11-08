import { View, Text, StyleSheet, TextInput, Pressable, Platform, Alert, ActivityIndicator } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { Ionicons } from '@expo/vector-icons';
import { getFlexDirection } from '@/utils/rtl';
import { useState } from 'react';
import { useAudioStore } from '@store/audioStore';

interface AudioHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'alphabetical' | 'longest' | 'shortest' | 'random';
  onSortChange: (sortBy: 'alphabetical' | 'longest' | 'shortest' | 'random') => void;
  filterDownloaded: 'all' | 'downloaded' | 'not-downloaded';
  onFilterChange: (filter: 'all' | 'downloaded' | 'not-downloaded') => void;
  totalCount: number;
  filteredCount: number;
}

export function AudioHeader({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  filterDownloaded,
  onFilterChange,
  totalCount,
  filteredCount,
}: AudioHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const downloadAll = useAudioStore(state => state.downloadAll);
  const deleteAll = useAudioStore(state => state.deleteAll);
  const getDownloadedCount = useAudioStore(state => state.getDownloadedCount);
  const getTotalSize = useAudioStore(state => state.getTotalSize);

  const downloadedCount = getDownloadedCount();
  const totalSize = getTotalSize();

  const handleDownloadAll = async () => {
    Alert.alert(
      t('audio.downloadAll'),
      t('audio.confirmDownloadAll'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('audio.downloadAll'),
          onPress: async () => {
            setIsDownloadingAll(true);
            try {
              await downloadAll();
            } catch (error) {
              Alert.alert(t('common.error'), t('errors.downloadError'));
            } finally {
              setIsDownloadingAll(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAll = async () => {
    if (downloadedCount === 0) {
      Alert.alert(t('common.info'), t('audio.noFilesToDelete'));
      return;
    }

    Alert.alert(
      t('audio.deleteAll'),
      `${t('audio.confirmDeleteAll')} (${downloadedCount} ${t('audio.filesDownloaded')})`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('audio.deleteAll'),
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAll(true);
            try {
              await deleteAll();
            } catch (error) {
              Alert.alert(t('common.error'), t('errors.unexpectedError'));
            } finally {
              setIsDeletingAll(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('audio.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {t('audio.lisanArab')} • {filteredCount}/{totalCount}
        </Text>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={t('audio.searchRoot')}
          placeholderTextColor={theme.colors.textSecondary}
          textAlign="right"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={[styles.controlsRow, { flexDirection: getFlexDirection() }]}>
        <Pressable
          style={[styles.filterButton, { backgroundColor: theme.colors.background }]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options" size={20} color={theme.colors.primary} />
          <Text style={[styles.filterButtonText, { color: theme.colors.primary }]}>
            {t('common.filter')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.colors.background }]}
          onPress={handleDownloadAll}
          disabled={isDownloadingAll}
        >
          {isDownloadingAll ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="download" size={20} color={theme.colors.primary} />
          )}
          <Text style={[styles.filterButtonText, { color: theme.colors.primary }]}>
            {t('audio.downloadAll')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.colors.background }]}
          onPress={handleDeleteAll}
          disabled={isDeletingAll || downloadedCount === 0}
        >
          {isDeletingAll ? (
            <ActivityIndicator size="small" color={theme.colors.error} />
          ) : (
            <Ionicons
              name="trash"
              size={20}
              color={downloadedCount > 0 ? theme.colors.error : theme.colors.textSecondary}
            />
          )}
          <Text
            style={[
              styles.filterButtonText,
              { color: downloadedCount > 0 ? theme.colors.error : theme.colors.textSecondary },
            ]}
          >
            {t('audio.deleteAll')}
          </Text>
        </Pressable>
      </View>

      {/* Storage info */}
      {downloadedCount > 0 && (
        <View style={styles.storageInfo}>
          <Text style={[styles.storageText, { color: theme.colors.textSecondary }]}>
            {downloadedCount} {t('audio.filesDownloaded')} • {(totalSize / (1024 * 1024)).toFixed(2)} MB
          </Text>
        </View>
      )}

      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: theme.colors.textSecondary }]}>
              {t('audio.sortBy')}
            </Text>
            <View style={[styles.filterOptions, { flexDirection: getFlexDirection() }]}>
              <Pressable
                style={[
                  styles.filterOption,
                  { backgroundColor: sortBy === 'alphabetical' ? theme.colors.primary : theme.colors.background },
                ]}
                onPress={() => onSortChange('alphabetical')}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: sortBy === 'alphabetical' ? '#fff' : theme.colors.text }
                ]}>
                  {t('audio.alphabetical')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.filterOption,
                  { backgroundColor: sortBy === 'longest' ? theme.colors.primary : theme.colors.background },
                ]}
                onPress={() => onSortChange('longest')}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: sortBy === 'longest' ? '#fff' : theme.colors.text }
                ]}>
                  {t('audio.longest')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.filterOption,
                  { backgroundColor: sortBy === 'shortest' ? theme.colors.primary : theme.colors.background },
                ]}
                onPress={() => onSortChange('shortest')}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: sortBy === 'shortest' ? '#fff' : theme.colors.text }
                ]}>
                  {t('audio.shortest')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.filterOption,
                  { backgroundColor: sortBy === 'random' ? theme.colors.primary : theme.colors.background },
                ]}
                onPress={() => onSortChange('random')}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: sortBy === 'random' ? '#fff' : theme.colors.text }
                ]}>
                  {t('audio.random')}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: theme.colors.textSecondary }]}>
              {t('common.filter')}
            </Text>
            <View style={[styles.filterOptions, { flexDirection: getFlexDirection() }]}>
              <Pressable
                style={[
                  styles.filterOption,
                  { backgroundColor: filterDownloaded === 'all' ? theme.colors.primary : theme.colors.background },
                ]}
                onPress={() => onFilterChange('all')}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: filterDownloaded === 'all' ? '#fff' : theme.colors.text }
                ]}>
                  {t('audio.all')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.filterOption,
                  { backgroundColor: filterDownloaded === 'downloaded' ? theme.colors.primary : theme.colors.background },
                ]}
                onPress={() => onFilterChange('downloaded')}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: filterDownloaded === 'downloaded' ? '#fff' : theme.colors.text }
                ]}>
                  {t('audio.downloaded')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.filterOption,
                  { backgroundColor: filterDownloaded === 'not-downloaded' ? theme.colors.primary : theme.colors.background },
                ]}
                onPress={() => onFilterChange('not-downloaded')}
              >
                <Text style={[
                  styles.filterOptionText,
                  { color: filterDownloaded === 'not-downloaded' ? '#fff' : theme.colors.text }
                ]}>
                  {t('audio.notDownloaded')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  titleRow: {
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'right',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  controlsRow: {
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    minWidth: 100,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  storageInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  storageText: {
    fontSize: 13,
    textAlign: 'right',
  },
  filtersContainer: {
    marginTop: 12,
    gap: 16,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  filterOptions: {
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
