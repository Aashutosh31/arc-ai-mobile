import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, TextField, ThemedText } from '@/components/ui';
import { APP_NAME, APP_TAGLINE } from '@/constants/config';
import { signInWithGoogle } from '@/auth/google';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing } from '@/theme/layout';

export default function SignInScreen() {
  const theme = useTheme();
  const login = useAuthStore((s) => s.login);
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);

  const submit = () => {
    if (!email.trim() || !password) return;
    void login(email.trim(), password).catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: theme.primary }]}>
            <ThemedText variant="subtitle" color={theme.primaryForeground}>
              A
            </ThemedText>
          </View>
          <ThemedText variant="title">{APP_NAME}</ThemedText>
          <ThemedText variant="muted" style={{ textAlign: 'center' }}>
            {APP_TAGLINE}
          </ThemedText>
        </View>

        {error ? (
          <View style={[styles.errorBox, { borderColor: theme.destructive, backgroundColor: theme.destructive + '14' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.destructive} />
            <ThemedText variant="caption" color={theme.destructive} style={{ flex: 1 }}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <View style={{ gap: Spacing.md }}>
          <TextField
            labelText="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
            returnKeyType="next"
          />
          <View>
            <TextField
              labelText="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secure}
              autoCapitalize="none"
              placeholder="••••••••"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <View style={styles.eye}>
              <Ionicons
                name={secure ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={theme.foregroundMuted}
                onPress={() => setSecure((v) => !v)}
              />
            </View>
          </View>
        </View>

        <Button label="Sign in" onPress={submit} loading={busy} />

        <View style={styles.dividerRow}>
          <View style={[styles.line, { backgroundColor: theme.border }]} />
          <ThemedText variant="caption">or</ThemedText>
          <View style={[styles.line, { backgroundColor: theme.border }]} />
        </View>

        <Button
          label="Continue with Google"
          variant="outline"
          icon="logo-google"
          onPress={() => void signInWithGoogle().catch(() => {})}
        />
        <Button
          label="Continue as guest"
          variant="ghost"
          icon="person-outline"
          onPress={() => void continueAsGuest().catch(() => {})}
        />

        <View style={styles.footer}>
          <ThemedText variant="muted">New here? </ThemedText>
          <Link href="/(auth)/register" style={{ color: theme.primary, fontWeight: '700', fontSize: FontSize.md }}>
            Create an account
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, gap: Spacing.lg, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
  },
  eye: { position: 'absolute', right: Spacing.md, bottom: Spacing.md - 2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm },
});
