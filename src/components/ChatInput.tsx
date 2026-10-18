import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { type ComponentRef, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { submitTurn, stopGeneration } from '@/chat/chatController';
import { AttachMenu, type AttachMenuEntry } from '@/components/AttachMenu';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { useChatStore } from '@/store/chatStore';
import { useComposerStore } from '@/store/composerStore';
import { useTheme } from '@/store/themeStore';
import { useVoiceStore } from '@/store/voiceStore';
import { deactivateVoice, toggleVoice } from '@/voice/voiceSession';
import { bytesToBase64 } from '@/voice/pcm';
import { ThemedText } from '@/components/ui';
import { FontSize, Spacing } from '@/theme/layout';
import { useRouter } from 'expo-router';

async function readFileBase64(uri: string): Promise<string> {
  const file = new File(uri);
  const buffer = await file.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}

export function ChatInput() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const isProcessing = useChatStore((s) => s.isProcessing);
  const voiceActive = useVoiceStore((s) => s.active);
  const voiceMode = useVoiceStore((s) => s.mode);
  const voiceError = useVoiceStore((s) => s.error);
  const interim = useVoiceStore((s) => s.interim);
  const pendingImage = useComposerStore((s) => s.pendingImage);
  const pendingDocument = useComposerStore((s) => s.pendingDocument);
  const text = useComposerStore((s) => s.text);
  const setText = useComposerStore((s) => s.setText);
  const composer = useComposerStore();
  const plusRef = useRef<ComponentRef<typeof View>>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const canSend = Boolean(text.trim() || pendingImage || pendingDocument);

  const send = () => {
    if (!canSend) return;
    Haptics.selectionAsync().catch(() => {});
    submitTurn({ text, image: pendingImage, document: pendingDocument });
    setText('');
    composer.clear();
    if (voiceActive) deactivateVoice();
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo access is required to attach an image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });
    if (!res.canceled && res.assets?.[0]?.base64) {
      composer.setPendingImage(res.assets[0].base64);
    }
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    try {
      const base64 = await readFileBase64(asset.uri);
      composer.setPendingDocument({
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
        base64,
      });
    } catch {
      Alert.alert('Could not read file', 'That document could not be attached.');
    }
  };

  const closeMenu = () => setMenuVisible(false);

  const onMic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    void toggleVoice();
  };

  const openAttachMenu = () => {
    if (menuVisible) {
      closeMenu();
      return;
    }
    plusRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height });
      setMenuVisible(true);
    });
  };

  const attachEntries: AttachMenuEntry[] = [
    {
      type: 'item',
      key: 'image',
      icon: 'image-outline',
      label: 'Upload image',
      onPress: () => {
        closeMenu();
        void pickImage();
      },
    },
    {
      type: 'item',
      key: 'document',
      icon: 'document-text-outline',
      label: 'Upload document',
      onPress: () => {
        closeMenu();
        void pickDocument();
      },
    },
    { type: 'divider' },
    {
      type: 'item',
      key: 'camera',
      icon: 'camera-outline',
      label: 'Camera / Vision',
      hint: 'live',
      onPress: () => {
        closeMenu();
        router.push('/camera');
      },
    },
    {
      type: 'item',
      key: 'voice',
      icon: 'mic-outline',
      label: 'Voice mode',
      onPress: () => {
        closeMenu();
        onMic();
      },
    },
    {
      type: 'item',
      key: 'tools',
      icon: 'construct-outline',
      label: 'Browse tools',
      onPress: () => {
        closeMenu();
        router.navigate('/tools');
      },
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          // When the keyboard is up it covers the safe-area inset, so pad by
          // its height instead of double-counting the home indicator.
          paddingBottom:
            keyboardHeight > 0
              ? keyboardHeight + Spacing.xs
              : Math.max(insets.bottom, Spacing.sm) + Spacing.xs,
        },
      ]}>
      {pendingImage || pendingDocument ? (
        <View style={styles.attachmentRow}>
          {pendingImage ? (
            <View style={styles.thumbWrap}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${pendingImage}` }}
                style={[styles.thumb, { borderRadius: theme.radii.sm }]}
              />
              <Pressable style={styles.removeThumb} onPress={() => composer.setPendingImage(null)}>
                <Ionicons name="close-circle" size={20} color={theme.destructive} />
              </Pressable>
            </View>
          ) : null}
          {pendingDocument ? (
            <View style={[styles.docChip, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="document-text-outline" size={16} color={theme.foregroundMuted} />
              <ThemedText variant="caption" numberOfLines={1} style={{ maxWidth: 160 }}>
                {pendingDocument.name}
              </ThemedText>
              <Pressable onPress={() => composer.setPendingDocument(null)}>
                <Ionicons name="close" size={16} color={theme.foregroundMuted} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {voiceActive ? (
        <View style={[styles.voiceBar, { borderColor: theme.primary, backgroundColor: theme.primary + '18' }]}>
          <Ionicons name="mic" size={16} color={theme.primary} />
          <ThemedText variant="muted" numberOfLines={2} style={{ flex: 1 }}>
            {interim || (voiceMode === 'processing' ? 'Thinking…' : 'Listening…')}
          </ThemedText>
        </View>
      ) : null}

      {!voiceActive && voiceError ? (
        <View
          style={[
            styles.voiceBar,
            { borderColor: theme.destructive, backgroundColor: theme.destructive + '18' },
          ]}>
          <Ionicons name="alert-circle" size={16} color={theme.destructive} />
          <ThemedText variant="muted" numberOfLines={2} style={{ flex: 1 }}>
            {voiceError}
          </ThemedText>
          <Pressable hitSlop={8} onPress={() => useVoiceStore.getState().setError(null)}>
            <Ionicons name="close" size={16} color={theme.destructive} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <View ref={plusRef} collapsable={false}>
          <Pressable
            hitSlop={8}
            onPress={openAttachMenu}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="add" size={26} color={theme.foreground} />
          </Pressable>
        </View>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={voiceActive ? 'Speak or type…' : 'Message ARC-AI…'}
          placeholderTextColor={theme.foregroundSubtle}
          multiline
          style={[
            styles.input,
            {
              color: theme.foreground,
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        />

        <Pressable
          hitSlop={8}
          onPress={onMic}
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: voiceActive ? theme.primary : 'transparent',
              borderRadius: 24,
              opacity: pressed ? 0.6 : 1,
            },
          ]}>
          <Ionicons
            name={voiceActive ? 'mic' : 'mic-outline'}
            size={22}
            color={voiceActive ? theme.primaryForeground : theme.foreground}
          />
        </Pressable>

        {isProcessing && !text && !canSend ? (
          <Pressable
            hitSlop={8}
            onPress={stopGeneration}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: theme.destructive, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Ionicons name="stop" size={20} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            hitSlop={8}
            disabled={!canSend}
            onPress={send}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: canSend ? theme.primary : theme.surfaceElevated,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Ionicons name="arrow-up" size={20} color={canSend ? theme.primaryForeground : theme.foregroundSubtle} />
          </Pressable>
        )}
      </View>

      <AttachMenu
        visible={menuVisible}
        anchor={menuAnchor}
        entries={attachEntries}
        onClose={closeMenu}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  attachmentRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  thumbWrap: { position: 'relative' },
  thumb: { width: 56, height: 56 },
  removeThumb: { position: 'absolute', top: -6, right: -6 },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: FontSize.md,
  },
  iconBtn: { padding: Spacing.sm, alignItems: 'center', justifyContent: 'center', height: 44 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
