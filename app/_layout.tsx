import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BackHandler } from 'react-native';
import { useTheme } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStore';
import { DataExtractionModal } from '@components/modals/DataExtractionModal';
import { I18nManager } from 'react-native';
import { useEffect } from 'react';

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

  useEffect(() => {
    // Check current RTL state
    console.log('RTL Status:', {
      isRTL: I18nManager.isRTL,
      doLeftAndRightSwapInRTL: I18nManager.doLeftAndRightSwapInRTL,
    });

    // Enable RTL layout for Arabic
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
      console.log('RTL enabled - App needs restart');
    }

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
          // Don't load index here - let indexed tab load it when needed
        ]);
        console.log('Cached data loaded successfully');
      }
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
