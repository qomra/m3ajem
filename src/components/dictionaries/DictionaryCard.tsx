import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { Ionicons } from '@expo/vector-icons';

interface DictionaryCardProps {
  name: string;
  rootsCount: number;
  onPress: () => void;
  onInfoPress: () => void;
}

export function DictionaryCard({ name, rootsCount, onPress, onInfoPress }: DictionaryCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={onPress}
    >
      <View style={[styles.content, { flexDirection: 'row' }]}>
        <Pressable
          style={({ pressed }) => [
            styles.infoButton,
            {
              backgroundColor: pressed ? theme.colors.primary + '20' : theme.colors.card,
              borderColor: theme.colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={e => {
            e.stopPropagation();
            onInfoPress();
          }}
        >
          <Ionicons name="information-circle-outline" size={24} color={theme.colors.primary} />
        </Pressable>
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.colors.text, textAlign: 'right' }]}>{name}</Text>
          <Text style={[styles.count, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
            {t('dictionaries.rootsCount')}: {rootsCount.toLocaleString('ar-SA')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  content: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  count: {
    fontSize: 14,
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
  },
});
