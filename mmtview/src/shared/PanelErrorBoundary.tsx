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
        <div className="panel-crash">
          <div className="panel-crash-title">
            UI panel failed to render
          </div>
          <div className="panel-crash-body">
            Your YAML is still safe in the editor. This usually happens while
            typing incomplete values. Keep editing, or retry when the file looks valid.
          </div>
          <pre className="panel-crash-pre">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            className="action-button"
            onClick={this.retry}
          >
            Retry UI
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
