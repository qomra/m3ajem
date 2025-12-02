import React, { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import { GatewayAuthService } from '@services/auth/GatewayAuthService';

interface AppleSignInButtonProps {
  onSuccess: () => void;
}

export function AppleSignInButton({ onSuccess }: AppleSignInButtonProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(t('common.error'), 'Apple Sign In is only available on iOS');
      return;
    }

    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Send to backend
      await GatewayAuthService.authenticateWithApple(
        credential.identityToken!,
        credential.user,
        credential.email || undefined
      );

      Alert.alert(
        t('smart.auth.success'),
        t('smart.auth.signedInSuccessfully'),
        [{ text: t('common.ok'), onPress: onSuccess }]
      );
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        // User canceled, don't show error
        return;
      }
      console.error('Apple sign-in error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      let errorMessage = t('smart.auth.signInFailed');
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error.code) {
        errorMessage = `Error code: ${error.code}`;
      } else if (error.detail && typeof error.detail === 'string') {
        errorMessage = error.detail;
      } else {
        // Last resort - stringify the error
        try {
          const stringified = JSON.stringify(error);
          if (stringified !== '{}') {
            errorMessage = stringified;
          }
        } catch {
          // Keep default error message
        }
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
          backgroundColor: '#000000',
        },
      ]}
      onPress={handleAppleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
            {t('smart.auth.signInWithApple')}
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
    marginBottom: 12,
    gap: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
