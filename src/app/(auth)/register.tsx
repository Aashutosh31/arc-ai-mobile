import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, TextField, ThemedText } from '@/components/ui';
import { APP_NAME } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { FontSize, Spacing } from '@/theme/layout';

export default function RegisterScreen() {
  const theme = useTheme();
  const register = useAuthStore((s) => s.register);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    if (!username.trim() || !email.trim() || !password) return;
    if (password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    setLocalError(null);
    void register(username.trim(), email.trim(), password).catch(() => {});
  };

  const shownError = localError || error;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <ThemedText variant="title">Create your account</ThemedText>
          <ThemedText variant="muted">Join {APP_NAME} and start building with ARC.</ThemedText>
        </View>

        {shownError ? (
          <View style={[styles.errorBox, { borderColor: theme.destructive, backgroundColor: theme.destructive + '14' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.destructive} />
            <ThemedText variant="caption" color={theme.destructive} style={{ flex: 1 }}>
              {shownError}
            </ThemedText>
          </View>
        ) : null}

        <View style={{ gap: Spacing.md }}>
          <TextField
            labelText="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="arcuser"
          />
          <TextField
            labelText="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <TextField
            labelText="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="At least 8 characters"
          />
          <TextField
            labelText="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Repeat password"
            onSubmitEditing={submit}
          />
        </View>

        <Button label="Create account" onPress={submit} loading={busy} />

        <View style={styles.footer}>
          <ThemedText variant="muted">Already have an account? </ThemedText>
          <Link href="/(auth)/sign-in" style={{ color: theme.primary, fontWeight: '700', fontSize: FontSize.md }}>
            Sign in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, gap: Spacing.lg, flexGrow: 1, justifyContent: 'center' },
  brand: { gap: Spacing.xs, marginBottom: Spacing.md },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
