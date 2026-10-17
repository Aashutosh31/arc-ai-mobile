import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Spinner, ThemedText } from '@/components/ui';
import { extractApiError } from '@/api/client';
import { mcpApi } from '@/api/integrations';
import { TOOL_CATALOG, TOOL_COUNT } from '@/lib/toolCatalog';
import { useTheme } from '@/store/themeStore';
import { Spacing } from '@/theme/layout';

interface McpServer {
  id: string;
  name: string;
  status?: string;
  connected?: boolean;
  description?: string;
  tools?: string[];
}

function normalizeServers(data: unknown): McpServer[] {
  const list = Array.isArray(data)
    ? data
    : ((data as { servers?: unknown[] })?.servers ?? []);
  return (list as Record<string, unknown>[])
    .filter(Boolean)
    .map((raw) => ({
      id: String(raw.id ?? raw._id ?? raw.name ?? ''),
      name: String(raw.name ?? raw.id ?? 'Server'),
      status: raw.status ? String(raw.status) : undefined,
      connected: Boolean(raw.connected ?? raw.status === 'connected'),
      description: raw.description ? String(raw.description) : undefined,
      tools: Array.isArray(raw.tools) ? (raw.tools as string[]) : undefined,
    }));
}

export default function ToolsScreen() {
  const theme = useTheme();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await mcpApi.listServers();
      setServers(normalizeServers(data));
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = async (server: McpServer) => {
    setBusyId(server.id);
    try {
      const res = server.connected
        ? await mcpApi.disconnect(server.id)
        : await mcpApi.connect(server.id);
      const updated = normalizeServers(res);
      if (updated.length) setServers(updated);
      else setServers((prev) => prev.map((s) => (s.id === server.id ? { ...s, connected: !s.connected } : s)));
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setBusyId(null);
    }
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
        <View style={styles.intro}>
          <Ionicons name="sparkles-outline" size={22} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="body" style={{ fontWeight: '700' }}>
              Native capabilities
            </ThemedText>
            <ThemedText variant="caption">
              {TOOL_COUNT} tools ARC can invoke automatically while you chat.
            </ThemedText>
          </View>
        </View>

        {TOOL_CATALOG.map((category) => (
          <Card key={category.id} style={styles.card}>
            <View style={styles.categoryHeader}>
              <Ionicons
                name={category.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={theme.primary}
              />
              <ThemedText variant="body" style={{ flex: 1, fontWeight: '600' }}>
                {category.label}
              </ThemedText>
              <ThemedText variant="caption">{category.tools.length}</ThemedText>
            </View>
            {category.tools.map((tool) => (
              <View key={tool.name} style={[styles.tool, { borderTopColor: theme.border }]}>
                <View style={styles.toolHead}>
                  <ThemedText variant="mono" style={{ flex: 1 }}>
                    {tool.name}
                  </ThemedText>
                  {!tool.guestAllowed ? (
                    <Ionicons name="lock-closed" size={12} color={theme.foregroundSubtle} />
                  ) : null}
                </View>
                <ThemedText variant="caption" numberOfLines={2}>
                  {tool.description}
                </ThemedText>
                {tool.params.length ? (
                  <View style={styles.tags}>
                    {tool.params.map((p) => (
                      <View key={p} style={[styles.tag, { borderColor: theme.border }]}>
                        <ThemedText variant="caption">{p}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        ))}

        <View style={styles.intro}>
          <Ionicons name="git-network-outline" size={22} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <ThemedText variant="body" style={{ fontWeight: '700' }}>
              MCP servers
            </ThemedText>
            <ThemedText variant="caption">
              Connect Model Context Protocol servers to add custom tools.
            </ThemedText>
          </View>
        </View>

        {loading ? (
          <Spinner label="Loading servers…" />
        ) : error ? (
          <ThemedText variant="muted" color={theme.destructive}>
            {error}
          </ThemedText>
        ) : servers.length === 0 ? (
          <ThemedText variant="muted">No MCP servers configured.</ThemedText>
        ) : (
          servers.map((server) => (
            <Card key={server.id} style={styles.card}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: server.connected ? theme.success : theme.foregroundSubtle },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText variant="body" style={{ fontWeight: '600' }}>
                    {server.name}
                  </ThemedText>
                  {server.description ? (
                    <ThemedText variant="caption" numberOfLines={2}>
                      {server.description}
                    </ThemedText>
                  ) : null}
                </View>
                <Button
                  label={server.connected ? 'Disconnect' : 'Connect'}
                  variant={server.connected ? 'outline' : 'primary'}
                  loading={busyId === server.id}
                  onPress={() => void toggle(server)}
                  style={{ minWidth: 110 }}
                />
              </View>
              {server.tools?.length ? (
                <View style={styles.tags}>
                  {server.tools.slice(0, 6).map((tool) => (
                    <View key={tool} style={[styles.tag, { borderColor: theme.border }]}>
                      <ThemedText variant="caption">{tool}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  card: { padding: Spacing.md, gap: Spacing.sm },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tool: { gap: 2, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  toolHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 2 },
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
});
