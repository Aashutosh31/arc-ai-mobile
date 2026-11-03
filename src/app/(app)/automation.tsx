import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, TextField, ThemedText } from '@/components/ui';
import { SOCKET_EVENTS } from '@/socket/events';
import { emitEvent, getSocket } from '@/socket/socketClient';
import { useChatStore } from '@/store/chatStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

type Any = Record<string, any>;

/** Human-readable names from a recipient resolution failure payload. */
const matchNames = (payload: Any): string =>
  Array.isArray(payload?.matches)
    ? payload.matches
        .map((m: Any) => m?.name || m?.phone)
        .filter(Boolean)
        .slice(0, 5)
        .join(', ')
    : '';

export default function AutomationScreen() {
  const theme = useTheme();
  // B-08: bind handlers reactively. `getSocket()` can be null on mount (the
  // connection is opened by SocketBridge) and `connectSocket` replaces the
  // instance on re-auth, so a one-shot mount binding left the screen inert.
  const connection = useChatStore((s) => s.connection);
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // B-09: pairing number and send recipient are independent fields.
  const [pairingPhone, setPairingPhone] = useState('');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const on = (event: string, fn: (...args: Any[]) => void) => socket.on(event, fn);
    const offs: (() => void)[] = [];
    const reg = (event: string, fn: (...args: Any[]) => void) => {
      on(event, fn);
      offs.push(() => socket.off(event, fn));
    };

    reg(SOCKET_EVENTS.whatsappState, (p: Any) => setStatus(String(p?.state ?? p?.status ?? 'unknown')));
    reg(SOCKET_EVENTS.whatsappReady, () => {
      setStatus('ready');
      setQr(null);
      setPairingCode(null);
      setError(null);
      setNotice('WhatsApp is ready.');
    });
    reg(SOCKET_EVENTS.whatsappAuthenticated, () => {
      setStatus('authenticated');
      setError(null);
    });
    reg(SOCKET_EVENTS.whatsappDisconnected, () => {
      setStatus('disconnected');
      setQr(null);
      setError(null);
      setNotice('WhatsApp disconnected.');
    });
    reg(SOCKET_EVENTS.whatsappAuthFailure, (p: Any) => {
      setStatus('disconnected');
      setNotice(null);
      setError(String(p?.message ?? 'Authentication failed'));
    });
    reg(SOCKET_EVENTS.whatsappQr, (p: Any) => {
      // Server sends both the raw string (`qr`) and a scannable data URL
      // (`qrcode`); prefer the image so the card renders it directly.
      setQr(String(p?.qrcode ?? p?.qr ?? p?.data ?? ''));
      setStatus('awaiting-scan');
      setError(null);
      setNotice(null);
    });
    reg(SOCKET_EVENTS.whatsappPairingCode, (p: Any) => {
      setPairingCode(String(p?.code ?? p?.pairingCode ?? ''));
      setError(null);
      setNotice('Pairing code ready — enter it in WhatsApp → Linked devices.');
    });
    reg(SOCKET_EVENTS.whatsappPairingCancelled, (p: Any) => {
      setPairingCode(null);
      if (p?.success === false) {
        setNotice(null);
        setError(String(p?.error ?? 'Could not cancel pairing'));
      } else {
        setError(null);
        setNotice('Pairing cancelled.');
      }
    });
    reg(SOCKET_EVENTS.whatsappPairingFailed, (p: Any) => {
      setNotice(null);
      setError(String(p?.error ?? p?.message ?? 'Pairing failed'));
    });
    reg(SOCKET_EVENTS.whatsappContactsSynced, (p: Any) => {
      setError(null);
      setNotice(`Contacts synced${p?.count ? ` (${p.count})` : ''}.`);
    });
    reg(SOCKET_EVENTS.whatsappContactsSyncFailed, (p: Any) => {
      setNotice(null);
      setError(String(p?.error ?? p?.message ?? 'Contact sync failed'));
    });
    reg(SOCKET_EVENTS.whatsappMessageSent, (p: Any) => {
      setError(null);
      const name = p?.contact?.name ? ` to ${p.contact.name}` : '';
      setNotice(`Message sent${name}.`);
    });
    reg(SOCKET_EVENTS.whatsappMessageFailed, (p: Any) => {
      setNotice(null);
      setError(String(p?.error ?? p?.message ?? 'Message failed'));
    });
    reg(SOCKET_EVENTS.whatsappRecipientAmbiguous, (p: Any) => {
      setNotice(null);
      const names = matchNames(p);
      setError(
        names
          ? `Multiple contacts match: ${names}. Try a more specific name.`
          : 'Multiple contacts match. Try a more specific name.',
      );
    });
    reg(SOCKET_EVENTS.whatsappRecipientNotFound, () => {
      setNotice(null);
      setError('No matching WhatsApp contact. Sync contacts or use a full phone number.');
    });
    reg(SOCKET_EVENTS.whatsappConnectAck, (p: Any) => {
      if (p?.success === false) {
        setNotice(null);
        setError(String(p?.error ?? 'Could not connect to WhatsApp'));
        return;
      }
      setError(null);
      if (!p?.restored) setNotice('Connecting…');
    });

    return () => offs.forEach((fn) => fn());
  }, [connection]);

  const isQrData = qr?.startsWith('data:image');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.statusCard}>
          <View style={styles.row}>
            <Ionicons name="logo-whatsapp" size={22} color={theme.success} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" style={{ fontWeight: '600' }}>
                WhatsApp
              </ThemedText>
              <ThemedText variant="caption">Status: {status}</ThemedText>
            </View>
            <View style={[styles.dot, { backgroundColor: status === 'ready' || status === 'authenticated' ? theme.success : theme.foregroundSubtle }]} />
          </View>
          <View style={styles.buttons}>
            <Button label="Connect" onPress={() => emitEvent(SOCKET_EVENTS.whatsappConnect)} style={{ flex: 1 }} />
            <Button
              label="Cancel pairing"
              variant="outline"
              onPress={() => emitEvent(SOCKET_EVENTS.whatsappCancelPairing)}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {notice ? (
          <ThemedText variant="caption" color={theme.success}>
            {notice}
          </ThemedText>
        ) : null}
        {error ? (
          <ThemedText variant="caption" color={theme.destructive}>
            {error}
          </ThemedText>
        ) : null}

        {qr ? (
          <Card style={styles.center}>
            <ThemedText variant="label">Scan to link</ThemedText>
            {isQrData ? (
              <Image source={{ uri: qr! }} style={styles.qr} resizeMode="contain" />
            ) : (
              <ThemedText variant="mono" style={{ textAlign: 'center' }}>
                {qr}
              </ThemedText>
            )}
            <ThemedText variant="caption" style={{ textAlign: 'center' }}>
              Open WhatsApp → Linked devices → Link a device
            </ThemedText>
          </Card>
        ) : null}

        {pairingCode ? (
          <Card style={styles.center}>
            <ThemedText variant="label">Pairing code</ThemedText>
            <ThemedText variant="title" color={theme.primary}>
              {pairingCode}
            </ThemedText>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <ThemedText variant="label">Pair with phone number</ThemedText>
          <TextField
            placeholder="+1 555 000 0000"
            value={pairingPhone}
            onChangeText={setPairingPhone}
            keyboardType="phone-pad"
          />
          <Button
            label="Request pairing code"
            variant="secondary"
            onPress={() =>
              emitEvent(SOCKET_EVENTS.whatsappPair, { phoneNumber: pairingPhone.replace(/\s+/g, '') })
            }
          />
        </Card>

        <Card style={styles.card}>
          <ThemedText variant="label">Send a message</ThemedText>
          <TextField placeholder="Recipient name or number" value={recipient} onChangeText={setRecipient} />
          <TextField placeholder="Message" value={message} onChangeText={setMessage} multiline />
          <View style={styles.buttons}>
            <Button
              label="Send"
              onPress={() =>
                emitEvent(SOCKET_EVENTS.whatsappSend, { recipientName: recipient, message })
              }
              style={{ flex: 1 }}
            />
            <Button
              label="Sync contacts"
              variant="outline"
              onPress={() => emitEvent(SOCKET_EVENTS.whatsappSyncContacts)}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  statusCard: { padding: Spacing.md, gap: Spacing.md },
  card: { padding: Spacing.md, gap: Spacing.md },
  center: { padding: Spacing.lg, alignItems: 'center', gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  buttons: { flexDirection: 'row', gap: Spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  qr: { width: 220, height: 220 },
});
