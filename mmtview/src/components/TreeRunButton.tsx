import React from 'react';
import ContextMenuHost, { runInCoreMenuItem } from './ContextMenuHost';

export type TreeRunButtonProps = {
  onRun?: () => void | Promise<void>;
  /** Logs-only run (opens output channel via menu helper). */
  onRunInCore?: () => void | Promise<void>;
  title?: string;
  disabled?: boolean;
};

/**
 * Compact icon run control for suite/test tree rows.
 * Uses ghost `.action-button` — not `.tab-button` (tabs are for navigation).
 */
export default function TreeRunButton({
  onRun,
  onRunInCore,
  title = 'Run',
  disabled = false,
}: TreeRunButtonProps) {
  if (!onRun) {
    return null;
  }

  const coreHandler = onRunInCore || onRun;

  return (
    <ContextMenuHost
      items={disabled ? undefined : [runInCoreMenuItem(coreHandler)]}
    >
      <button
        className="action-button tree-run-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void onRun();
        }}
        title={title}
        disabled={disabled}
        type="button"
      >
        <span className="codicon codicon-run" aria-hidden />
      </button>
    </ContextMenuHost>
  );
}
