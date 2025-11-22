import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import { GoogleSignInButton } from './GoogleSignInButton';
import { AppleSignInButton } from './AppleSignInButton';
import { useRouter } from 'expo-router';

interface AuthModeSelectorProps {
  visible: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export function AuthModeSelector({ visible, onClose, onAuthSuccess }: AuthModeSelectorProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [showAuthOptions, setShowAuthOptions] = useState(false);

  const handleUseOwnKeys = () => {
    onClose();
    router.push('/settings');
  };

  const handleUseM3ajemService = () => {
    setShowAuthOptions(true);
  };

  const handleBackToOptions = () => {
    setShowAuthOptions(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
          {showAuthOptions && (
            <Pressable style={styles.backButton} onPress={handleBackToOptions}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </Pressable>
          )}
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {showAuthOptions ? t('smart.auth.signIn') : t('smart.auth.chooseMode')}
          </Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {!showAuthOptions ? (
            <>
              {/* Mode Selection */}
              <View style={styles.section}>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  {t('smart.auth.welcome')}
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                  {t('smart.auth.chooseHowToUse')}
                </Text>
              </View>

              {/* Option 1: Use Own API Keys */}
              <Pressable
                style={[styles.optionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={handleUseOwnKeys}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Ionicons name="key" size={32} color={theme.colors.primary} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                    {t('smart.auth.useOwnKeys')}
                  </Text>
                  <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                    {t('smart.auth.useOwnKeysDesc')}
                  </Text>
                  <View style={styles.benefitsContainer}>
                    <Text style={[styles.benefitItem, { color: theme.colors.accent }]}>
                      ✓ {t('smart.auth.unlimitedRequests')}
                    </Text>
                    <Text style={[styles.benefitItem, { color: theme.colors.accent }]}>
                      ✓ {t('smart.auth.privateConversations')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.colors.textTertiary} />
              </Pressable>

              {/* Option 2: Use M3ajem Service */}
              <Pressable
                style={[styles.optionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                onPress={handleUseM3ajemService}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.colors.accent + '20' }]}>
                  <Ionicons name="cloud" size={32} color={theme.colors.accent} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                    {t('smart.auth.useM3ajemService')}
                  </Text>
                  <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                    {t('smart.auth.useM3ajemServiceDesc')}
                  </Text>
                  <View style={styles.benefitsContainer}>
                    <Text style={[styles.benefitItem, { color: theme.colors.accent }]}>
                      ✓ {t('smart.auth.free30PerDay')}
                    </Text>
                    <Text style={[styles.benefitItem, { color: theme.colors.accent }]}>
                      ✓ {t('smart.auth.noAPIKeyNeeded')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color={theme.colors.textTertiary} />
              </Pressable>
            </>
          ) : (
            <>
              {/* Authentication Options */}
              <View style={styles.section}>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  {t('smart.auth.signInToM3ajem')}
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                  {t('smart.auth.chooseSignInMethod')}
                </Text>
              </View>

              {/* Disclosure */}
              <View style={[styles.disclosureCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Ionicons name="information-circle" size={24} color={theme.colors.accent} />
                <Text style={[styles.disclosureText, { color: theme.colors.textSecondary }]}>
                  {t('smart.auth.disclosure')}
                </Text>
              </View>

              {/* Google Sign In */}
              <GoogleSignInButton onSuccess={onAuthSuccess} />

              {/* Apple Sign In (iOS only) */}
              {Platform.OS === 'ios' && <AppleSignInButton onSuccess={onAuthSuccess} />}

              {/* Terms */}
              <Text style={[styles.terms, { color: theme.colors.textTertiary }]}>
                {t('smart.auth.termsText')}
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  optionCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  benefitsContainer: {
    gap: 4,
  },
  benefitItem: {
    fontSize: 13,
  },
  disclosureCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  disclosureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  terms: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
