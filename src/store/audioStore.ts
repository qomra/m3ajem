import { create } from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import {
  MediaControl,
  PlaybackState,
  Command,
  MediaControlEvent,
} from 'expo-media-control';
import audioMapData from '../data/audioMap.json';

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

// Persisted player state (saved to disk)
interface PersistedPlayerState {
  currentWord: string | null;
  playbackPosition: number;
  playbackDuration: number;
  currentSortBy: 'alphabetical' | 'longest' | 'shortest' | 'random';
  currentFilter: 'all' | 'downloaded' | 'not-downloaded';
  repeatMode: 0 | 1 | 2;
  playbackSpeed: number;
}

interface AudioState {
  // Audio map from JSON (provides URLs for roots that have audio files)
  audioMap: Record<string, AudioFile>;
  // All roots from the database (set by dictionaryStore)
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
  playbackSpeed: number; // 1.0, 1.25, 1.5, 2.0

  // Persistence state
  isPlayerStateLoaded: boolean;

  // Actions
  loadDownloadedFiles: () => Promise<void>;
  loadPlayerState: (downloadedFiles?: Record<string, DownloadedFile>) => Promise<void>;
  savePlayerState: () => Promise<void>;
  downloadAudio: (word: string) => Promise<void>;
  downloadAll: () => Promise<void>;
  deleteAudio: (word: string) => Promise<void>;
  deleteAll: () => Promise<void>;
  playAudio: (word: string) => Promise<void>;
  pauseAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  cycleRepeatMode: () => void;
  cyclePlaybackSpeed: () => Promise<void>;
  setCurrentRootsList: (roots: string[]) => void;
  setCurrentSortAndFilter: (sortBy: 'alphabetical' | 'longest' | 'shortest' | 'random', filter: 'all' | 'downloaded' | 'not-downloaded') => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  isDownloaded: (word: string) => boolean;
  getDownloadedCount: () => number;
  getTotalSize: () => number;
  setAvailableRoots: (roots: string[]) => void;
  hasAudioFile: (word: string) => boolean;
}

const AUDIO_DIR = `${FileSystem.documentDirectory}audio/`;
const PLAYER_STATE_FILE = `${AUDIO_DIR}player-state.json`;

// Track completed downloads to ignore late progress callbacks
const completedDownloads = new Set<string>();

// Track which word is currently in initial load to prevent flicker from status callbacks
let loadingWord: string | null = null;

// Track if audio mode has been configured
let audioModeConfigured = false;

// Track if media controls have been initialized
let mediaControlsInitialized = false;

// Store reference for handling media control commands
let audioStoreRef: (() => AudioState) | null = null;

// Configure audio mode for background playback
// Note: expo-media-control handles audio session, so we use minimal config here
async function configureAudioMode() {
  if (audioModeConfigured) return;

  try {
    // Use interruptionModeIOS: 'doNotMix' as required by media controls
    await Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: 1, // DoNotMix - required for lock screen controls
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeAndroid: 1, // DoNotMix
    });
    audioModeConfigured = true;
    console.log('[Audio] Audio mode configured');
  } catch (error) {
    console.error('Error configuring audio mode:', error);
  }
}

// Initialize media controls for lock screen / control center
async function initializeMediaControls(getState: () => AudioState) {
  if (mediaControlsInitialized) {
    console.log('[Audio] Media controls already initialized');
    return;
  }

  console.log('[Audio] Initializing media controls...');

  try {
    // Store reference for command handling
    audioStoreRef = getState;

    await MediaControl.enableMediaControls({
      capabilities: [
        Command.PLAY,
        Command.PAUSE,
        Command.STOP,
        Command.NEXT_TRACK,
        Command.PREVIOUS_TRACK,
      ],
      ios: { skipInterval: 15 },
      android: { skipInterval: 15 },
    });

    console.log('[Audio] Media controls enabled, adding listener...');

    // Add listener for remote commands (lock screen buttons, headphone buttons)
    MediaControl.addListener((event: MediaControlEvent) => {
      console.log('[Audio] Received media command:', event.command);
      if (!audioStoreRef) return;
      const state = audioStoreRef();

      switch (event.command) {
        case Command.PLAY:
          if (state.currentWord) {
            state.playAudio(state.currentWord);
          }
          break;
        case Command.PAUSE:
          state.pauseAudio();
          break;
        case Command.STOP:
          state.stopAudio();
          break;
        case Command.NEXT_TRACK:
          state.playNext();
          break;
        case Command.PREVIOUS_TRACK:
          state.playPrevious();
          break;
      }
    });

    mediaControlsInitialized = true;
    console.log('[Audio] Media controls initialized successfully');
  } catch (error) {
    console.error('[Audio] Error initializing media controls:', error);
  }
}

// Update lock screen metadata (Now Playing info)
async function updateMediaMetadata(word: string, durationMs: number) {
  try {
    const metadata = {
      title: word,
      artist: 'لسان العرب',
      album: 'المعجم',
      duration: Math.round(durationMs / 1000), // Convert to seconds
    };
    console.log('[Audio] Setting media metadata:', metadata);
    await MediaControl.updateMetadata(metadata);
    console.log('[Audio] Media metadata set successfully');
  } catch (error) {
    console.error('[Audio] Error updating media metadata:', error);
  }
}

// Update lock screen playback state
async function updateMediaPlaybackState(
  state: 'playing' | 'paused' | 'stopped',
  positionMs?: number
) {
  try {
    let playbackState: PlaybackState;
    switch (state) {
      case 'playing':
        playbackState = PlaybackState.PLAYING;
        break;
      case 'paused':
        playbackState = PlaybackState.PAUSED;
        break;
      case 'stopped':
      default:
        playbackState = PlaybackState.STOPPED;
        break;
    }

    const positionSeconds = positionMs ? Math.round(positionMs / 1000) : 0;
    await MediaControl.updatePlaybackState(playbackState, positionSeconds);
  } catch (error) {
    console.error('[Audio] Error updating playback state:', error);
  }
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audioMap: audioMapData as Record<string, AudioFile>,
  availableRoots: [], // Will be set from dictionaryStore
  currentRootsList: [], // Will be populated when availableRoots is set
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
  playbackSpeed: 1.0,
  isPlayerStateLoaded: false,

  loadPlayerState: async (loadedFiles?: Record<string, DownloadedFile>) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(PLAYER_STATE_FILE);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(PLAYER_STATE_FILE);
        const savedState = JSON.parse(content) as PersistedPlayerState;

        // Only restore if the word is still downloaded (file exists)
        // Use passed files directly to avoid stale state issues
        const downloadedFiles = loadedFiles || get().downloadedFiles;
        const wordStillDownloaded = savedState.currentWord
          ? !!downloadedFiles[savedState.currentWord]
          : false;

        console.log('[Audio] Checking if word is downloaded:', {
          word: savedState.currentWord,
          downloadedFilesCount: Object.keys(downloadedFiles).length,
          isDownloaded: wordStillDownloaded,
        });

        set({
          currentSortBy: savedState.currentSortBy || 'alphabetical',
          currentFilter: savedState.currentFilter || 'all',
          repeatMode: savedState.repeatMode ?? 0,
          playbackSpeed: savedState.playbackSpeed || 1.0,
          // Only restore playback state if the file is still downloaded
          currentWord: wordStillDownloaded ? savedState.currentWord : null,
          playbackPosition: wordStillDownloaded ? savedState.playbackPosition : 0,
          playbackDuration: wordStillDownloaded ? savedState.playbackDuration : 0,
          isPlayerStateLoaded: true,
        });

        console.log('[Audio] Player state restored:', {
          currentWord: wordStillDownloaded ? savedState.currentWord : '(not restored - file deleted)',
          position: savedState.playbackPosition,
          sortBy: savedState.currentSortBy,
          filter: savedState.currentFilter,
        });
      } else {
        set({ isPlayerStateLoaded: true });
      }
    } catch (error) {
      console.error('[Audio] Error loading player state:', error);
      set({ isPlayerStateLoaded: true });
    }
  },

  savePlayerState: async () => {
    try {
      const {
        currentWord,
        playbackPosition,
        playbackDuration,
        currentSortBy,
        currentFilter,
        repeatMode,
        playbackSpeed,
      } = get();

      const stateToSave: PersistedPlayerState = {
        currentWord,
        playbackPosition,
        playbackDuration,
        currentSortBy,
        currentFilter,
        repeatMode,
        playbackSpeed,
      };

      // Ensure directory exists before writing
      const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
      }

      await FileSystem.writeAsStringAsync(PLAYER_STATE_FILE, JSON.stringify(stateToSave));
      console.log('[Audio] Player state SAVED:', {
        word: currentWord,
        position: Math.round(playbackPosition / 1000) + 's',
        sortBy: currentSortBy,
        filter: currentFilter,
      });
    } catch (error) {
      console.error('[Audio] Error saving player state:', error);
    }
  },

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
        const savedFiles = JSON.parse(content) as Record<string, DownloadedFile>;

        // Verify each file still exists and fix paths if needed
        const validFiles: Record<string, DownloadedFile> = {};
        let hasInvalidFiles = false;

        for (const [word, file] of Object.entries(savedFiles)) {
          // Use current AUDIO_DIR path (handles container ID changes)
          const currentPath = `${AUDIO_DIR}${word}.mp3`;
          const fileInfo = await FileSystem.getInfoAsync(currentPath);

          if (fileInfo.exists) {
            // File exists - update path to current container path
            validFiles[word] = {
              ...file,
              localUri: currentPath,
            };
          } else {
            // File doesn't exist - mark for cleanup
            hasInvalidFiles = true;
            console.log(`[Audio] Removing invalid entry: ${word} (file not found)`);
          }
        }

        // Save cleaned list if we removed any invalid entries
        if (hasInvalidFiles) {
          await FileSystem.writeAsStringAsync(filesListPath, JSON.stringify(validFiles));
        }

        set({ downloadedFiles: validFiles });

        // Load player state after downloaded files are loaded
        // Pass validFiles directly to avoid stale state issues
        await get().loadPlayerState(validFiles);
      } else {
        // No downloaded files, but still load player state for sort/filter
        await get().loadPlayerState({});
      }
    } catch (error) {
      console.error('Error loading downloaded files:', error);
      set({ isPlayerStateLoaded: true });
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

    const downloadStartTime = Date.now();
    const fileSizeKB = Math.round(audioFile.size / 1024);
    console.log(`[Audio] Starting download: ${word} (${fileSizeKB} KB)`);

    try {
      const localUri = `${AUDIO_DIR}${word}.mp3`;

      // Build list of URLs to try for Google Drive files
      // Google Drive blocks direct downloads for large files, so we try multiple formats
      const urlsToTry: string[] = [];

      if (audioFile.url.includes('drive.google.com')) {
        // Extract file ID from various Google Drive URL formats
        let fileId = audioFile.id;
        if (!fileId) {
          const idMatch = audioFile.url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (idMatch) fileId = idMatch[1];
        }

        if (fileId) {
          // Try multiple URL formats - some work better than others for large files
          urlsToTry.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
          urlsToTry.push(`https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`);
          urlsToTry.push(audioFile.url + (audioFile.url.includes('?') ? '&' : '?') + 'confirm=t');
        } else {
          urlsToTry.push(audioFile.url);
        }
      } else {
        urlsToTry.push(audioFile.url);
      }

      let result: FileSystem.FileSystemDownloadResult | undefined;
      let lastError: Error | null = null;

      for (const downloadUrl of urlsToTry) {
        console.log(`[Audio] Trying URL format: ${downloadUrl.substring(0, 80)}...`);

        // Download with progress
        const downloadResumable = FileSystem.createDownloadResumable(
          downloadUrl,
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

        try {
          result = await downloadResumable.downloadAsync();

          if (result) {
            // Check file size immediately
            const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
            const actualSize = (fileInfo as any).size || 0;
            const sizeRatio = actualSize / audioFile.size;

            if (sizeRatio >= 0.9) {
              // Success! This URL format worked
              console.log(`[Audio] URL format worked!`);
              break;
            } else {
              console.log(`[Audio] URL returned wrong size (${Math.round(actualSize / 1024)} KB), trying next...`);
              // Delete the bad file and try next URL
              await FileSystem.deleteAsync(result.uri, { idempotent: true });
              result = undefined;
            }
          }
        } catch (e) {
          lastError = e as Error;
          console.log(`[Audio] URL failed: ${(e as Error).message}`);
        }
      }

      // Handle failures
      if (!result) {
        const downloadDuration = ((Date.now() - downloadStartTime) / 1000).toFixed(1);
        console.error(`[Audio] Download FAILED for ${word} after ${downloadDuration}s: all URL formats failed`);
        console.error(`[Audio]   Google Drive blocks direct downloads for large files (>100MB).`);
        console.error(`[Audio]   Consider migrating audio files to a proper CDN (AWS S3, Cloudflare R2, etc.)`);

        completedDownloads.add(word);
        set((state) => {
          const newProgress = { ...state.downloadProgress };
          delete newProgress[word];
          return { downloadProgress: newProgress };
        });

        if (lastError) {
          throw lastError;
        }
        return;
      }

      // Success - file passed size validation in the loop
      const downloadDuration = ((Date.now() - downloadStartTime) / 1000).toFixed(1);
      const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
      const actualSize = (fileInfo as any).size || 0;

      // Mark as completed IMMEDIATELY to block late callbacks
      completedDownloads.add(word);

      console.log(`[Audio] Download complete: ${word} (${fileSizeKB} KB in ${downloadDuration}s, verified)`);

      // Update state in TRULY atomic operation using state updater
      // This ensures we always work with the latest state, avoiding race conditions
      set((state) => {
        const newProgress = { ...state.downloadProgress };
        delete newProgress[word];
        return {
          downloadedFiles: {
            ...state.downloadedFiles,
            [word]: {
              word,
              localUri: result.uri,
              size: actualSize,
              downloadedAt: Date.now(),
            },
          },
          downloadProgress: newProgress,
        };
      });

      // Save to storage AFTER state update (use latest state)
      const filesListPath = `${AUDIO_DIR}downloaded.json`;
      await FileSystem.writeAsStringAsync(filesListPath, JSON.stringify(get().downloadedFiles));
    } catch (error) {
      const downloadDuration = ((Date.now() - downloadStartTime) / 1000).toFixed(1);
      console.error(`[Audio] Error downloading ${word} (${fileSizeKB} KB) after ${downloadDuration}s:`, error);
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
    // Initialize media controls for lock screen FIRST (sets up audio session)
    await initializeMediaControls(get);

    // Then configure expo-av audio mode
    await configureAudioMode();

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
      // Update lock screen state on resume
      await updateMediaPlaybackState('playing', get().playbackPosition);
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

    // Check if this is a restored word with a saved position
    // (currentWord is already set but no sound is loaded)
    const isRestoredWord = currentWord === word;
    const savedPosition = isRestoredWord ? get().playbackPosition : 0;
    const savedDuration = isRestoredWord ? get().playbackDuration : 0;

    // Set playing state IMMEDIATELY for responsive UI
    // Preserve position if this is a restored word
    set({
      currentWord: word,
      isPlaying: true,
      playbackPosition: savedPosition,
      playbackDuration: savedDuration,
    });

    try {
      // Use downloaded file if available and exists, otherwise stream
      const downloadedFile = downloadedFiles[word];
      let audioSource: { uri: string } | null = null;

      if (downloadedFile) {
        // Verify the local file still exists
        const fileInfo = await FileSystem.getInfoAsync(downloadedFile.localUri);
        if (fileInfo.exists) {
          audioSource = { uri: downloadedFile.localUri };
        } else {
          // File doesn't exist anymore - remove from downloaded list
          console.log(`[Audio] Local file missing for ${word}, falling back to stream`);
          const newDownloadedFiles = { ...downloadedFiles };
          delete newDownloadedFiles[word];
          set({ downloadedFiles: newDownloadedFiles });
          // Save updated list
          const filesListPath = `${AUDIO_DIR}downloaded.json`;
          await FileSystem.writeAsStringAsync(filesListPath, JSON.stringify(newDownloadedFiles));
        }
      }

      // Fall back to streaming if no local file
      if (!audioSource && audioMap[word]?.url) {
        audioSource = { uri: audioMap[word].url };
      }

      if (!audioSource) {
        console.error(`No audio source for word: ${word}`);
        set({ isPlaying: false, currentWord: null });
        loadingWord = null;
        return;
      }

      const { playbackSpeed } = get();
      const { sound } = await Audio.Sound.createAsync(audioSource, {
        shouldPlay: true,
        rate: playbackSpeed,
        shouldCorrectPitch: true,
        positionMillis: savedPosition, // Start from saved position if restored
      });

      // Set sound in state
      set({ sound });

      // If we have a saved position, seek to it (backup in case positionMillis didn't work)
      if (savedPosition > 0) {
        try {
          await sound.setPositionAsync(savedPosition);
          console.log(`[Audio] Restored playback position: ${Math.round(savedPosition / 1000)}s`);
        } catch (e) {
          console.log('[Audio] Could not restore position:', e);
        }
      }

      // Save state when new word starts playing
      get().savePlayerState();

      // Update lock screen with track info
      const status = await sound.getStatusAsync();
      const duration = status.isLoaded ? (status.durationMillis || 0) : 0;
      await updateMediaMetadata(word, duration);
      await updateMediaPlaybackState('playing', savedPosition);

      // Wait for sound to actually start playing before enabling status updates
      await new Promise(resolve => setTimeout(resolve, 100));
      loadingWord = null;

      // Update playback status
      // OPTIMIZATION: Throttle position updates to every 100ms to reduce re-renders
      let lastPositionUpdate = 0;
      let lastStateSave = Date.now();
      let lastLockScreenUpdate = Date.now();
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded) {
          // Only update state if values actually changed to prevent unnecessary re-renders
          const currentState = get();
          const updates: any = {};

          // Throttle position updates to reduce re-render frequency
          const now = Date.now();
          const positionChanged = currentState.playbackPosition !== status.positionMillis;
          const shouldUpdatePosition = positionChanged && (now - lastPositionUpdate) >= 100;

          if (shouldUpdatePosition) {
            updates.playbackPosition = status.positionMillis;
            lastPositionUpdate = now;

            // Periodically save state during playback (every 5 seconds)
            if (now - lastStateSave >= 5000) {
              lastStateSave = now;
              get().savePlayerState();
            }

            // Update lock screen position every 1 second
            if (now - lastLockScreenUpdate >= 1000) {
              lastLockScreenUpdate = now;
              updateMediaPlaybackState('playing', status.positionMillis);
            }
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
    const { sound, playbackPosition } = get();
    if (sound) {
      await sound.pauseAsync();
      set({ isPlaying: false });
      // Update lock screen state
      await updateMediaPlaybackState('paused', playbackPosition);
      // Save state when paused (preserves position)
      get().savePlayerState();
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
      // Update lock screen state
      await updateMediaPlaybackState('stopped');
      // Save state when stopped
      get().savePlayerState();
    }
  },

  cycleRepeatMode: () => {
    set((state) => ({ repeatMode: ((state.repeatMode + 1) % 3) as 0 | 1 | 2 }));
    // Save state after repeat mode change
    get().savePlayerState();
  },

  cyclePlaybackSpeed: async () => {
    const { sound, playbackSpeed } = get();
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];

    set({ playbackSpeed: nextSpeed });

    // Apply to currently playing sound if exists
    if (sound) {
      await sound.setRateAsync(nextSpeed, true);
    }

    // Save state after speed change
    get().savePlayerState();
  },

  setCurrentRootsList: (roots: string[]) => {
    set({ currentRootsList: roots });
  },

  setCurrentSortAndFilter: (sortBy, filter) => {
    set({ currentSortBy: sortBy, currentFilter: filter });
    // Save state after sort/filter change
    get().savePlayerState();
  },

  playNext: async () => {
    const { currentWord, currentRootsList, isPlaying, downloadedFiles, sound } = get();

    if (!currentWord) return;

    const currentIndex = currentRootsList.indexOf(currentWord);
    if (currentIndex === -1) return;

    // Find next downloaded item (playable)
    let nextIndex = currentIndex + 1;
    while (nextIndex < currentRootsList.length) {
      const nextWord = currentRootsList[nextIndex];
      if (downloadedFiles[nextWord]) {
        // Stop current sound without clearing currentWord
        if (sound) {
          try {
            await sound.stopAsync();
            await sound.unloadAsync();
          } catch (error) {
            console.error('Error stopping current sound:', error);
          }
          set({ sound: null, isPlaying: false });
        }
        // Play the next word
        await get().playAudio(nextWord);
        return;
      }
      nextIndex++;
    }
    // No more downloaded items found - stop playback
    if (sound) {
      await get().stopAudio();
    }
  },

  playPrevious: async () => {
    const { currentWord, currentRootsList, downloadedFiles, sound } = get();

    if (!currentWord) return;

    const currentIndex = currentRootsList.indexOf(currentWord);
    if (currentIndex === -1) return;

    // Find previous downloaded item (playable)
    let prevIndex = currentIndex - 1;
    while (prevIndex >= 0) {
      const prevWord = currentRootsList[prevIndex];
      if (downloadedFiles[prevWord]) {
        // Stop current sound without clearing currentWord
        if (sound) {
          try {
            await sound.stopAsync();
            await sound.unloadAsync();
          } catch (error) {
            console.error('Error stopping current sound:', error);
          }
          set({ sound: null, isPlaying: false });
        }
        // Play the previous word
        await get().playAudio(prevWord);
        return;
      }
      prevIndex--;
    }
    // No more downloaded items found - stop playback
    if (sound) {
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

  setAvailableRoots: (roots: string[]) => {
    set({ availableRoots: roots, currentRootsList: roots });
  },

  hasAudioFile: (word: string) => {
    return !!get().audioMap[word];
  },
}));
