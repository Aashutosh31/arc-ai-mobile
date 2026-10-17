import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Card, Divider, Screen, Spinner, TextField, ThemedText } from '@/components/ui';
import { extractApiError } from '@/api/client';
import { memoryApi } from '@/api/memory';
import { searchApi } from '@/api/search';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/store/themeStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Spacing } from '@/theme/layout';
import type { MemoryDashboard, SearchItem } from '@/types/api';

export default function MemoryScreen() {
  const theme = useTheme();
  const activeWorkspaceId = useWorkspaceStore((s) => s.active?._id ?? null);
  const [data, setData] = useState<MemoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[] | null>(null);
  const memoryLearningEnabled = useSettingsStore((s) => s.memoryLearningEnabled);
  const setMemoryLearningEnabled = useSettingsStore((s) => s.setMemoryLearningEnabled);

  const load = useCallback(async () => {
    setError(null);
    try {
      const dashboard = await memoryApi.dashboard(activeWorkspaceId);
      setData(dashboard);
      setMemoryLearningEnabled(dashboard.preferences?.memoryLearningEnabled ?? true);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeWorkspaceId, setMemoryLearningEnabled]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    try {
      const res = await searchApi.search(q);
      setResults(res.items ?? []);
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  const removeFact = async (id: string) => {
    setData((d) => (d ? { ...d, facts: d.facts.filter((f) => f._id !== id) } : d));
    await memoryApi.deleteFact(id).catch(() => {});
  };
  const removeSemantic = async (id: string) => {
    setData((d) => (d ? { ...d, memories: d.memories.filter((m) => m._id !== id) } : d));
    await memoryApi.deleteSemantic(id).catch(() => {});
  };
  const togglePinFact = async (id: string, pinned: boolean) => {
    setData((d) =>
      d ? { ...d, facts: d.facts.map((f) => (f._id === id ? { ...f, pinned } : f)) } : d,
    );
    await memoryApi.updateFact(id, { pinned }).catch(() => {});
  };
  const togglePinSemantic = async (id: string, pinned: boolean) => {
    setData((d) =>
      d ? { ...d, memories: d.memories.map((m) => (m._id === id ? { ...m, pinned } : m)) } : d,
    );
    await memoryApi.updateSemantic(id, { pinned }).catch(() => {});
  };

  const onLearningToggle = async (v: boolean) => {
    setMemoryLearningEnabled(v);
    await memoryApi.setLearningEnabled(v).catch(() => setMemoryLearningEnabled(!v));
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={theme.primary}
          />
        }>
        <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={styles.row}>
            <Ionicons name="school-outline" size={20} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" style={{ fontWeight: '600' }}>
                Learning
              </ThemedText>
              <ThemedText variant="caption">Let ARC remember useful facts automatically</ThemedText>
            </View>
            <Switch
              value={memoryLearningEnabled}
              onValueChange={onLearningToggle}
              trackColor={{ true: theme.primary, false: theme.borderStrong }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <TextField
          placeholder="Search memories, chats and notes…"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={runSearch}
        />

        {results ? (
          <View style={{ gap: Spacing.sm }}>
            <ThemedText variant="label">Search results ({results.length})</ThemedText>
            {results.length === 0 ? (
              <ThemedText variant="muted">No matches.</ThemedText>
            ) : (
              results.map((item) => (
                <Card key={`${item.type}-${item.id}`} style={styles.item}>
                  <ThemedText variant="label">{item.title || item.type}</ThemedText>
                  <ThemedText variant="muted" numberOfLines={3}>
                    {item.snippet || item.text || item.response || ''}
                  </ThemedText>
                </Card>
              ))
            )}
          </View>
        ) : null}

        {loading ? (
          <Spinner label="Loading memory…" />
        ) : error ? (
          <ThemedText variant="muted" color={theme.destructive}>
            {error}
          </ThemedText>
        ) : (
          <>
            <View style={{ gap: Spacing.sm }}>
              <ThemedText variant="label">Facts ({data?.facts.length ?? 0})</ThemedText>
              {data?.facts.length ? (
                data.facts.map((fact) => (
                  <Card key={fact._id} style={styles.item}>
                    <View style={styles.row}>
                      <Pressable onPress={() => void togglePinFact(fact._id, !fact.pinned)} hitSlop={8}>
                        <Ionicons
                          name={fact.pinned ? 'bookmark' : 'bookmark-outline'}
                          size={16}
                          color={fact.pinned ? theme.primary : theme.foregroundMuted}
                        />
                      </Pressable>
                      <ThemedText variant="muted" style={{ flex: 1 }} color={theme.foreground}>
                        {fact.fact}
                      </ThemedText>
                      <Pressable onPress={() => void removeFact(fact._id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={theme.destructive} />
                      </Pressable>
                    </View>
                    {fact.category ? (
                      <ThemedText variant="caption">{fact.category}</ThemedText>
                    ) : null}
                  </Card>
                ))
              ) : (
                <ThemedText variant="muted">No facts learned yet.</ThemedText>
              )}
            </View>

            <Divider />

            <View style={{ gap: Spacing.sm }}>
              <ThemedText variant="label">Memories ({data?.memories.length ?? 0})</ThemedText>
              {data?.memories.length ? (
                data.memories.map((memory) => (
                  <Card key={memory._id} style={styles.item}>
                    <View style={styles.row}>
                      <Pressable onPress={() => void togglePinSemantic(memory._id, !memory.pinned)} hitSlop={8}>
                        <Ionicons
                          name={memory.pinned ? 'bookmark' : 'bookmark-outline'}
                          size={16}
                          color={memory.pinned ? theme.primary : theme.foregroundMuted}
                        />
                      </Pressable>
                      <ThemedText variant="body" style={{ flex: 1, fontWeight: '600' }} numberOfLines={2}>
                        {memory.query}
                      </ThemedText>
                      <Pressable onPress={() => void removeSemantic(memory._id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={theme.destructive} />
                      </Pressable>
                    </View>
                    <ThemedText variant="muted" numberOfLines={4}>
                      {memory.response}
                    </ThemedText>
                  </Card>
                ))
              ) : (
                <ThemedText variant="muted">No semantic memories yet.</ThemedText>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  card: { padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: Spacing.md },
  item: { padding: Spacing.md, gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
