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
import { ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useTheme, useTranslation } from '@hooks';
import { GatewayAuthService } from '@services/auth/GatewayAuthService';

// Required for web browser to close properly after auth
WebBrowser.maybeCompleteAuthSession();

// Google OAuth Client IDs for different platforms
const GOOGLE_WEB_CLIENT_ID = '66379576970-7m435a4bq1qjhqissoq0nojjapta9jvt.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '865313393887-8d4jvuj4i85p53g5149ln400adfupe21.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = ''; // TODO: Create Android OAuth client with package name com.jalalirs.maajm

// Use iOS client ID which supports custom URL schemes
const GOOGLE_CLIENT_ID = GOOGLE_IOS_CLIENT_ID;

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

  // Use reversed client ID as redirect URI (iOS OAuth standard)
  const redirectUri = 'com.googleusercontent.apps.865313393887-8d4jvuj4i85p53g5149ln400adfupe21:/';

  console.log('=== GOOGLE OAUTH DEBUG ===');
  console.log('Client ID:', GOOGLE_CLIENT_ID);
  console.log('Redirect URI:', redirectUri);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      // Use authorization code flow - we'll exchange the code for tokens
    },
    discovery
  );

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { params } = response;
      console.log('OAuth Success! Params:', JSON.stringify(params, null, 2));

      // Exchange authorization code for tokens
      if (params.code) {
        console.log('Got authorization code, exchanging for tokens...');
        exchangeCodeForTokens(params.code);
      } else {
        console.error('No authorization code in response');
        Alert.alert(t('common.error'), 'No authorization code received from Google');
      }
    } else if (response?.type === 'error') {
      console.error('OAuth Error:', response.error);
      console.error('OAuth Error Params:', response.params);
      Alert.alert(
        t('common.error'),
        `OAuth Error: ${response.error?.code || 'Unknown'}\n${response.error?.description || ''}`
      );
    } else if (response?.type === 'cancel') {
      console.log('User canceled OAuth flow');
    } else if (response?.type === 'dismiss') {
      console.log('OAuth browser was dismissed');
    }
  }, [response]);

  const exchangeCodeForTokens = async (code: string) => {
    try {
      setIsLoading(true);
      console.log('Exchanging code for tokens...');

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: GOOGLE_CLIENT_ID,
          code,
          redirectUri,
          extraParams: {
            code_verifier: request?.codeVerifier || '',
          },
        },
        discovery
      );

      console.log('Token exchange successful!');
      console.log('ID Token:', tokenResponse.idToken?.substring(0, 20) + '...');

      if (tokenResponse.idToken) {
        handleGoogleSignIn(tokenResponse.idToken);
      } else {
        Alert.alert(t('common.error'), 'Failed to get ID token from token exchange');
      }
    } catch (error) {
      console.error('Token exchange error:', error);
      Alert.alert(
        t('common.error'),
        `Failed to exchange code for tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async (idToken: string | undefined) => {
    if (!idToken) {
      Alert.alert(t('common.error'), 'Failed to get ID token from Google');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Sending ID token to backend...');
      const response = await GatewayAuthService.authenticateWithGoogle(idToken);
      console.log('Backend authentication successful!', response);

      Alert.alert(
        t('smart.auth.success'),
        t('smart.auth.signedInSuccessfully'),
        [{ text: t('common.ok'), onPress: onSuccess }]
      );
    } catch (error) {
      console.error('Google sign-in error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      let errorMessage = t('smart.auth.signInFailed');
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert(t('common.error'), errorMessage);
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
