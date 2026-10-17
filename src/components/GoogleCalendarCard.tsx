import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { Button, Card, ThemedText } from '@/components/ui';
import { googleApi } from '@/api/integrations';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

/** Google Calendar connect/status card, mirroring the web integrations panel. */
export function GoogleCalendarCard() {
  const theme = useTheme();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const status = await googleApi.status();
      setConnected(status.connected);
    } catch {
      setConnected(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, []);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await googleApi.calendarAuthUrl();
      await WebBrowser.openBrowserAsync(url);
      await refresh();
    } catch {
      setError('Could not open the Google authorization page.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <ThemedText variant="body" style={{ fontWeight: '600' }}>
            Google Calendar
          </ThemedText>
          <ThemedText variant="caption">
            {connected === null
              ? 'Checking connection…'
              : connected
                ? 'Connected'
                : 'Not connected'}
          </ThemedText>
        </View>
        <Button
          label={connected ? 'Reconnect' : 'Connect'}
          variant={connected ? 'outline' : 'primary'}
          loading={busy}
          onPress={() => void connect()}
          style={{ minWidth: 120 }}
        />
      </View>
      {error ? (
        <ThemedText variant="caption" color={theme.destructive}>
          {error}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
