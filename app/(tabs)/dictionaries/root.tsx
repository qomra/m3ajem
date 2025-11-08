import { View, Text, StyleSheet, Pressable, ScrollView, StatusBar, ActivityIndicator, InteractionManager } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStore';
import { getFlexDirection } from '@/utils/rtl';

export default function RootDetail() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { root, dictionaryName } = useLocalSearchParams<{ root: string; dictionaryName: string }>();

  const { searchRootInDictionary } = useDictionaryStore();

  const [definition, setDefinition] = useState<string>('');

  // Load definition ONLY after interactions complete (navigation animation done)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      const def = searchRootInDictionary(dictionaryName || '', root || '');
      setDefinition(def || '');
    });

    return () => task.cancel();
  }, [root, dictionaryName, searchRootInDictionary]);

  const handleBackPress = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <Pressable style={styles.backButton} onPress={handleBackPress}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>←</Text>
        </Pressable>
      </View>

      {/* Fixed Content */}
      <View style={styles.fixedContent}>
        {/* Root */}
        <View style={[styles.rootContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.rootLabel, { color: theme.colors.textSecondary }]}>
            {t('dictionaries.root')}
          </Text>
          <Text style={[styles.rootText, { color: theme.colors.primary }]}>{root}</Text>
        </View>

        {/* Dictionary Name */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
            {t('dictionaries.dictionaryName')}
          </Text>
          <Text style={[styles.infoText, { color: theme.colors.text, textAlign: 'right' }]}>{dictionaryName}</Text>
        </View>
      </View>

      {/* Scrollable Definition */}
      {!definition ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.definitionScrollView}
          contentContainerStyle={styles.definitionScrollContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          scrollEventThrottle={16}
        >
          <View style={[styles.definitionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.definitionLabel, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
              {t('dictionaries.definition')}
            </Text>
            <Text style={[styles.definitionText, { color: theme.colors.text, textAlign: 'right' }]}>{definition}</Text>
          </View>
        </ScrollView>
      )}
    </View>
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
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  fixedContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  definitionScrollView: {
    flex: 1,
  },
  definitionScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  rootContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  rootLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  rootText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
  },
  definitionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  definitionLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  definitionText: {
    fontSize: 18,
    lineHeight: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
});
