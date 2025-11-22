import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useTranslation } from '@hooks';
import type { APIProvider } from '@services/storage/apiKeyStorage';

const PROVIDERS = [
  {
    id: 'gateway' as APIProvider,
    name: 'معاجم',
    icon: 'cloud-outline' as keyof typeof Ionicons.glyphMap,
    color: '#8B5CF6',
  },
  {
    id: 'groq' as APIProvider,
    name: 'Groq',
    logo: require('../../../assets/images/groq.png'),
    color: '#F55036',
  },
  {
    id: 'openai' as APIProvider,
    name: 'OpenAI',
    logo: require('../../../assets/images/openai.png'),
    color: '#10A37F',
  },
  {
    id: 'anthropic' as APIProvider,
    name: 'Anthropic',
    logo: require('../../../assets/images/anthropic.png'),
    color: '#D97356',
  },
  {
    id: 'google' as APIProvider,
    name: 'Google',
    logo: require('../../../assets/images/google.png'),
    color: '#4285F4',
  },
];

interface ProviderSelectorProps {
  selectedProvider: APIProvider;
  onSelect: (provider: APIProvider) => void;
  availableProviders?: APIProvider[];
}

export function ProviderSelector({
  selectedProvider,
  onSelect,
  availableProviders,
}: ProviderSelectorProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const providers = availableProviders
    ? PROVIDERS.filter((p) => availableProviders.includes(p.id))
    : PROVIDERS;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {t('smart.selectProvider')}
      </Text>

      <View style={styles.providersGrid}>
        {providers.map((provider) => (
          <Pressable
            key={provider.id}
            style={({ pressed }) => [
              styles.providerCard,
              {
                backgroundColor:
                  selectedProvider === provider.id
                    ? theme.colors.primary + '20'
                    : pressed
                    ? theme.colors.background
                    : theme.colors.card,
                borderColor:
                  selectedProvider === provider.id ? theme.colors.primary : theme.colors.border,
                borderWidth: selectedProvider === provider.id ? 2 : 1,
              },
            ]}
            onPress={() => onSelect(provider.id)}
          >
            <View
              style={[
                styles.logoContainer,
                { backgroundColor: provider.color + '20' },
              ]}
            >
              {'icon' in provider ? (
                <Ionicons name={provider.icon} size={24} color={provider.color} />
              ) : (
                <Image source={provider.logo} style={styles.logo} resizeMode="contain" />
              )}
            </View>

            <Text style={[styles.providerName, { color: theme.colors.text }]}>
              {provider.name}
            </Text>

            <Text style={[styles.providerModel, { color: theme.colors.textSecondary }]}>
              {t(`settings.apiConfig.model.${provider.id}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  providersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  providerCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 24,
    height: 24,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  providerModel: {
    fontSize: 11,
    textAlign: 'center',
  },
});
