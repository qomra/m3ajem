import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { useTheme } from '@hooks';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onClear?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChangeText, placeholder, onClear, autoFocus = false }: SearchBarProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <TextInput
        style={[styles.input, { color: theme.colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        autoFocus={autoFocus}
        textAlign="right"
      />
      {value.length > 0 && onClear && (
        <Pressable style={[styles.clearButton, { backgroundColor: theme.colors.textSecondary }]} onPress={onClear}>
          <Text style={[styles.clearButtonText, { color: theme.colors.background }]}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 16,
    writingDirection: 'rtl',
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
