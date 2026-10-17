import Constants from 'expo-constants';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, ThemedText } from '@/components/ui';
import { APP_NAME, APP_TAGLINE, API_URL } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

export default function AboutScreen() {
  const theme = useTheme();
  const identity = useAuthStore((s) => s.identity);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: theme.primary }]}>
            <ThemedText variant="title" color={theme.primaryForeground}>
              A
            </ThemedText>
          </View>
          <ThemedText variant="subtitle">{APP_NAME}</ThemedText>
          <ThemedText variant="muted" style={{ textAlign: 'center' }}>
            {APP_TAGLINE}
          </ThemedText>
          <ThemedText variant="caption">Version {version}</ThemedText>
        </View>

        <Card style={styles.card}>
          <Row label="Account" value={identity?.username || 'Guest'} />
          <Row label="Type" value={identity?.authType || 'guest'} />
          <Row label="Credits" value={String(identity?.creditsRemaining ?? 0)} />
          <Row label="Backend" value={API_URL.replace(/^https?:\/\//, '')} />
        </Card>

        <Card style={styles.card}>
          <ThemedText variant="muted">
            ARC-AI is an autonomous real-time conversational agent. On mobile you can
            chat with streaming responses, talk with voice mode, capture images,
            run tools, and manage memory — all against the same backend as the web app.
          </ThemedText>
        </Card>

        <Button
          label="Open web app"
          variant="outline"
          icon="globe-outline"
          onPress={() => void Linking.openURL(API_URL).catch(() => {})}
        />
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <ThemedText variant="muted" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      <ThemedText variant="muted" color={theme.foreground} numberOfLines={1} style={{ maxWidth: '60%' }}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  brand: { alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.xl },
  logo: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  card: { padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
