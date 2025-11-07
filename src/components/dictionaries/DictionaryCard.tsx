import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, useTranslation } from '@hooks';
import { getFlexDirection } from '@/utils/rtl';

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
      <View style={[styles.content, { flexDirection: getFlexDirection() }]}>
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.colors.text, textAlign: 'right' }]}>{name}</Text>
          <Text style={[styles.count, { color: theme.colors.textSecondary, textAlign: 'right' }]}>
            {rootsCount.toLocaleString('ar-SA')} {t('dictionaries.rootsCount')}
          </Text>
        </View>
        <Pressable
          style={[styles.infoButton, { backgroundColor: theme.colors.primary }]}
          onPress={e => {
            e.stopPropagation();
            onInfoPress();
          }}
        >
          <Text style={[styles.infoButtonText, { color: theme.colors.background }]}>ℹ</Text>
        </Pressable>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  infoButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
