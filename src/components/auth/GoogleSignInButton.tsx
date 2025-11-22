import React, { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useTheme, useTranslation } from '@hooks';
import { GatewayAuthService } from '@services/auth/GatewayAuthService';

// Required for web browser to close properly after auth
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = ''; // TODO: Add your Google OAuth client ID here

interface GoogleSignInButtonProps {
  onSuccess: () => void;
}

export function GoogleSignInButton({ onSuccess }: GoogleSignInButtonProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'm3ajem',
        path: 'auth/google',
      }),
    },
    discovery
  );

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleSignIn(authentication?.idToken);
    }
  }, [response]);

  const handleGoogleSignIn = async (idToken: string | undefined) => {
    if (!idToken) {
      Alert.alert(t('common.error'), 'Failed to get ID token from Google');
      return;
    }

    setIsLoading(true);
    try {
      await GatewayAuthService.authenticateWithGoogle(idToken);
      Alert.alert(
        t('smart.auth.success'),
        t('smart.auth.signedInSuccessfully'),
        [{ text: t('common.ok'), onPress: onSuccess }]
      );
    } catch (error) {
      console.error('Google sign-in error:', error);
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('smart.auth.signInFailed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      style={[
        styles.button,
        {
          backgroundColor: '#FFFFFF',
          borderColor: theme.colors.border,
        },
      ]}
      onPress={() => promptAsync()}
      disabled={isLoading || !request}
    >
      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <>
          <Image
            source={require('../../../assets/images/google.png')}
            style={styles.icon}
          />
          <Text style={[styles.buttonText, { color: '#000000' }]}>
            {t('smart.auth.signInWithGoogle')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  icon: {
    width: 24,
    height: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
