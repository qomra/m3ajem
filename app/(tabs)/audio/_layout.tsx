import { Stack } from 'expo-router';
import { useTheme } from '@hooks';

export default function AudioLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_left',
        gestureEnabled: true,
        fullScreenGestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="root"
        options={{
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
