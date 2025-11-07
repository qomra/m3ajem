import { Tabs } from 'expo-router';
import { useTranslation, useTheme } from '@hooks';
import { Platform } from 'react-native';

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
        }}
      />
      <Tabs.Screen
        name="smart"
        options={{
          title: t('tabs.smart'),
        }}
      />
      <Tabs.Screen
        name="audio"
        options={{
          title: t('tabs.audio'),
        }}
      />
      <Tabs.Screen
        name="indexed"
        options={{
          title: t('tabs.indexed'),
        }}
      />
      <Tabs.Screen
        name="dictionaries"
        options={{
          title: t('tabs.dictionaries'),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
