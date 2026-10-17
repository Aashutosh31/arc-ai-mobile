import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui';
import { isValidYouTubeId } from '@/lib/media';
import { useChatStore } from '@/store/chatStore';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

export function MediaCard() {
  const theme = useTheme();
  const media = useChatStore((s) => s.media);
  const setMedia = useChatStore((s) => s.setMedia);
  if (!media) return null;

  const open = () => {
    if (isValidYouTubeId(media.videoId)) {
      void Linking.openURL(`https://www.youtube.com/watch?v=${media.videoId}`);
    } else {
      void Linking.openURL(media.videoId);
    }
  };

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Ionicons name="play-circle" size={28} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <ThemedText variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
          {media.title}
        </ThemedText>
        <ThemedText variant="caption">Media requested by ARC-AI</ThemedText>
      </View>
      <Pressable onPress={open} style={[styles.btn, { borderColor: theme.primary }]}>
        <ThemedText variant="caption" color={theme.primary}>
          Open
        </ThemedText>
      </Pressable>
      <Pressable onPress={() => setMedia(null)} hitSlop={8}>
        <Ionicons name="close" size={18} color={theme.foregroundMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.md,
  },
  btn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
});
