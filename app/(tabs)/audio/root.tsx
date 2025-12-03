import { View, Text, StyleSheet, ScrollView, StatusBar, Pressable, ActivityIndicator, InteractionManager } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useTranslation, useTheme } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import { useAudioStore } from '@store/audioStore';
import { Ionicons } from '@expo/vector-icons';

// Audio controls as a separate component to isolate re-renders from playback updates
const AudioControlsSection = React.memo(({ root, dictionaryName }: { root: string; dictionaryName: string }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // Individual selectors - stable and efficient
  const currentWord = useAudioStore(state => state.currentWord);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const repeatMode = useAudioStore(state => state.repeatMode);
  const playbackPosition = useAudioStore(state => state.playbackPosition);
  const playbackDuration = useAudioStore(state => state.playbackDuration);
  const playbackSpeed = useAudioStore(state => state.playbackSpeed);
  const downloadProgress = useAudioStore(state => state.downloadProgress[root]);
  const currentRootsList = useAudioStore(state => state.currentRootsList);
  const downloadedFiles = useAudioStore(state => state.downloadedFiles);

  const isDownloaded = useAudioStore(state => state.isDownloaded);
  const hasAudioFile = useAudioStore(state => state.hasAudioFile);
  const playAudio = useAudioStore(state => state.playAudio);
  const pauseAudio = useAudioStore(state => state.pauseAudio);
  const stopAudio = useAudioStore(state => state.stopAudio);
  const cycleRepeatMode = useAudioStore(state => state.cycleRepeatMode);
  const cyclePlaybackSpeed = useAudioStore(state => state.cyclePlaybackSpeed);
  const downloadAudio = useAudioStore(state => state.downloadAudio);
  const deleteAudio = useAudioStore(state => state.deleteAudio);

  const router = useRouter();

  const isThisRootPlaying = currentWord === root && isPlaying;
  const rootDownloaded = isDownloaded(root);
  const audioAvailable = hasAudioFile(root);
  const isDownloading = typeof downloadProgress === 'number';

  // MEMOIZED: These calculations are expensive and should only run when dependencies change
  const currentIndex = useMemo(
    () => currentRootsList.indexOf(root),
    [currentRootsList, root]
  );

  const canGoNextRoot = useMemo(
    () => currentIndex !== -1 && currentIndex < currentRootsList.length - 1,
    [currentIndex, currentRootsList.length]
  );

  const canGoPreviousRoot = useMemo(
    () => currentIndex > 0,
    [currentIndex]
  );

  const canGoNextPlayable = useMemo(() => {
    if (currentIndex === -1) return false;
    for (let i = currentIndex + 1; i < currentRootsList.length; i++) {
      if (downloadedFiles[currentRootsList[i]]) {
        return true;
      }
    }
    return false;
  }, [currentIndex, currentRootsList, downloadedFiles]);

  const canGoPreviousPlayable = useMemo(() => {
    if (currentIndex === -1) return false;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (downloadedFiles[currentRootsList[i]]) {
        return true;
      }
    }
    return false;
  }, [currentIndex, currentRootsList, downloadedFiles]);

  const handlePlayPause = async () => {
    if (!audioAvailable) {
      return;
    }
    if (isThisRootPlaying) {
      await pauseAudio();
    } else if (rootDownloaded) {
      useAudioStore.setState({ currentWord: root });
      await playAudio(root);
    } else if (!isDownloading) {
      await downloadAudio(root);
    }
  };

  const handleDownload = async () => {
    if (!audioAvailable) {
      return;
    }
    if (rootDownloaded) {
      await deleteAudio(root);
    } else {
      await downloadAudio(root);
    }
  };

  const handleNextRoot = async () => {
    if (!canGoNextRoot) return;
    if (isPlaying) await stopAudio();
    const nextWord = currentRootsList[currentIndex + 1];
    router.setParams({ root: nextWord, dictionaryName });
  };

  const handlePreviousRoot = async () => {
    if (!canGoPreviousRoot) return;
    if (isPlaying) await stopAudio();
    const prevWord = currentRootsList[currentIndex - 1];
    router.setParams({ root: prevWord, dictionaryName });
  };

  const handleNextPlayable = async () => {
    if (!canGoNextPlayable) return;
    for (let i = currentIndex + 1; i < currentRootsList.length; i++) {
      if (downloadedFiles[currentRootsList[i]]) {
        const nextWord = currentRootsList[i];
        if (isPlaying) {
          await stopAudio();
          router.setParams({ root: nextWord, dictionaryName });
          setTimeout(() => {
            useAudioStore.setState({ currentWord: nextWord });
            playAudio(nextWord);
          }, 50);
        } else {
          router.setParams({ root: nextWord, dictionaryName });
        }
        return;
      }
    }
  };

  const handlePreviousPlayable = async () => {
    if (!canGoPreviousPlayable) return;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (downloadedFiles[currentRootsList[i]]) {
        const prevWord = currentRootsList[i];
        if (isPlaying) {
          await stopAudio();
          router.setParams({ root: prevWord, dictionaryName });
          setTimeout(() => {
            useAudioStore.setState({ currentWord: prevWord });
            playAudio(prevWord);
          }, 50);
        } else {
          router.setParams({ root: prevWord, dictionaryName });
        }
        return;
      }
    }
  };

  const speedLabel = useMemo(() => {
    if (playbackSpeed === 1.0) return '1x';
    if (playbackSpeed === 1.25) return '1.25x';
    if (playbackSpeed === 1.5) return '1.5x';
    return '2x';
  }, [playbackSpeed]);

  const formatTime = useMemo(() => {
    return (millis: number) => {
      const totalSeconds = Math.floor(millis / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
  }, []);

  const progress = useMemo(
    () => (playbackDuration > 0 ? (playbackPosition / playbackDuration) * 100 : 0),
    [playbackPosition, playbackDuration]
  );

  return (
    <View style={[styles.audioControlsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={[styles.audioControls, { flexDirection: 'row' }]}>
        {/* Delete button - first in code = leftmost in LTR */}
        {audioAvailable && rootDownloaded && !isDownloading && (
          <Pressable
            style={[styles.controlButton, { backgroundColor: theme.colors.background }]}
            onPress={handleDownload}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.colors.error}
            />
          </Pressable>
        )}

        {/* Stop button */}
        <Pressable
          style={[styles.controlButton, { backgroundColor: theme.colors.background }]}
          onPress={stopAudio}
          disabled={!audioAvailable}
        >
          <Ionicons name="stop" size={20} color={audioAvailable ? theme.colors.textSecondary : theme.colors.border} />
        </Pressable>

        {/* Play/Pause button */}
        <Pressable
          style={[
            styles.playButton,
            {
              backgroundColor: isThisRootPlaying ? theme.colors.primary : theme.colors.background,
              borderWidth: isThisRootPlaying ? 0 : 2,
              borderColor: isThisRootPlaying ? theme.colors.primary :
                          (!audioAvailable ? theme.colors.border :
                           (!rootDownloaded && !isDownloading ? theme.colors.textSecondary : theme.colors.primary)),
              opacity: audioAvailable ? 1 : 0.5,
            },
          ]}
          onPress={handlePlayPause}
          disabled={isDownloading || !audioAvailable}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : !audioAvailable ? (
            <Ionicons
              name="volume-mute-outline"
              size={24}
              color={theme.colors.textSecondary}
            />
          ) : (
            <Ionicons
              name={isThisRootPlaying ? 'pause' : (!rootDownloaded ? 'cloud-download-outline' : 'play')}
              size={24}
              color={isThisRootPlaying ? '#fff' :
                     (!rootDownloaded ? theme.colors.textSecondary : theme.colors.primary)}
            />
          )}
        </Pressable>

        {/* Repeat mode toggle */}
        <Pressable
          style={[
            styles.controlButton,
            {
              backgroundColor: repeatMode !== 0
                ? theme.colors.primary + '20'
                : theme.colors.background,
            },
          ]}
          onPress={cycleRepeatMode}
        >
          <View style={styles.repeatButtonContent}>
            <Ionicons
              name={repeatMode === 2 ? "repeat-outline" : "repeat"}
              size={20}
              color={repeatMode !== 0 ? theme.colors.primary : theme.colors.textSecondary}
            />
            {repeatMode === 2 && (
              <Text style={[styles.repeatBadge, { color: theme.colors.primary }]}>1</Text>
            )}
          </View>
        </Pressable>

        {/* Speed button */}
        <Pressable
          style={[
            styles.speedButton,
            {
              backgroundColor: playbackSpeed !== 1.0
                ? theme.colors.primary + '20'
                : theme.colors.background,
            },
          ]}
          onPress={cyclePlaybackSpeed}
        >
          <Text
            style={[
              styles.speedText,
              { color: playbackSpeed !== 1.0 ? theme.colors.primary : theme.colors.textSecondary },
            ]}
          >
            {speedLabel}
          </Text>
        </Pressable>

        {/* Playable navigation - <| (skip-back) = previous - rightmost button */}
        <Pressable
          style={[styles.smallControlButton, { backgroundColor: theme.colors.background }]}
          onPress={handlePreviousPlayable}
          disabled={!canGoPreviousPlayable}
        >
          <Ionicons
            name="play-skip-back"
            size={18}
            color={canGoPreviousPlayable ? theme.colors.primary : theme.colors.textSecondary}
          />
        </Pressable>

        {/* Playable navigation - >| (skip-forward) = next */}
        <Pressable
          style={[styles.smallControlButton, { backgroundColor: theme.colors.background }]}
          onPress={handleNextPlayable}
          disabled={!canGoNextPlayable}
        >
          <Ionicons
            name="play-skip-forward"
            size={18}
            color={canGoNextPlayable ? theme.colors.primary : theme.colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* Progress bar */}
      {isThisRootPlaying && (
        <View style={styles.progressSection}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.background }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.colors.primary, width: `${progress}%` },
              ]}
            />
          </View>
          <View style={[styles.timeRow, { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
              {formatTime(playbackPosition)}
            </Text>
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>/</Text>
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
              {formatTime(playbackDuration)}
            </Text>
          </View>
        </View>
      )}

      {/* Download progress */}
      {isDownloading && (
        <View style={styles.downloadProgressSection}>
          <Text style={[styles.downloadingText, { color: theme.colors.textSecondary }]}>
            {t('audio.downloading')} {Math.round(downloadProgress * 100)}%
          </Text>
        </View>
      )}

      {/* Root navigation buttons - for ALL roots */}
      <View style={[styles.rootNavigationSection, { borderTopColor: theme.colors.border, flexDirection: 'row' }]}>
        <Pressable
          style={[styles.rootNavButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
          onPress={handleNextRoot}
          disabled={!canGoNextRoot}
        >
          <Text style={[styles.rootNavText, { color: canGoNextRoot ? theme.colors.primary : theme.colors.textSecondary }]}>
            {t('audio.nextRoot')}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.rootNavButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
          onPress={handlePreviousRoot}
          disabled={!canGoPreviousRoot}
        >
          <Text style={[styles.rootNavText, { color: canGoPreviousRoot ? theme.colors.primary : theme.colors.textSecondary }]}>
            {t('audio.previousRoot')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

// Info card component - separate from audio controls
const InfoCard = React.memo(({ root, dictionaryName }: { root: string; dictionaryName: string }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const currentSortBy = useAudioStore(state => state.currentSortBy);
  const currentFilter = useAudioStore(state => state.currentFilter);

  return (
    <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.infoRow}>
        <Text style={[styles.infoValue, { color: theme.colors.primary, fontWeight: 'bold' }]}> {root}</Text>
        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
          {t('dictionaries.root')}:
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <View style={styles.infoRow}>
        <Text style={[styles.infoValue, { color: theme.colors.text }]}> {dictionaryName}</Text>
        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
          {t('dictionaries.dictionaryName')}:
        </Text>
      </View>
      {/* Sort and Filter Info */}
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      <View style={styles.filterInfoRow}>
        <Text style={[styles.filterInfoText, { color: theme.colors.textSecondary }]}>
          {t('common.filter')}: <Text style={{ color: theme.colors.text }}>{t(`audio.${currentFilter === 'all' ? 'all' : currentFilter === 'downloaded' ? 'downloaded' : 'notDownloaded'}`)}</Text>
        </Text>
        <Text style={[styles.filterInfoSeparator, { color: theme.colors.textSecondary }]}> • </Text>
        <Text style={[styles.filterInfoText, { color: theme.colors.textSecondary }]}>
          {t('audio.sortBy')}: <Text style={{ color: theme.colors.text }}>{t(`audio.${currentSortBy}`)}</Text>
        </Text>
      </View>
    </View>
  );
});

export default function AudioRootDetailPage() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { root, dictionaryName } = useLocalSearchParams<{ root: string; dictionaryName: string }>();

  const { searchRootInDictionary } = useDictionaryStore();

  const [definition, setDefinition] = useState<string>('');

  // Load definition ONLY after interactions complete (navigation animation done)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      const def = searchRootInDictionary(dictionaryName || '', root || '');
      setDefinition(def || '');
    });

    return () => task.cancel();
  }, [root, dictionaryName, searchRootInDictionary]);

  // When entering root view, clear the list view player and stop any playing audio
  useEffect(() => {
    if (root) {
      const currentState = useAudioStore.getState();
      if (currentState.isPlaying || currentState.currentWord) {
        currentState.stopAudio();
      }
    }
  }, [root]);

  const handleBackPress = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <Pressable style={styles.backButton} onPress={handleBackPress}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>←</Text>
        </Pressable>
      </View>

      {/* Fixed Content - Root, Info, and Audio Controls */}
      <View style={styles.fixedContent}>
        {/* Root & Dictionary Info */}
        {root && dictionaryName && <InfoCard root={root} dictionaryName={dictionaryName} />}

        {/* Audio Controls */}
        {root && dictionaryName && (
          <AudioControlsSection root={root} dictionaryName={dictionaryName} />
        )}
      </View>

      {/* Scrollable Definition */}
      {!definition ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.definitionScrollView}
          contentContainerStyle={styles.definitionScrollContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          scrollEventThrottle={16}
        >
          <View style={[styles.definitionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.definitionLabel, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
              {t('dictionaries.definition')}
            </Text>
            <Text style={[styles.definitionText, { color: theme.colors.text, textAlign: 'right' }]}>
              {definition}
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  filterInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  filterInfoText: {
    fontSize: 12,
  },
  filterInfoSeparator: {
    fontSize: 12,
  },
  audioControlsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  audioControls: {
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  smallControlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatButtonContent: {
    position: 'relative',
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatBadge: {
    position: 'absolute',
    top: 12,
    right: -4,
    fontSize: 10,
    fontWeight: 'bold',
  },
  speedButton: {
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    gap: 6,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timeRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
  },
  downloadProgressSection: {
    marginTop: 8,
  },
  downloadingText: {
    fontSize: 12,
    textAlign: 'center',
  },
  rootNavigationSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
    justifyContent: 'center',
  },
  rootNavButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  rootNavText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fixedContent: {
    padding: 12,
  },
  definitionScrollView: {
    flex: 1,
  },
  definitionScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  definitionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  definitionLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  definitionText: {
    fontSize: 18,
    lineHeight: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
