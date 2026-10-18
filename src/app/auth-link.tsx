import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spinner, ThemedText } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

/**
 * Redirect target for `arcaimobile://auth-link?linked=true`.
 *
 * Account-linking finishes while already signed in, so this route just
 * refreshes the identity (to pick up the newly linked Google account) and
 * returns to Settings. Mirrors the `/auth` route so the deep link never lands
 * on "Unmatched Route".
 */
export default function AuthLinkRedirectScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ linked?: string; success?: string }>();
  const status = useAuthStore((s) => s.status);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (params.linked === 'true' || params.success === 'true') void refreshMe();
  }, [params.linked, params.success, refreshMe]);

  if (status === 'authenticated' || status === 'guest') {
    return <Redirect href="/(app)/settings" />;
  }

  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Spinner label="Finishing…" />
      <ThemedText variant="muted" style={styles.message}>
        Returning to Settings…
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  message: { textAlign: 'center' },
});
