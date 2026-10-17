import { Drawer } from 'expo-router/drawer';
import { Redirect } from 'expo-router';

import { ConversationDrawer } from '@/components/ConversationDrawer';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

export default function AppLayout() {
  const theme = useTheme();
  const status = useAuthStore((s) => s.status);

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Drawer
      drawerContent={(props) => <ConversationDrawer {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.foreground,
        headerTitleStyle: { color: theme.foreground, fontWeight: '700' },
        headerShadowVisible: false,
        drawerType: 'front',
        drawerStyle: { backgroundColor: theme.surface, width: 300 },
        overlayColor: 'rgba(0,0,0,0.5)',
        swipeEdgeWidth: 60,
      }}>
      <Drawer.Screen name="index" options={{ title: 'ARC-AI' }} />
      <Drawer.Screen name="memory" options={{ title: 'Memory' }} />
      <Drawer.Screen name="tools" options={{ title: 'Tools' }} />
      <Drawer.Screen name="automation" options={{ title: 'Automation' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
      <Drawer.Screen name="about" options={{ title: 'About' }} />
    </Drawer>
  );
}
