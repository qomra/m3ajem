import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useTheme, useTranslation } from '@hooks';
import { useAudioStore } from '@store/audioStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface AudioRootCardProps {
  root: string;
  dictionaryName: string;
  isCurrentlyPlaying: boolean;
}

export function AudioRootCard({
  root,
  dictionaryName,
  isCurrentlyPlaying,
}: AudioRootCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [isDisabled, setIsDisabled] = useState(false);

  const isDownloaded = useAudioStore(state => state.isDownloaded(root));
  const downloadProgress = useAudioStore(state => state.downloadProgress[root]);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const currentWord = useAudioStore(state => state.currentWord);
  const playAudio = useAudioStore(state => state.playAudio);
  const pauseAudio = useAudioStore(state => state.pauseAudio);
  const downloadAudio = useAudioStore(state => state.downloadAudio);
  const deleteAudio = useAudioStore(state => state.deleteAudio);

  const isThisRootPlaying = currentWord === root && isPlaying;
  const isCurrentWord = currentWord === root;
  const isDownloading = typeof downloadProgress === 'number';

  const handlePlayPause = async () => {
    if (isThisRootPlaying) {
      await pauseAudio();
    } else if (isDownloaded) {
      // Only play if downloaded
      await playAudio(root);
    } else if (!isDownloading) {
      // Not downloaded, start download
      await downloadAudio(root);
    }
  };

  const handleDownload = async () => {
    if (isDownloaded) {
      await deleteAudio(root);
    } else {
      await downloadAudio(root);
    }
  };

  const handleCardPress = () => {
    if (isDisabled) return;
    setIsDisabled(true);

    router.push({
      pathname: '/(tabs)/audio/root',
      params: { root, dictionaryName },
    });
  };

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: theme.colors.card,
        borderColor: isCurrentWord ? theme.colors.primary : theme.colors.border,
        borderWidth: isCurrentWord ? 2 : 1,
      }
    ]}>
      <Pressable onPress={handleCardPress} disabled={isDisabled}>
        <View style={[styles.header, { flexDirection: 'row' }]}>
          <View style={[styles.controls, { flexDirection: 'row' }]}>
            {/* Delete button - only show when downloaded */}
            {isDownloaded && !isDownloading && (
              <Pressable
                style={[styles.iconButton, { backgroundColor: theme.colors.background }]}
                onPress={handleDownload}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={theme.colors.error}
                />
              </Pressable>
            )}

            {/* Play/Pause button - shows download icon if not downloaded */}
            <Pressable
              style={[
                styles.playButton,
                {
                  backgroundColor: isThisRootPlaying ? theme.colors.primary : theme.colors.background,
                  borderWidth: isThisRootPlaying ? 0 : 2,
                  borderColor: isThisRootPlaying ? theme.colors.primary :
                              (!isDownloaded && !isDownloading ? theme.colors.textSecondary : theme.colors.primary),
                },
              ]}
              onPress={handlePlayPause}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons
                  name={isThisRootPlaying ? 'pause' : (!isDownloaded ? 'cloud-download-outline' : 'play')}
                  size={20}
                  color={isThisRootPlaying ? '#fff' :
                         (!isDownloaded ? theme.colors.textSecondary : theme.colors.primary)}
                />
              )}
            </Pressable>
          </View>

          <View style={styles.info}>
            <Text style={[styles.rootText, { color: theme.colors.text }]}>{root}</Text>
          </View>
        </View>
      </Pressable>

      {/* Download indicator */}
      {isDownloading && (
        <View style={styles.downloadProgress}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.background }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.colors.primary, width: `${downloadProgress * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
            {t('audio.downloading')} {Math.round(downloadProgress * 100)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
  },
  rootText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 14,
    textAlign: 'right',
  },
  controls: {
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadProgress: {
    marginTop: 12,
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
  progressText: {
    fontSize: 12,
    textAlign: 'right',
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  playingText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
