import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { useAudioStore } from '@store/audioStore';
import { getFlexDirection } from '@/utils/rtl';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useCallback } from 'react';

export function AudioPlayer() {
  const theme = useTheme();
  const { t } = useTranslation();

  const currentWord = useAudioStore(state => state.currentWord);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const repeatMode = useAudioStore(state => state.repeatMode);
  const playbackPosition = useAudioStore(state => state.playbackPosition);
  const playbackDuration = useAudioStore(state => state.playbackDuration);
  const currentRootsList = useAudioStore(state => state.currentRootsList);
  const downloadedFiles = useAudioStore(state => state.downloadedFiles);

  const playAudio = useAudioStore(state => state.playAudio);
  const pauseAudio = useAudioStore(state => state.pauseAudio);
  const stopAudio = useAudioStore(state => state.stopAudio);
  const cycleRepeatMode = useAudioStore(state => state.cycleRepeatMode);
  const playNext = useAudioStore(state => state.playNext);
  const playPrevious = useAudioStore(state => state.playPrevious);

  if (!currentWord) return null;

  // Navigation state - check for playable (downloaded) items
  // MEMOIZED: These loops are expensive and should only run when dependencies change
  const currentIndex = useMemo(
    () => currentRootsList.indexOf(currentWord),
    [currentRootsList, currentWord]
  );

  const canGoNext = useMemo(() => {
    for (let i = currentIndex + 1; i < currentRootsList.length; i++) {
      if (downloadedFiles[currentRootsList[i]]) {
        return true;
      }
    }
    return false;
  }, [currentIndex, currentRootsList, downloadedFiles]);

  const canGoPrevious = useMemo(() => {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (downloadedFiles[currentRootsList[i]]) {
        return true;
      }
    }
    return false;
  }, [currentIndex, currentRootsList, downloadedFiles]);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      await pauseAudio();
    } else {
      if (currentWord) {
        await playAudio(currentWord);
      }
    }
  }, [isPlaying, pauseAudio, playAudio, currentWord]);

  const handleNext = useCallback(async () => {
    await playNext();
  }, [playNext]);

  const handlePrevious = useCallback(async () => {
    await playPrevious();
  }, [playPrevious]);

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
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          paddingBottom: 0,
        },
      ]}
    >
      {/* Close button row */}
      <View style={styles.closeButtonRow}>
        <Pressable
          style={styles.closeButton}
          onPress={stopAudio}
        >
          <Ionicons name="close-circle" size={22} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressContainer, { backgroundColor: theme.colors.background }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.colors.primary, width: `${progress}%` },
          ]}
        />
      </View>

      <View style={[styles.content, { flexDirection: getFlexDirection() }]}>
        <View style={styles.info}>
          <Text style={[styles.wordText, { color: theme.colors.text }]} numberOfLines={1}>
            {currentWord}
          </Text>
          <View style={[styles.timeRow, { flexDirection: getFlexDirection() }]}>
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
              {formatTime(playbackPosition)}
            </Text>
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>/</Text>
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
              {formatTime(playbackDuration)}
            </Text>
          </View>
        </View>

        <View style={[styles.controls, { flexDirection: getFlexDirection() }]}>
          {/* Navigation buttons - First in code = RIGHT in RTL */}
          <Pressable
            style={[styles.smallIconButton, { backgroundColor: theme.colors.background }]}
            onPress={handleNext}
            disabled={!canGoNext}
          >
            <Ionicons
              name="play-skip-forward"
              size={22}
              color={canGoNext ? theme.colors.primary : theme.colors.textSecondary}
            />
          </Pressable>

          {/* Navigation buttons - Second in code = LEFT in RTL */}
          <Pressable
            style={[styles.smallIconButton, { backgroundColor: theme.colors.background }]}
            onPress={handlePrevious}
            disabled={!canGoPrevious}
          >
            <Ionicons
              name="play-skip-back"
              size={22}
              color={canGoPrevious ? theme.colors.primary : theme.colors.textSecondary}
            />
          </Pressable>

          {/* Repeat mode toggle */}
          <Pressable
            style={[
              styles.iconButton,
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
                size={24}
                color={repeatMode !== 0 ? theme.colors.primary : theme.colors.textSecondary}
              />
              {repeatMode === 2 && (
                <Text style={[styles.repeatBadge, { color: theme.colors.primary }]}>1</Text>
              )}
            </View>
          </Pressable>

          {/* Play/Pause button */}
          <Pressable
            style={[styles.playButton, { backgroundColor: theme.colors.primary }]}
            onPress={handlePlayPause}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
          </Pressable>

          {/* Stop button */}
          <Pressable
            style={[styles.iconButton, { backgroundColor: theme.colors.background }]}
            onPress={stopAudio}
          >
            <Ionicons name="stop" size={24} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  progressContainer: {
    height: 3,
    borderRadius: 1.5,
    marginBottom: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  content: {
    alignItems: 'center',
    gap: 20,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  info: {
    flex: 1,
  },
  wordText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  closeButtonRow: {
    paddingRight: 4,
    paddingTop: 2,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeRow: {
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
  },
  controls: {
    gap: 8,
    alignItems: 'center',
  },
  smallIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
});
