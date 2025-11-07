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
    // Enable RTL layout for Arabic
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);

    // Check if extraction is needed
    checkExtractionNeeded();
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
