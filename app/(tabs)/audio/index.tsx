import { View, Text, StyleSheet, FlatList, StatusBar, Pressable, Platform } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation, useTheme } from '@hooks';
import { useAudioStore, AUDIO_BOOKS } from '@store/audioStore';
import { AudioPlayer } from '@components/audio/AudioPlayer';

export default function AudioBookList() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const loadDownloadedFiles = useAudioStore(state => state.loadDownloadedFiles);
  const currentWord = useAudioStore(state => state.currentWord);

  useEffect(() => {
    loadDownloadedFiles();
  }, []);

  const handleBookPress = (dictionaryName: string) => {
    router.push({
      pathname: '/(tabs)/audio/[dictionaryName]',
      params: { dictionaryName },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('audio.title')}</Text>
      </View>

      <FlatList
        data={AUDIO_BOOKS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.bookCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => handleBookPress(item.dictionaryName)}
          >
            <Text style={[styles.bookName, { color: theme.colors.text }]}>{item.name}</Text>
            <Text style={[styles.bookEntryCount, { color: theme.colors.textSecondary }]}>
              {Object.keys(item.audioMap).length} {t('audio.audioEntries')}
            </Text>
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {currentWord && <AudioPlayer />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  bookCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  bookName: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 8,
  },
  bookEntryCount: {
    fontSize: 14,
    textAlign: 'right',
  },
});
