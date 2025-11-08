import { Stack } from 'expo-router';
import { useTheme } from '@hooks';

export default function IndexedLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_left',
      }}
    />
  );
}
