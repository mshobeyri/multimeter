import React from 'react';

type PanelErrorBoundaryProps = {
  /** When this changes, clear a previous error and retry rendering children. */
  resetKey?: string;
  children: React.ReactNode;
};

type PanelErrorBoundaryState = {
  error: Error | null;
};

/**
 * Keeps the YAML editor alive when the form/UI panel throws during render
 * (e.g. mid-typing YAML producing unexpected shapes). Without this, a single
 * panel crash unmounts the whole App and the editor text appears to vanish.
 */
export default class PanelErrorBoundary extends React.Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      window.vscode?.postMessage({
        command: 'logToOutput',
        level: 'error',
        message: `[ui] Panel render crashed: ${error?.message || error}\n${info?.componentStack || ''}`,
      });
    } catch {
      // ignore logging failures
    }
  }

  componentDidUpdate(prevProps: PanelErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 16,
            color: 'var(--vscode-editor-foreground, #ccc)',
            fontFamily: 'var(--vscode-font-family, sans-serif)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            UI panel failed to render
          </div>
          <div style={{ opacity: 0.85, marginBottom: 12 }}>
            Your YAML is still safe in the editor. This usually happens while
            typing incomplete values. Keep editing, or retry when the file looks valid.
          </div>
          <pre
            style={{
              margin: '0 0 12px 0',
              padding: '8px 10px',
              borderRadius: 4,
              background: 'rgba(127, 127, 127, 0.14)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'var(--vscode-editor-font-family, monospace)',
              fontSize: 12,
              opacity: 0.9,
            }}
          >
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            className="action-button"
            onClick={this.retry}
            style={{
              padding: '4px 10px',
              border: '1px solid var(--vscode-editorWidget-border, #555)',
              borderRadius: 3,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            Retry UI
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
