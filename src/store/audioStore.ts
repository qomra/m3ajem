import { create } from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import audioMapData from '../data/audioMap.json';
import audioRootsData from '../data/audioRoots.json';

interface AudioFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

interface DownloadedFile {
  word: string;
  localUri: string;
  size: number;
  downloadedAt: number;
}

interface AudioState {
  // Audio map from JSON
  audioMap: Record<string, AudioFile>;
  // Pre-computed list of roots with audio (all from لسان العرب)
  availableRoots: string[];
  // Current filtered/sorted list for navigation
  currentRootsList: string[];

  // Filter/Sort state for UI display
  currentSortBy: 'alphabetical' | 'longest' | 'shortest' | 'random';
  currentFilter: 'all' | 'downloaded' | 'not-downloaded';

  // Downloaded files tracking
  downloadedFiles: Record<string, DownloadedFile>;
  downloadProgress: Record<string, number>; // word -> progress (0-1)

  // Playback state
  currentWord: string | null;
  isPlaying: boolean;
  sound: Audio.Sound | null;
  repeatMode: 0 | 1 | 2; // 0 = no repeat, 1 = repeat all, 2 = repeat one
  playbackPosition: number;
  playbackDuration: number;

  // Actions
  loadDownloadedFiles: () => Promise<void>;
  downloadAudio: (word: string) => Promise<void>;
  downloadAll: () => Promise<void>;
  deleteAudio: (word: string) => Promise<void>;
  deleteAll: () => Promise<void>;
  playAudio: (word: string) => Promise<void>;
  pauseAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  cycleRepeatMode: () => void;
  setCurrentRootsList: (roots: string[]) => void;
  setCurrentSortAndFilter: (sortBy: 'alphabetical' | 'longest' | 'shortest' | 'random', filter: 'all' | 'downloaded' | 'not-downloaded') => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  isDownloaded: (word: string) => boolean;
  getDownloadedCount: () => number;
  getTotalSize: () => number;
}

const AUDIO_DIR = `${FileSystem.documentDirectory}audio/`;

// Track completed downloads to ignore late progress callbacks
const completedDownloads = new Set<string>();

// Track which word is currently in initial load to prevent flicker from status callbacks
let loadingWord: string | null = null;

export const useAudioStore = create<AudioState>((set, get) => ({
  audioMap: audioMapData as Record<string, AudioFile>,
  availableRoots: audioRootsData as string[],
  currentRootsList: audioRootsData as string[],
  currentSortBy: 'alphabetical',
  currentFilter: 'all',
  downloadedFiles: {},
  downloadProgress: {},
  currentWord: null,
  isPlaying: false,
  sound: null,
  repeatMode: 0,
  playbackPosition: 0,
  playbackDuration: 0,

  loadDownloadedFiles: async () => {
    try {
      // Ensure audio directory exists
      const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
      }

      // Load downloaded files list from storage
      const filesListPath = `${AUDIO_DIR}downloaded.json`;
      const filesListInfo = await FileSystem.getInfoAsync(filesListPath);

      if (filesListInfo.exists) {
        const content = await FileSystem.readAsStringAsync(filesListPath);
        const downloadedFiles = JSON.parse(content);
        set({ downloadedFiles });
      }
    } catch (error) {
      console.error('Error loading downloaded files:', error);
    }
  },

  downloadAudio: async (word: string) => {
    const { audioMap, downloadedFiles } = get();
    const audioFile = audioMap[word];

    if (!audioFile) {
      return;
    }

    // Already downloaded?
    if (downloadedFiles[word]) {
      return;
    }


    // Clear completed flag for this word (in case of re-download)
    completedDownloads.delete(word);

    // Set progress to 0 immediately for instant feedback
    set((state) => ({
      downloadProgress: { ...state.downloadProgress, [word]: 0 },
    }));

    try {
      const localUri = `${AUDIO_DIR}${word}.mp3`;

      // Download with progress
      const downloadResumable = FileSystem.createDownloadResumable(
        audioFile.url,
        localUri,
        {},
        (downloadProgress) => {
          // Ignore progress callbacks if download already completed
          if (completedDownloads.has(word)) {
            return;
          }

          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          set((state) => ({
            downloadProgress: { ...state.downloadProgress, [word]: progress },
          }));
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (result) {

        // Mark as completed IMMEDIATELY to block late callbacks
        completedDownloads.add(word);

        const newDownloadedFiles = {
          ...downloadedFiles,
          [word]: {
            word,
            localUri: result.uri,
            size: audioFile.size,
            downloadedAt: Date.now(),
          },
        };

        // Save to storage
        const filesListPath = `${AUDIO_DIR}downloaded.json`;
        await FileSystem.writeAsStringAsync(filesListPath, JSON.stringify(newDownloadedFiles));


        // Update state in one atomic operation
        set((state) => {
          const newProgress = { ...state.downloadProgress };
          delete newProgress[word];
          return {
            downloadedFiles: newDownloadedFiles,
            downloadProgress: newProgress,
          };
        });

      }
    } catch (error) {
      console.error(`[Audio] Error downloading audio for ${word}:`, error);
      // Mark as completed even on error to stop progress callbacks
      completedDownloads.add(word);
      // Clear progress on error
      set((state) => {
        const newProgress = { ...state.downloadProgress };
        delete newProgress[word];
        return { downloadProgress: newProgress };
      });
    }
  },

  downloadAll: async () => {
    const { audioMap, downloadedFiles } = get();

    // Download all files that aren't already downloaded
    const wordsToDownload = Object.keys(audioMap).filter(
      (word) => !downloadedFiles[word]
    );

    console.log(`Downloading ${wordsToDownload.length} audio files...`);

    // Download in parallel (limit to 5 at a time to avoid overwhelming)
    const batchSize = 5;
    for (let i = 0; i < wordsToDownload.length; i += batchSize) {
      const batch = wordsToDownload.slice(i, i + batchSize);
      await Promise.all(batch.map((word) => get().downloadAudio(word)));
    }
  },

  deleteAudio: async (word: string) => {
    const { downloadedFiles, currentWord, sound } = get();
    const downloadedFile = downloadedFiles[word];

    if (!downloadedFile) {
      return;
    }

    try {
      // If this audio is currently loaded, stop and unload it
      if (currentWord === word && sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        set({
          sound: null,
          currentWord: null,
          isPlaying: false,
          playbackPosition: 0,
          playbackDuration: 0,
        });
      }

      // Delete file
      await FileSystem.deleteAsync(downloadedFile.localUri, { idempotent: true });

      // Update state
      const newDownloadedFiles = { ...downloadedFiles };
      delete newDownloadedFiles[word];

      // Save to storage
      const filesListPath = `${AUDIO_DIR}downloaded.json`;
      await FileSystem.writeAsStringAsync(filesListPath, JSON.stringify(newDownloadedFiles));

      set({ downloadedFiles: newDownloadedFiles });
    } catch (error) {
      console.error(`Error deleting audio for ${word}:`, error);
    }
  },

  deleteAll: async () => {
    const { sound } = get();

    try {
      // Stop and unload any currently playing audio
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      // Delete entire audio directory
      await FileSystem.deleteAsync(AUDIO_DIR, { idempotent: true });

      // Recreate directory
      await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });

      set({
        downloadedFiles: {},
        sound: null,
        currentWord: null,
        isPlaying: false,
        playbackPosition: 0,
        playbackDuration: 0,
      });
    } catch (error) {
      console.error('Error deleting all audio:', error);
    }
  },

  playAudio: async (word: string) => {
    const { sound: currentSound, currentWord, isPlaying, downloadedFiles, audioMap } = get();

    // If same word and already playing, do nothing
    if (currentSound && currentWord === word && isPlaying) {
      return;
    }

    // If same word but paused, resume or restart if at the end
    if (currentSound && currentWord === word && !isPlaying) {
      const { playbackPosition, playbackDuration } = get();

      // If at or near the end (within 1 second), restart from beginning
      if (playbackDuration > 0 && playbackPosition >= playbackDuration - 1000) {
        await currentSound.setPositionAsync(0);
        set({ playbackPosition: 0 });
      }

      // Protect against flicker during resume
      loadingWord = word;
      set({ isPlaying: true });
      await currentSound.playAsync();
      // Wait a bit for playback to actually start
      await new Promise(resolve => setTimeout(resolve, 50));
      loadingWord = null;
      return;
    }

    // ALWAYS stop and unload current sound before playing a new one
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch (error) {
        console.error('Error stopping current sound:', error);
      }
      set({ sound: null, isPlaying: false });
    }

    // Mark which word is loading
    loadingWord = word;

    // Set playing state IMMEDIATELY for responsive UI
    set({
      currentWord: word,
      isPlaying: true,
      playbackPosition: 0,
      playbackDuration: 0,
    });

    try {
      // Use downloaded file if available, otherwise stream
      const downloadedFile = downloadedFiles[word];
      const audioSource = downloadedFile
        ? { uri: downloadedFile.localUri }
        : { uri: audioMap[word]?.url };

      if (!audioSource.uri) {
        console.error(`No audio source for word: ${word}`);
        set({ isPlaying: false, currentWord: null });
        loadingWord = null;
        return;
      }

      const { sound } = await Audio.Sound.createAsync(audioSource, {
        shouldPlay: true,
      });

      // Set sound in state
      set({ sound });

      // Wait for sound to actually start playing before enabling status updates
      await new Promise(resolve => setTimeout(resolve, 100));
      loadingWord = null;

      // Update playback status
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded) {
          // Only update state if values actually changed to prevent unnecessary re-renders
          const currentState = get();
          const updates: any = {};

          if (currentState.playbackPosition !== status.positionMillis) {
            updates.playbackPosition = status.positionMillis;
          }
          if (currentState.playbackDuration !== (status.durationMillis || 0)) {
            updates.playbackDuration = status.durationMillis || 0;
          }

          // Don't update isPlaying if we're in the middle of loading (initial play or resume)
          const isLoading = loadingWord === currentState.currentWord;
          if (!isLoading && currentState.isPlaying !== status.isPlaying) {
            updates.isPlaying = status.isPlaying;
          }

          if (Object.keys(updates).length > 0) {
            set(updates);
          }

          // Handle playback finished
          if (status.didJustFinish) {
            const { repeatMode, currentWord } = get();

            if (repeatMode === 2) {
              // Repeat one: restart current audio
              await sound.setPositionAsync(0);
              await sound.playAsync();
              set({ playbackPosition: 0, isPlaying: true });
            } else if (repeatMode === 1) {
              // Repeat all: play next
              await get().playNext();
            } else {
              // No repeat: just reset position and stop
              set({ playbackPosition: 0, isPlaying: false });
            }
          }
        }
      });
    } catch (error) {
      console.error(`Error playing audio for ${word}:`, error);
      set({ isPlaying: false, currentWord: null });
      loadingWord = null;
    }
  },

  pauseAudio: async () => {
    const { sound } = get();
    if (sound) {
      await sound.pauseAsync();
      set({ isPlaying: false });
    }
  },

  stopAudio: async () => {
    const { sound } = get();
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      set({
        sound: null,
        currentWord: null,
        isPlaying: false,
        playbackPosition: 0,
        playbackDuration: 0,
      });
    }
  },

  cycleRepeatMode: () => {
    set((state) => ({ repeatMode: ((state.repeatMode + 1) % 3) as 0 | 1 | 2 }));
  },

  setCurrentRootsList: (roots: string[]) => {
    set({ currentRootsList: roots });
  },

  setCurrentSortAndFilter: (sortBy, filter) => {
    set({ currentSortBy: sortBy, currentFilter: filter });
  },

  playNext: async () => {
    const { currentWord, currentRootsList, isPlaying, downloadedFiles } = get();

    if (!currentWord) return;

    const currentIndex = currentRootsList.indexOf(currentWord);
    if (currentIndex === -1) return;

    // Always find next downloaded item (playable)
    let nextIndex = currentIndex + 1;
    while (nextIndex < currentRootsList.length) {
      const nextWord = currentRootsList[nextIndex];
      if (downloadedFiles[nextWord]) {
        // If currently playing, stop and play next
        if (isPlaying) {
          await get().stopAudio();
          await get().playAudio(nextWord);
        } else {
          // Not playing, just navigate
          set({ currentWord: nextWord });
        }
        return;
      }
      nextIndex++;
    }
    // No more downloaded items found
    if (isPlaying) {
      await get().stopAudio();
    }
  },

  playPrevious: async () => {
    const { currentWord, currentRootsList, isPlaying, downloadedFiles } = get();

    if (!currentWord) return;

    const currentIndex = currentRootsList.indexOf(currentWord);
    if (currentIndex === -1) return;

    // Always find previous downloaded item (playable)
    let prevIndex = currentIndex - 1;
    while (prevIndex >= 0) {
      const prevWord = currentRootsList[prevIndex];
      if (downloadedFiles[prevWord]) {
        // If currently playing, stop and play previous
        if (isPlaying) {
          await get().stopAudio();
          await get().playAudio(prevWord);
        } else {
          // Not playing, just navigate
          set({ currentWord: prevWord });
        }
        return;
      }
      prevIndex--;
    }
    // No more downloaded items found
    if (isPlaying) {
      await get().stopAudio();
    }
  },

  isDownloaded: (word: string) => {
    return !!get().downloadedFiles[word];
  },

  getDownloadedCount: () => {
    return Object.keys(get().downloadedFiles).length;
  },

  getTotalSize: () => {
    const { downloadedFiles } = get();
    return Object.values(downloadedFiles).reduce((sum, file) => sum + file.size, 0);
  },
}));
