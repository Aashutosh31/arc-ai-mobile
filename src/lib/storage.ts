/**
 * Cross-platform secure-ish storage.
 *
 * - Native: expo-secure-store (Keychain / Keystore).
 * - Web: window.localStorage (SecureStore is unavailable on web).
 *
 * Used for the auth token and small settings blobs. Errors never throw to
 * callers — reads return null and writes are best-effort.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export async function getSecure(key: string): Promise<string | null> {
  try {
    if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSecure(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // best-effort
  }
}

export async function deleteSecure(key: string): Promise<void> {
  try {
    if (isWeb) {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // best-effort
  }
}

/** Generic JSON storage backed by AsyncStorage (works on all platforms). */
export async function getJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort
  }
}

export const STORAGE_KEYS = {
  token: 'arc.auth.token',
  identity: 'arc.auth.identity',
  voiceSettings: 'arc.voice.settings.v2',
  activeConversation: 'arc.chat.activeConversation',
} as const;
