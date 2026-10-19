import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Divider, Screen, TextField, ThemedText } from '@/components/ui';
import { GoogleCalendarCard } from '@/components/GoogleCalendarCard';
import { linkGoogleAccount } from '@/auth/google';
import { listThemes } from '@/theme/themes';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme, useThemeStore } from '@/store/themeStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Spacing } from '@/theme/layout';

export default function SettingsScreen() {
  const theme = useTheme();
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const identity = useAuthStore((s) => s.identity);
  const credits = useAuthStore((s) => s.credits);

  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const active = useWorkspaceStore((s) => s.active);
  const switchTo = useWorkspaceStore((s) => s.switchTo);
  const createWorkspace = useWorkspaceStore((s) => s.create);
  const archiveWorkspace = useWorkspaceStore((s) => s.archive);
  const [workspaceName, setWorkspaceName] = useState('');

  const themes = listThemes();

  const onCreateWorkspace = async () => {
    const name = workspaceName.trim();
    if (!name) return;
    try {
      await createWorkspace({ name });
      setWorkspaceName('');
    } catch {
      Alert.alert('Could not create workspace');
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <ThemedText variant="subtitle" color={theme.primaryForeground}>
                {(identity?.username || 'G')[0].toUpperCase()}
              </ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" style={{ fontWeight: '700' }}>
                {identity?.username || 'Guest'}
              </ThemedText>
              <ThemedText variant="caption">{identity?.email || 'Guest session'}</ThemedText>
            </View>
            <ThemedText variant="body" color={theme.accent}>
              {credits} cr
            </ThemedText>
          </View>
          {identity?.authType !== 'guest' ? (
            <Button
              label={identity?.googleLinked ? 'Google linked' : 'Link Google account'}
              variant="outline"
              icon="logo-google"
              disabled={identity?.googleLinked}
              onPress={() => void linkGoogleAccount()}
            />
          ) : null}
        </Card>

        {identity?.authType !== 'guest' ? (
          <>
            <ThemedText variant="label">Integrations</ThemedText>
            <GoogleCalendarCard />
          </>
        ) : null}

        <ThemedText variant="label">Appearance</ThemedText>
        <View style={styles.themeGrid}>
          {themes.map((t) => {
            const selected = t.id === themeId;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTheme(t.id)}
                style={[
                  styles.themeSwatch,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: t.background,
                  },
                ]}>
                <View style={styles.swatchDots}>
                  {t.preview.map((c) => (
                    <View key={c} style={[styles.swatchDot, { backgroundColor: c }]} />
                  ))}
                </View>
                <ThemedText variant="caption" color={t.foreground} numberOfLines={1}>
                  {t.name}
                </ThemedText>
                {selected ? (
                  <View style={[styles.check, { backgroundColor: theme.primary }]}>
                    <Ionicons name="checkmark" size={12} color={theme.primaryForeground} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <ThemedText variant="label">Workspaces</ThemedText>
        <Card style={styles.card}>
          {workspaces.length ? (
            workspaces.map((w) => (
              <View key={w._id} style={styles.row}>
                <Ionicons
                  name={active?._id === w._id ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={active?._id === w._id ? theme.primary : theme.foregroundMuted}
                  onPress={() => switchTo(w._id)}
                />
                <ThemedText variant="muted" style={{ flex: 1 }} color={theme.foreground} numberOfLines={1}>
                  {w.name}
                </ThemedText>
                <Pressable onPress={() => void archiveWorkspace(w._id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={theme.destructive} />
                </Pressable>
              </View>
            ))
          ) : (
            <ThemedText variant="muted">No workspaces yet.</ThemedText>
          )}
          <Divider style={{ marginVertical: Spacing.sm }} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField placeholder="New workspace name" value={workspaceName} onChangeText={setWorkspaceName} />
            </View>
            <Button label="Add" variant="secondary" onPress={() => void onCreateWorkspace()} />
          </View>
        </Card>

        <ThemedText variant="label">Voice</ThemedText>
        <Card style={styles.card}>
          <ThemedText variant="muted" color={theme.foreground}>
            Voice input only. ARC no longer speaks replies aloud — it answers in text. You can
            still talk to ARC with the microphone or voice mode.
          </ThemedText>
        </Card>

        <ThemedText variant="label">Interaction</ThemedText>
        <Card style={styles.card}>
          <View style={styles.row}>
            <ThemedText variant="muted" style={{ flex: 1 }} color={theme.foreground}>
              Haptics
            </ThemedText>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ true: theme.primary, false: theme.borderStrong }}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  card: { padding: Spacing.md, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  themeSwatch: {
    width: 96,
    padding: Spacing.sm,
    borderRadius: Spacing.md,
    borderWidth: 2,
    gap: Spacing.xs,
    position: 'relative',
  },
  swatchDots: { flexDirection: 'row', gap: 4 },
  swatchDot: { width: 14, height: 14, borderRadius: 7 },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: Spacing.sm, overflow: 'hidden' },
  segmentItem: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: StyleSheet.hairlineWidth },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
