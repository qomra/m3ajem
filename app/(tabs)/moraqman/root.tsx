import { View, Text, StyleSheet, Pressable, ScrollView, StatusBar, ActivityIndicator, InteractionManager } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme, useTranslation } from '@hooks';
import { useDictionaryStore } from '@store/dictionaryStoreSQLite';
import { MathText } from '@components/common/MathText';

export default function RootDetail() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { root, dictionaryName } = useLocalSearchParams<{ root: string; dictionaryName: string }>();

  const { searchRootInDictionary } = useDictionaryStore();

  const [definition, setDefinition] = useState<string>('');

  // Load definition ONLY after interactions complete (navigation animation done)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(async () => {
      const def = await searchRootInDictionary(dictionaryName || '', root || '');
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
        {/* Root & Dictionary Info - Combined */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoValue, { color: theme.colors.primary, fontWeight: 'bold' }]}> {root}</Text>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              {t('dictionaries.root')}:
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}> {dictionaryName}</Text>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              {t('dictionaries.dictionaryName')}:
            </Text>
          </View>
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
            <MathText style={[styles.definitionText, { color: theme.colors.text, textAlign: 'right' }]}>
              {definition}
            </MathText>
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
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
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
