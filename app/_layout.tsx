import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import { useEffect, useState } from 'react';

export default function RootLayout() {
  const theme = useTheme();
  const { initializeDatabase, isInitialized } = useDictionaryStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Initialize SQLite database
    const initializeApp = async () => {
      try {
        await initializeDatabase();
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  // Show splash screen while initializing
  if (isInitializing || !isInitialized) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <Text style={[styles.splashTitle, { color: theme.colors.primary }]}>المعجم</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        <Text style={[styles.splashText, { color: theme.colors.textSecondary }]}>جار تحميل قاعدة البيانات...</Text>
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
