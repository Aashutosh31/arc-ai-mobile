import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

export default function AuthLayout() {
  const theme = useTheme();
  const status = useAuthStore((s) => s.status);

  if (status === 'authenticated' || status === 'guest') {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    />
  );
}
