import { View, Text, StyleSheet, Pressable, FlatList, StatusBar, Animated } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStore';
import { DictionaryCard } from '@components/dictionaries/DictionaryCard';
import { InfoModal } from '@components/modals/InfoModal';
import { GlobalSearch } from '@components/dictionaries/GlobalSearch';

export default function DictionariesList() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { dictionaries, metadata, isLoadingDictionaries, isLoadingMetadata } = useDictionaryStore();

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
      pathname: '/(tabs)/dictionaries/[dictionaryName]',
      params: { dictionaryName },
    });
  };

  const handleInfoPress = (dictionaryName: string) => {
    setSelectedDictionary(dictionaryName);
  };

  const handleCloseInfo = () => {
    setSelectedDictionary(null);
  };

  const isLoading = isLoadingDictionaries || isLoadingMetadata;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <Pressable
          style={[styles.searchButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleShowSearch}
        >
          <Text style={[styles.searchButtonText, { color: theme.colors.background }]}>
            {t('dictionaries.searchButton')}
          </Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('dictionaries.title')}</Text>
      </View>

      {/* Dictionaries List */}
      <Animated.View style={[styles.listContainer, { transform: [{ scale: listScale }] }]}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>{t('common.loading')}</Text>
          </View>
        ) : dictionaries.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {t('dictionaries.noDictionaries')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={dictionaries}
            keyExtractor={item => item.name}
            renderItem={({ item }) => (
              <DictionaryCard
                name={item.name}
                rootsCount={metadata?.[item.name]?.num_roots || 0}
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
        rootsCount={selectedDictionary ? metadata?.[selectedDictionary]?.num_roots || 0 : 0}
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
    flexDirection: 'row',
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
