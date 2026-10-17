import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ThemedText } from '@/components/ui';
import { useDiagnosticsStore } from '@/store/diagnosticsStore';
import { Spacing } from '@/theme/layout';

interface Props {
  children: ReactNode;
  /** Rendered inline (for subtree guards) instead of as a full-screen pane. */
  compact?: boolean;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message: string | null;
}

/**
 * Contains render-time failures so a single broken subtree can never take the
 * whole app down. The captured error is recorded for on-device reporting.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown): void {
    useDiagnosticsStore.getState().record(error);
  }

  private reset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, message: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={[styles.wrap, this.props.compact && styles.compact]}>
        <ThemedText variant={this.props.compact ? 'caption' : 'subtitle'}>
          Something went wrong
        </ThemedText>
        {this.state.message ? (
          <ThemedText variant="muted" numberOfLines={4}>
            {this.state.message}
          </ThemedText>
        ) : null}
        <Button label="Try again" variant="outline" onPress={this.reset} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  compact: { flex: 0, padding: Spacing.sm },
});
