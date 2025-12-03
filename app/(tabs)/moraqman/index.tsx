import { View, Text, StyleSheet, Pressable, FlatList, StatusBar, Animated } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import { DictionaryCard } from '@components/dictionaries/DictionaryCard';
import { InfoModal } from '@components/modals/InfoModal';
import { GlobalSearch } from '@components/dictionaries/GlobalSearch';

export default function MoraqmanList() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { moraqmanDictionaries, moraqmanMetadata, isLoadingMoraqmanDictionaries, isLoadingMoraqmanMetadata, loadMoraqmanDictionaries, loadMoraqmanMetadata } = useDictionaryStore();

  // Load dictionaries and metadata on mount
  useEffect(() => {
    if (moraqmanDictionaries.length === 0) {
      loadMoraqmanDictionaries();
    }
    if (!moraqmanMetadata) {
      loadMoraqmanMetadata();
    }
  }, []);

  const [selectedDictionary, setSelectedDictionary] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Animation values
  const listScale = useRef(new Animated.Value(1)).current;
  const searchScale = useRef(new Animated.Value(0)).current;

  const handleShowSearch = () => {
    setShowSearch(true);
    Animated.parallel([
      Animated.timing(listScale, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(searchScale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCloseSearch = () => {
    Animated.parallel([
      Animated.timing(listScale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(searchScale, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSearch(false);
    });
  };

  const handleDictionaryPress = (dictionaryName: string) => {
    router.push({
      pathname: '/(tabs)/moraqman/[dictionaryName]',
      params: { dictionaryName },
    });
  };

  const handleInfoPress = (dictionaryName: string) => {
    setSelectedDictionary(dictionaryName);
  };

  const handleCloseInfo = () => {
    setSelectedDictionary(null);
  };

  const isLoading = isLoadingMoraqmanDictionaries || isLoadingMoraqmanMetadata;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border, flexDirection: 'row' }]}>
        <Pressable
          style={[styles.searchButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleShowSearch}
        >
          <Text style={[styles.searchButtonText, { color: theme.colors.background }]}>
            {t('moraqman.searchButton')}
          </Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('moraqman.title')}</Text>
      </View>

      {/* Info Note */}
      <View style={[styles.noteContainer, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}>
        <Text style={[styles.noteText, { color: theme.colors.text }]}>
          {t('moraqman.note')}
        </Text>
      </View>

      {/* Dictionaries List */}
      <Animated.View style={[styles.listContainer, { transform: [{ scale: listScale }] }]}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>{t('common.loading')}</Text>
          </View>
        ) : moraqmanDictionaries.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {t('moraqman.noDictionaries')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={moraqmanDictionaries}
            keyExtractor={item => item.name}
            keyboardShouldPersistTaps='handled'
            renderItem={({ item }) => (
              <DictionaryCard
                name={item.name}
                rootsCount={moraqmanMetadata?.[item.name]?.num_roots || 0}
                onPress={() => handleDictionaryPress(item.name)}
                onInfoPress={() => handleInfoPress(item.name)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>

      {/* Global Search Modal */}
      {showSearch && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.searchContainer,
            {
              transform: [{ scale: searchScale }],
              opacity: searchScale,
            },
          ]}
        >
          <GlobalSearch onClose={handleCloseSearch} />
        </Animated.View>
      )}

      {/* Info Modal */}
      <InfoModal
        visible={selectedDictionary !== null}
        dictionaryName={selectedDictionary || ''}
        rootsCount={selectedDictionary ? moraqmanMetadata?.[selectedDictionary]?.num_roots || 0 : 0}
        description={selectedDictionary ? moraqmanMetadata?.[selectedDictionary]?.description : undefined}
        onClose={handleCloseInfo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noteContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
  },
  searchContainer: {
    zIndex: 100,
  },
});
