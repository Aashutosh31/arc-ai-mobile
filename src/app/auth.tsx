import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { exchangeGoogleTicket, parseTicketFromUrl } from '@/auth/google';
import { Spinner, ThemedText } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

/**
 * OAuth redirect target for `arcaimobile://auth?ticket=...`.
 *
 * On several Android configurations the in-app browser session does not capture
 * the custom-scheme redirect; the OS opens the app via deep link instead. Expo
 * Router normalizes `arcaimobile://auth` to the `/auth` path, so without this
 * route the redirect landed on the "Unmatched Route" screen. The one-time
 * ticket is exchanged here (idempotently) and the app then continues into the
 * authenticated area.
 */
export default function AuthRedirectScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ ticket?: string }>();
  const url = Linking.useURL();
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ticket = typeof params.ticket === 'string' ? params.ticket : parseTicketFromUrl(url);
    void exchangeGoogleTicket(ticket);
  }, [params.ticket, url]);

  if (status === 'authenticated' || status === 'guest') {
    return <Redirect href="/(app)" />;
  }

  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      {error ? (
        <>
          <ThemedText variant="body" color={theme.destructive} style={styles.message}>
            {error}
          </ThemedText>
          <Link href="/(auth)/sign-in" style={{ color: theme.primary, fontWeight: '700' }}>
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <Spinner label="Signing you in…" />
          <ThemedText variant="muted" style={styles.message}>
            Completing Google sign-in…
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  message: { textAlign: 'center' },
});
