import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackHandler, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStore';
import { DataExtractionModal } from '@components/modals/DataExtractionModal';
import { I18nManager } from 'react-native';
import { useEffect, useState } from 'react';

export default function RootLayout() {
  const theme = useTheme();
  const {
    needsExtraction,
    isExtracting,
    extractionProgress,
    extractionStep,
    checkExtractionNeeded,
    startExtraction,
  } = useDictionaryStore();

  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Always force RTL on every app start to ensure persistence
    // This must be called unconditionally, not just when !isRTL
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);

    console.log('RTL Status:', {
      isRTL: I18nManager.isRTL,
      doLeftAndRightSwapInRTL: I18nManager.doLeftAndRightSwapInRTL,
    });

    // Check if extraction is needed and load data if available
    const initializeApp = async () => {
      await checkExtractionNeeded();

      // If extraction is not needed, load the cached data
      const { needsExtraction: stillNeedsExtraction } = useDictionaryStore.getState();
      if (!stillNeedsExtraction) {
        console.log('Loading cached data...');
        const store = useDictionaryStore.getState();
        await Promise.all([
          store.loadMetadata(),
          store.loadSearchIndex(),
          store.loadDictionaries(),
          store.loadIndex(),
        ]);
        console.log('Cached data loaded successfully');
      }

      setIsInitializing(false);
    };

    initializeApp();
  }, []);

  const handleAgreeExtraction = async () => {
    try {
      await startExtraction();
    } catch (error) {
      console.error('Extraction failed:', error);
    }
  };

  const handleCancelExtraction = () => {
    // Exit the app if user cancels extraction
    BackHandler.exitApp();
  };

  // Show splash screen while initializing
  if (isInitializing && !needsExtraction) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <Text style={[styles.splashTitle, { color: theme.colors.primary }]}>المعجم</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        <Text style={[styles.splashText, { color: theme.colors.textSecondary }]}>جار تجهيز البيانات لتجربة انسيابية</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />

      {/* Data Extraction Modal */}
      <DataExtractionModal
        visible={needsExtraction}
        isExtracting={isExtracting}
        progress={extractionProgress}
        currentStep={extractionStep}
        onAgree={handleAgreeExtraction}
        onCancel={handleCancelExtraction}
      />
    </>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  splashTitle: {
    fontSize: 64,
    fontWeight: '700',
    marginBottom: 40,
    fontFamily: 'GeezaPro-Bold',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  loader: {
    marginBottom: 20,
  },
  splashText: {
    fontSize: 18,
    textAlign: 'center',
  },
});
