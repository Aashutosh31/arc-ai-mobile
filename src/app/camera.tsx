import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, ThemedText } from '@/components/ui';
import { useComposerStore } from '@/store/composerStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

export default function CameraScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const setPendingImage = useComposerStore((s) => s.setPendingImage);
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      if (photo?.base64) {
        setPendingImage(photo.base64);
        router.back();
      }
    } catch {
      // ignore capture failure
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText variant="muted">Preparing camera…</ThemedText>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, gap: Spacing.lg }]}>
        <Ionicons name="camera-outline" size={40} color={theme.foregroundMuted} />
        <ThemedText variant="body" style={{ textAlign: 'center' }}>
          Camera access is needed to capture an image for ARC.
        </ThemedText>
        <Button label="Grant camera access" onPress={() => void requestPermission()} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View style={styles.controls}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.side}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Pressable
          onPress={capture}
          disabled={busy}
          style={[styles.shutter, { borderColor: theme.primary, opacity: busy ? 0.5 : 1 }]}>
          <View style={[styles.shutterInner, { backgroundColor: theme.primary }]} />
        </Pressable>
        <View style={styles.side} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  side: { width: 44, alignItems: 'center' },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27 },
});
