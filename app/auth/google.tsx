import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

// This route handles the OAuth redirect from Expo's auth proxy
export default function GoogleAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // The OAuth flow is handled by expo-auth-session automatically
    // This page just needs to exist for the route to be valid
    // Redirect back to the app after a short delay
    const timeout = setTimeout(() => {
      router.replace('/(tabs)/smart');
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
