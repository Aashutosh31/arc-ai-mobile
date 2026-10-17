import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { useChatStore } from '@/store/chatStore';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';

export interface ClientAction {
  type: string;
  url?: string;
  text?: string;
  theme?: string;
  videoId?: string;
  title?: string;
  message?: string;
}

let lastReminder = { message: '', at: 0 };

/** Execute a server-issued `ai:client:action`. Side effects only. */
export async function applyClientAction(action: ClientAction): Promise<void> {
  if (!action || typeof action.type !== 'string') return;
  switch (action.type) {
    case 'OPEN_URL': {
      if (action.url) await Linking.openURL(action.url).catch(() => {});
      break;
    }
    case 'COPY_TO_CLIPBOARD': {
      if (typeof action.text === 'string') await Clipboard.setStringAsync(action.text);
      break;
    }
    case 'CHANGE_THEME': {
      if (action.theme) useThemeStore.getState().setTheme(action.theme);
      break;
    }
    case 'PLAY_MEDIA': {
      if (action.videoId) {
        useChatStore.getState().setMedia({
          videoId: action.videoId,
          title: action.title || 'Media',
        });
      }
      break;
    }
    case 'STOP_MEDIA': {
      useChatStore.getState().setMedia(null);
      break;
    }
    case 'TRIGGER_REMINDER': {
      const message = action.message || 'Reminder';
      const now = Date.now();
      // Dedupe repeats within 2s (server may target multiple sockets).
      if (lastReminder.message === message && now - lastReminder.at < 2000) break;
      lastReminder = { message, at: now };
      useChatStore.getState().appendSystemError(message); // surfaced as a plain message
      if (useSettingsStore.getState().hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      break;
    }
    default:
      break;
  }
}
